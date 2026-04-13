using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using SweDevTools.LiveDoc.xUnit.Core;
using SweDevTools.LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Reporter;

/// <summary>
/// Manages test run reporting to the LiveDoc server.
/// Thread-safe singleton that buffers all results in memory during test execution,
/// then sends everything in bulk when FlushAndCompleteAsync is called.
/// This follows the same pattern as the vitest reporter for reliability.
/// </summary>
public class LiveDocTestRunReporter : IDisposable
{
    private static LiveDocTestRunReporter? _instance;
    private static readonly object _lock = new();

    private readonly LiveDocReporter _reporter;
    private readonly ConcurrentDictionary<string, TestCase> _testCases = new();
    private readonly ConcurrentDictionary<string, BaseTest> _tests = new();
    private readonly ConcurrentDictionary<string, string> _testToTestCase = new();
    private Stopwatch _runStopwatch;
    private bool _disposed;
    private Task? _flushTask;
    private readonly object _flushLock = new();
    private int _totalCount;
    private int _passedCount;
    private int _failedCount;
    private int _skippedCount;
    private const int BatchChunkSize = 25;
    private readonly SemaphoreSlim _runStartLock = new(1, 1);
    private readonly LiveDocConfig _config;
    private DateTime _startedAt;
    private ConcurrentBag<Task> _realtimeTasks = new();

