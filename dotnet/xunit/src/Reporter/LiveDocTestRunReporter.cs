using System.Collections.Concurrent;
using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
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
    private readonly Stopwatch _runStopwatch;
    private bool _disposed;
    private Task? _flushTask;
    private readonly object _flushLock = new();
    private int _totalCount;
    private int _passedCount;
    private int _failedCount;
    private int _skippedCount;

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
    /// Whether reporting is enabled.
    /// </summary>
    public bool IsEnabled => _reporter.IsEnabled;

    private LiveDocTestRunReporter()
    {
        _reporter = new LiveDocReporter();
        _runStopwatch = Stopwatch.StartNew();

        if (_reporter.IsEnabled)
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
        if (!_reporter.IsEnabled)
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
                _flushTask = FlushCoreAsync();
                task = _flushTask;
            }
        }
        await task;
    }

    private async Task FlushCoreAsync()
    {
        try
        {
            // Start the run
            var runId = await _reporter.StartRunAsync();
            if (runId == null)
                return;

            // Prepare all test cases with their accumulated tests
            var upsertPayloads = new List<TestCase>();
            foreach (var kvp in _testCases)
            {
                var testCase = kvp.Value;

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

                upsertPayloads.Add(testCase);
            }

            // Send all test cases AND complete the run in a single HTTP request
            _runStopwatch.Stop();
            var status = _failedCount > 0 ? Models.Status.Failed : Models.Status.Passed;
            var summary = new Statistics
            {
                Total = _totalCount,
                Passed = _passedCount,
                Failed = _failedCount,
                Skipped = _skippedCount,
                Pending = 0
            };
            var complete = new CompleteRunRequest
            {
                Status = status,
                Duration = _runStopwatch.ElapsedMilliseconds,
                Summary = summary
            };

            await _reporter.UpsertTestCasesBatchAsync(upsertPayloads, complete);
        }
        catch
        {
            // Don't let reporting errors affect test exit
        }
    }

    /// <summary>
    /// Buffers a test case (Feature or Specification) for later sending.
    /// Thread-safe — only the first call per ID is stored.
    /// </summary>
    public void BufferTestCase(
        string id,
        string style,
        string title,
        string? description = null,
        string[]? tags = null,
        string? path = null)
    {
        _testCases.TryAdd(id, new TestCase
        {
            Id = id,
            Style = style,
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
                    : Models.Status.Pending)
            .ToList();

        stats.Total = rowStatuses.Count;
        stats.Passed = rowStatuses.Count(s => s == Models.Status.Passed);
        stats.Failed = rowStatuses.Count(s => s == Models.Status.Failed);
        stats.Pending = rowStatuses.Count(s => s == Models.Status.Pending);
        stats.Skipped = 0;

        execution.Status = stats.Failed > 0 ? Models.Status.Failed : Models.Status.Passed;
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
    public void RecordResult(Models.Status status)
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
        // Strip assembly prefix
        var relativeName = fullClassName.StartsWith(assemblyName + ".", StringComparison.Ordinal)
            ? fullClassName.Substring(assemblyName.Length + 1)
            : fullClassName;

        // Convert dots to slashes
        return relativeName.Replace('.', '/') + ".cs";
    }

    private static string ComputeHash(string input)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes)[..8].ToLowerInvariant();
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