    /// <summary>
    /// Gets the singleton instance.
    /// </summary>
    public static LiveDocTestRunReporter Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new LiveDocTestRunReporter();
                }
            }
            return _instance;
        }
    }

    /// <summary>
    /// Whether reporting is enabled (server or file export configured).
    /// </summary>
    public bool IsEnabled => _reporter.IsEnabled || !string.IsNullOrEmpty(_config.ExportPath);

    private LiveDocTestRunReporter()
    {
        _config = LiveDocConfig.Default;
        _reporter = new LiveDocReporter(_config);
        _runStopwatch = Stopwatch.StartNew();
        _startedAt = DateTime.UtcNow;

        if (_reporter.IsEnabled || !string.IsNullOrEmpty(_config.ExportPath))
        {
            AppDomain.CurrentDomain.ProcessExit += OnProcessExit;
        }
    }

    private void OnProcessExit(object? sender, EventArgs e)
    {
        // If flush is already in progress (from RunTestCases), wait for it
        // If not started yet, start it now
        Task task;
        lock (_flushLock)
        {
            if (_flushTask != null)
            {
                task = _flushTask;
            }
            else
            {
                if (!HasBufferedResults())
                    return;

                _flushTask = FlushCoreAsync();
                task = _flushTask;
            }
        }
        task.GetAwaiter().GetResult();
    }

    /// <summary>
    /// Sends all buffered data to the server and completes the run.
    /// Called from the test framework hook after all tests finish.
    /// </summary>
    public async Task FlushAndCompleteAsync()
    {
        if (!_reporter.IsEnabled && string.IsNullOrEmpty(_config.ExportPath))
            return;

        Task task;
        lock (_flushLock)
        {
            if (_flushTask != null)
            {
                task = _flushTask;
            }
            else
            {
                if (!HasBufferedResults())
                    return;

                _flushTask = FlushCoreAsync();
                task = _flushTask;
            }
        }
        await task;
    }

    private bool HasBufferedResults()
    {
        return _reporter.RunId != null
            || !_testCases.IsEmpty
            || !_tests.IsEmpty
            || _totalCount > 0;
    }

    private async Task<string?> EnsureRunStartedAsync()
    {
        if (!_reporter.IsEnabled)
            return null;

        if (_reporter.RunId != null)
            return _reporter.RunId;

        await _runStartLock.WaitAsync();
        try
        {
            if (_reporter.RunId != null)
                return _reporter.RunId;

            return await _reporter.StartRunAsync();
        }
        finally
        {
            _runStartLock.Release();
        }
    }

    private TestCase BuildTestCasePayload(TestCase testCase)
    {
        // Gather tests belonging to this test case
        var testsForCase = _testToTestCase
            .Where(t => t.Value == testCase.Id)
            .Select(t => _tests.TryGetValue(t.Key, out var test) ? test : null)
            .Where(t => t != null)
            .ToList();

        testCase.Tests = testsForCase!;

        // Finalize outline stats from their exampleResults before sending
        foreach (var test in testsForCase)
        {
            if (test is ScenarioOutlineTest sot)
                FinalizeOutlineStats(sot.Statistics, sot.ExampleResults, sot.Execution);
            else if (test is RuleOutlineTest rot)
                FinalizeOutlineStats(rot.Statistics, rot.ExampleResults, rot.Execution);
        }

        // Compute test case statistics
        int totalTests = 0, passed = 0, failed = 0, skipped = 0, pending = 0;
        foreach (var test in testsForCase)
        {
            if (test is ScenarioOutlineTest outline)
            {
                totalTests += outline.Statistics.Total;
                passed += outline.Statistics.Passed;
                failed += outline.Statistics.Failed;
                skipped += outline.Statistics.Skipped;
                pending += outline.Statistics.Pending;
            }
            else if (test is RuleOutlineTest ruleOutline)
            {
                totalTests += ruleOutline.Statistics.Total;
                passed += ruleOutline.Statistics.Passed;
                failed += ruleOutline.Statistics.Failed;
                skipped += ruleOutline.Statistics.Skipped;
                pending += ruleOutline.Statistics.Pending;
            }
            else
            {
                totalTests++;
                var s = test!.Execution.Status;
                if (s == Models.Status.Passed) passed++;
                else if (s == Models.Status.Failed) failed++;
                else if (s == Models.Status.Skipped) skipped++;
                else pending++;
            }
        }

        testCase.Statistics = new Statistics
        {
            Total = totalTests,
            Passed = passed,
            Failed = failed,
            Skipped = skipped,
            Pending = pending
        };

        return testCase;
    }

    private void PublishTestCaseRealtime(string testCaseId)
    {
        var task = Task.Run(async () =>
        {
            try
            {
                var runId = await EnsureRunStartedAsync();
                if (runId == null) return;

                if (!_testCases.TryGetValue(testCaseId, out var testCase))
                    return;

                var payload = BuildTestCasePayload(testCase);
                await _reporter.UpsertTestCaseAsync(payload);
            }
            catch (Exception ex)
            {
                try
                {
                    Console.Error.WriteLine($"[LiveDoc] Warning: Realtime testcase upsert failed: {ex.Message}");
                }
                catch
                {
                    // Ignore logging failures.
                }
            }
        });
        _realtimeTasks.Add(task);
    }

    private async Task FlushCoreAsync()
    {
        try
        {
            // Wait for all in-flight real-time upsert tasks to complete.
            // These may hold _runStartLock (starting the run via HTTP) — if we
            // don't await them first, PublishToServerAsync would block on the
            // semaphore and the ProcessExit timeout could kill the process.
            var pending = _realtimeTasks.ToArray();
            if (pending.Length > 0)
            {
                try { await Task.WhenAll(pending); }
                catch { /* individual task errors already logged */ }
            }

            // Prepare all test cases with their accumulated tests
            var upsertPayloads = new List<TestCase>();
            foreach (var kvp in _testCases)
            {
                upsertPayloads.Add(BuildTestCasePayload(kvp.Value));
            }

            // Compute run statistics
            _runStopwatch.Stop();
            var duration = _runStopwatch.ElapsedMilliseconds;
            var status = _failedCount > 0 ? Models.Status.Failed : Models.Status.Passed;
            var summary = new Statistics
            {
                Total = _totalCount,
                Passed = _passedCount,
                Failed = _failedCount,
                Skipped = _skippedCount,
                Pending = 0
            };

            // Export to JSON file if configured (runs alongside server publishing)
            var exportTask = ExportTestRunJsonAsync(upsertPayloads, status, duration, summary);

            // Publish to server if enabled
            if (_reporter.IsEnabled)
            {
                await PublishToServerAsync(upsertPayloads, status, duration, summary);
            }

            // Ensure export completes
            await exportTask;

            // Reset all state so the singleton can handle a new test assembly
            Reset();
        }
        catch (Exception ex)
        {
            try
            {
                Console.Error.WriteLine($"[LiveDoc] Warning: Failed to flush and complete run: {ex.Message}");
            }
            catch
            {
                // Ignore logging failures.
            }

            lock (_flushLock)
            {
                _flushTask = null;
            }
        }
    }

    /// <summary>
    /// Publishes test results to the LiveDoc server via HTTP.
    /// </summary>
    private async Task PublishToServerAsync(
        List<TestCase> upsertPayloads,
        Models.Status status,
        long duration,
        Statistics summary)
    {
        var runId = await EnsureRunStartedAsync();
        if (runId == null)
            return;

        var complete = new CompleteRunRequest
        {
            Status = status,
            Duration = duration,
            Summary = summary
        };

        if (upsertPayloads.Count == 0)
        {
            var completed = await _reporter.CompleteRunAsync(status, duration, summary);
            if (!completed)
            {
                await _reporter.CompleteRunAsync(status, duration, summary);
            }
            return;
        }

        var allBatchRequestsSucceeded = true;
        for (int i = 0; i < upsertPayloads.Count; i += BatchChunkSize)
        {
            var chunk = upsertPayloads.Skip(i).Take(BatchChunkSize).ToList();
            var isLastChunk = i + BatchChunkSize >= upsertPayloads.Count;
            var chunkComplete = isLastChunk ? complete : null;

            var chunkOk = await _reporter.UpsertTestCasesBatchAsync(chunk, chunkComplete);
            if (!chunkOk)
            {
                allBatchRequestsSucceeded = false;
                break;
            }
        }

        if (!allBatchRequestsSucceeded)
        {
            // Fallback to per-testcase upserts to salvage partial failures caused by payload size/shape.
            foreach (var testCase in upsertPayloads)
            {
                await _reporter.UpsertTestCaseAsync(testCase);
            }

            var completed = await _reporter.CompleteRunAsync(status, duration, summary);
            if (!completed)
            {
                await _reporter.CompleteRunAsync(status, duration, summary);
            }
        }
    }

    /// <summary>
    /// Exports test results to a TestRunV1 JSON file for offline consumption.
    /// </summary>
    private async Task ExportTestRunJsonAsync(
        List<TestCase> documents,
        Models.Status status,
        long duration,
        Statistics summary)
    {
        var exportPath = _config.ExportPath;
        if (string.IsNullOrEmpty(exportPath))
            return;

        try
        {
            var testRun = new TestRunV1
            {
                ProtocolVersion = "1.0",
                RunId = _reporter.RunId ?? Guid.NewGuid().ToString(),
                Project = _config.Project,
                Environment = _config.Environment,
                Framework = "xunit",
                Timestamp = _startedAt.ToString("O"),
                Duration = duration,
                Status = status,
                Summary = summary,
                Documents = documents
            };

            var jsonOptions = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
                WriteIndented = true
            };

            var fullPath = Path.GetFullPath(exportPath);
            var dir = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);

            var json = JsonSerializer.SerializeToUtf8Bytes(testRun, jsonOptions);
            await File.WriteAllBytesAsync(fullPath, json);

            var sizeKb = json.Length / 1024.0;
            var sizeStr = sizeKb >= 1024
                ? $"{sizeKb / 1024.0:F1} MB"
                : $"{sizeKb:F1} KB";

            try
            {
                Console.WriteLine($"\u2705 LiveDoc results exported to {exportPath} ({sizeStr})");
            }
            catch
            {
                // Ignore console output failures.
            }
        }
        catch (Exception ex)
        {
            try
            {
                Console.Error.WriteLine($"[LiveDoc] Warning: Failed to export results to {exportPath}: {ex.Message}");
            }
            catch
            {
                // Ignore logging failures.
            }
        }
    }

    /// <summary>
    /// Buffers a test case (Feature or Specification) for later sending.
    /// Thread-safe — only the first call per ID is stored.
    /// </summary>
    public void BufferTestCase(
        string id,
        string kind,
        string title,
        string? description = null,
        string[]? tags = null,
        string? path = null)
    {
        _testCases.TryAdd(id, new TestCase
        {
            Id = id,
            Kind = kind,
            Title = title,
            Description = description,
            Tags = tags?.ToList(),
            Path = path
        });
    }

    /// <summary>
    /// Buffers a scenario/rule test result (non-outline).
    /// Uses TryAdd to avoid overwriting data already provided by LiveDocContext.
    /// </summary>
    public void BufferTest(
        string testCaseId,
        string testId,
        string kind,
        string title,
        string? description = null,
        string[]? tags = null)
    {
        var test = kind switch
        {
            "Scenario" => new ScenarioTest
            {
                Id = testId,
                Title = title,
                Description = description,
                Tags = tags?.ToList(),
                Execution = new ExecutionResult { Status = Models.Status.Running }
            },
            _ => new BaseTest
            {
                Id = testId,
                Kind = kind,
                Title = title,
                Description = description,
                Tags = tags?.ToList(),
                Execution = new ExecutionResult { Status = Models.Status.Running }
            }
        };

        _tests.TryAdd(testId, test);
        _testToTestCase.TryAdd(testId, testCaseId);
    }

    /// <summary>
    /// Returns true if a test with the given ID has already been buffered.
    /// </summary>
    public bool HasTest(string testId) => _tests.ContainsKey(testId);

    /// <summary>
    /// Buffers an outline test (ScenarioOutline or RuleOutline).
    /// Creates the outline on first call; subsequent calls add example results.
    /// Thread-safe via ConcurrentDictionary.
    /// </summary>
    public void BufferOutlineExample(
        string testCaseId,
        string outlineId,
        string kind,
        string title,
        int rowId,
        ParameterInfo[] parameters,
        object[] args,
        string? description = null,
        string[]? tags = null)
    {
        // Build the example row values
        var rowValues = new List<TypedValue>();
        for (int i = 0; i < Math.Min(parameters.Length, args.Length); i++)
        {
            rowValues.Add(TypedValue.From(args[i]));
        }
        var row = new Row { RowId = rowId, Values = rowValues };

        if (kind == "ScenarioOutline")
        {
            var outline = _tests.GetOrAdd(outlineId, _ =>
            {
                var headers = parameters.Select(p => p.Name ?? $"arg{p.Position}").ToList();
                var t = new ScenarioOutlineTest
                {
                    Id = outlineId,
                    Title = title,
                    Description = description,
                    Tags = tags?.ToList(),
                    Execution = new ExecutionResult { Status = Models.Status.Running },
                    Examples = new List<DataTable>
                    {
                        new DataTable { Headers = headers, Rows = new List<Row>() }
                    }
                };
                _testToTestCase[outlineId] = testCaseId;
                return t;
            });

            if (outline is ScenarioOutlineTest sot)
            {
                lock (sot)
                {
                    if (sot.Examples.Count > 0)
                        sot.Examples[0].Rows.Add(row);
                }
            }
        }
        else // RuleOutline
        {
            var outline = _tests.GetOrAdd(outlineId, _ =>
            {
                var headers = parameters.Select(p => p.Name ?? $"arg{p.Position}").ToList();
                var t = new RuleOutlineTest
                {
                    Id = outlineId,
                    Title = title,
                    Description = description,
                    Tags = tags?.ToList(),
                    Execution = new ExecutionResult { Status = Models.Status.Running },
                    Examples = new List<DataTable>
                    {
                        new DataTable { Headers = headers, Rows = new List<Row>() }
                    }
                };
                _testToTestCase[outlineId] = testCaseId;
                return t;
            });

            if (outline is RuleOutlineTest rot)
            {
                lock (rot)
                {
                    if (rot.Examples.Count > 0)
                        rot.Examples[0].Rows.Add(row);
                }
            }
        }
    }

    /// <summary>
    /// Adds an example result to an outline test.
    /// testId should be the step ID (for step-level tracking) or outline ID (for no-step outlines).
    /// </summary>
    public void AddOutlineExampleResult(
        string outlineId,
        int rowId,
        string testId,
        Models.Status status,
        long duration,
        ErrorInfo? error = null)
    {
        if (!_tests.TryGetValue(outlineId, out var test))
            return;

        var result = new ExampleResult
        {
            TestId = testId,
            Result = new ExecutionResult
            {
                RowId = rowId,
                Status = status,
                Duration = duration,
                Error = error
            }
        };

        if (test is ScenarioOutlineTest sot)
        {
            lock (sot)
            {
                sot.ExampleResults.Add(result);
            }
        }
        else if (test is RuleOutlineTest rot)
        {
            lock (rot)
            {
                rot.ExampleResults.Add(result);
            }
        }
    }

    /// <summary>
    /// Finalizes outline stats at flush time from exampleResults.
    /// Called in FlushAndCompleteAsync to ensure all results are counted.
    /// </summary>
    private static void FinalizeOutlineStats(Statistics stats, List<ExampleResult> results, ExecutionResult execution)
    {
        if (results.Count == 0)
            return;

        // Count unique rows and their statuses
        var rowStatuses = results
            .GroupBy(r => r.Result.RowId)
            .Select(g => g.Any(r => r.Result.Status == Models.Status.Failed) 
                ? Models.Status.Failed 
                : g.All(r => r.Result.Status == Models.Status.Passed) 
                    ? Models.Status.Passed 
                    : g.All(r => r.Result.Status == Models.Status.Skipped)
                        ? Models.Status.Skipped
                        : Models.Status.Pending)
            .ToList();

        stats.Total = rowStatuses.Count;
        stats.Passed = rowStatuses.Count(s => s == Models.Status.Passed);
        stats.Failed = rowStatuses.Count(s => s == Models.Status.Failed);
        stats.Skipped = rowStatuses.Count(s => s == Models.Status.Skipped);
        stats.Pending = rowStatuses.Count(s => s == Models.Status.Pending);

        execution.Status = stats.Failed > 0 ? Models.Status.Failed 
            : stats.Passed > 0 ? Models.Status.Passed 
            : stats.Skipped > 0 ? Models.Status.Skipped
            : Models.Status.Pending;
        execution.Duration = results.Sum(r => r.Result.Duration);
    }

    /// <summary>
    /// Sets the steps on a buffered scenario test.
    /// </summary>
    public void SetTestSteps(string testId, List<StepTest> steps)
    {
        if (_tests.TryGetValue(testId, out var test))
        {
            if (test is ScenarioTest scenario)
            {
                scenario.Steps = steps;
            }
            else if (test is ScenarioOutlineTest outline)
            {
                // Only set template steps once (from first example)
                lock (outline)
                {
                    if (outline.Steps.Count == 0)
                        outline.Steps = steps;
                }
            }
        }
    }

    /// <summary>
    /// Updates the execution result of a buffered test.
    /// </summary>
    public void UpdateTestExecution(
        string testId,
        Models.Status status,
        long duration,
        ErrorInfo? error = null)
    {
        if (_tests.TryGetValue(testId, out var test))
        {
            test.Execution = new ExecutionResult
            {
                Status = status,
                Duration = duration,
                Error = error
            };
        }
    }

    /// <summary>
    /// Records a test result for run summary statistics.
    /// </summary>
    public void RecordResult(Models.Status status, string? testCaseId = null)
    {
        Interlocked.Increment(ref _totalCount);
        switch (status)
        {
            case Models.Status.Passed:
                Interlocked.Increment(ref _passedCount);
                break;
            case Models.Status.Failed:
                Interlocked.Increment(ref _failedCount);
                break;
            case Models.Status.Skipped:
                Interlocked.Increment(ref _skippedCount);
                break;
        }

        if (!string.IsNullOrWhiteSpace(testCaseId))
        {
            PublishTestCaseRealtime(testCaseId);
        }
    }

    /// <summary>
    /// Generates a stable ID for a test case based on its class.
    /// </summary>
    public static string GenerateTestCaseId(Type testClass)
    {
        return $"TestCase:{testClass.FullName ?? testClass.Name}";
    }

    /// <summary>
    /// Generates a stable ID for a scenario/rule (non-outline).
    /// Includes args hash for unique per-invocation identification.
    /// </summary>
    public static string GenerateScenarioId(Type testClass, string methodName, object[]? args = null)
    {
        var baseId = $"Scenario:{testClass.FullName ?? testClass.Name}:{methodName}";
        
        if (args != null && args.Length > 0)
        {
            var argsStr = string.Join(",", args.Select(a => a?.ToString() ?? "null"));
            baseId += $":{ComputeHash(argsStr)}";
        }
        
        return baseId;
    }

    /// <summary>
    /// Generates a stable ID for an outline test (shared across all example rows).
    /// No args hash — all rows share the same outline test.
    /// </summary>
    public static string GenerateOutlineId(Type testClass, string methodName)
    {
        return $"Outline:{testClass.FullName ?? testClass.Name}:{methodName}";
    }

    /// <summary>
    /// Generates a stable ID for a step.
    /// </summary>
    public static string GenerateStepId(string parentId, string stepType, int stepIndex)
    {
        return $"{parentId}:step{stepIndex}";
    }

    /// <summary>
    /// Derives a navigation path from a test class type.
    /// Strips the assembly name prefix and converts namespace separators to slashes.
    /// E.g., SweDevTools.LiveDoc.xUnit.Tests.Gherkin.Examples.MySpec → Gherkin/Examples/MySpec.cs
    /// </summary>
    public static string DerivePath(Type testClass)
    {
        var fullName = testClass.FullName ?? testClass.Name;
        var assemblyName = testClass.Assembly.GetName().Name ?? "";
        return DerivePathFromNames(fullName, assemblyName);
    }

    /// <summary>
    /// Derives a navigation path from class and assembly name strings.
    /// Used by MessageSink which has ITypeInfo instead of Type.
    /// </summary>
    public static string DerivePathFromNames(string fullClassName, string assemblyName)
    {
        var relativeName = fullClassName;

        if (!string.IsNullOrWhiteSpace(assemblyName))
        {
            var marker = assemblyName + ".";

            if (relativeName.StartsWith(marker, StringComparison.Ordinal))
            {
                relativeName = relativeName.Substring(marker.Length);
            }
            else
            {
                var markerIndex = relativeName.IndexOf(marker, StringComparison.Ordinal);
                if (markerIndex >= 0)
                {
                    relativeName = relativeName.Substring(markerIndex + marker.Length);
                }
            }
        }

        // Convert dots to slashes
        return relativeName.Replace('.', '/') + ".cs";
    }

    private static string ComputeHash(string input)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes)[..8].ToLowerInvariant();
    }

    /// <summary>
    /// Resets all run state so the singleton can handle a new test assembly.
    /// Called automatically after a successful flush.
    /// </summary>
    private void Reset()
    {
        _testCases.Clear();
        _tests.Clear();
        _testToTestCase.Clear();
        _totalCount = 0;
        _passedCount = 0;
        _failedCount = 0;
        _skippedCount = 0;
        _startedAt = DateTime.UtcNow;
        _runStopwatch = Stopwatch.StartNew();
        _realtimeTasks = new ConcurrentBag<Task>();

        lock (_flushLock)
        {
            _flushTask = null;
        }

        // Reset the HTTP reporter's run ID so a new run can start
        _reporter.ResetRun();

        // Re-resolve project name for the next assembly
        _config.ReResolveProject();
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            AppDomain.CurrentDomain.ProcessExit -= OnProcessExit;
            _reporter.Dispose();
            _disposed = true;
        }
    }
}

/// <summary>
/// Extension methods for converting between internal and reporter types.
/// </summary>
public static class ReporterExtensions
{
    /// <summary>
    /// Converts a step type string to a StepKeyword enum.
    /// </summary>
    public static StepKeyword ToStepKeyword(this string stepType)
    {
        return stepType.ToLowerInvariant() switch
        {
            "given" => StepKeyword.Given,
            "when" => StepKeyword.When,
            "then" => StepKeyword.Then,
            "and" => StepKeyword.And,
            "but" => StepKeyword.But,
            _ => StepKeyword.Given
        };
    }

    /// <summary>
    /// Converts a step status to a reporter status.
    /// </summary>
    public static Models.Status ToReporterStatus(this StepStatus status)
    {
        return status switch
        {
            StepStatus.Passed => Models.Status.Passed,
            StepStatus.Failed => Models.Status.Failed,
            StepStatus.Pending => Models.Status.Pending,
            StepStatus.Skipped => Models.Status.Skipped,
            _ => Models.Status.Pending
        };
    }
}
