using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using LiveDoc.xUnit.Core;
using LiveDoc.xUnit.Reporter.Models;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Reporter;

/// <summary>
/// Manages test run reporting to the LiveDoc server.
/// Thread-safe singleton that handles the entire test run lifecycle.
/// </summary>
public class LiveDocTestRunReporter : IDisposable
{
    private static LiveDocTestRunReporter? _instance;
    private static readonly object _lock = new();

    private readonly LiveDocReporter _reporter;
    private readonly Dictionary<string, TestCase> _testCases = new();
    private readonly Stopwatch _runStopwatch;
    private bool _runStarted;
    private bool _disposed;

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
    }

    /// <summary>
    /// Ensures the test run has been started.
    /// </summary>
    public async Task EnsureRunStartedAsync()
    {
        if (_runStarted || !_reporter.IsEnabled)
            return;

        lock (_lock)
        {
            if (_runStarted)
                return;
            _runStarted = true;
        }

        await _reporter.StartRunAsync();
    }

    /// <summary>
    /// Reports a test case (Feature or Specification).
    /// </summary>
    public async Task ReportTestCaseAsync(
        string id,
        string style,
        string title,
        string? description = null,
        string[]? tags = null,
        string? path = null)
    {
        if (!_reporter.IsEnabled)
            return;

        await EnsureRunStartedAsync();

        var testCase = new TestCase
        {
            Id = id,
            Style = style,
            Title = title,
            Description = description,
            Tags = tags?.ToList(),
            Path = path,
            Statistics = new Statistics()
        };

        lock (_lock)
        {
            _testCases[id] = testCase;
        }

        await _reporter.UpsertTestCaseAsync(testCase);
    }

    /// <summary>
    /// Reports a scenario start.
    /// </summary>
    public async Task ReportScenarioStartAsync(
        string testCaseId,
        string scenarioId,
        string title,
        string? description = null,
        string[]? tags = null)
    {
        if (!_reporter.IsEnabled)
            return;

        var scenario = new ScenarioTest
        {
            Id = scenarioId,
            Title = title,
            Description = description,
            Tags = tags?.ToList(),
            Execution = new ExecutionResult { Status = Models.Status.Running }
        };

        await _reporter.UpsertTestAsync(testCaseId, scenario);
    }

    /// <summary>
    /// Reports a step result.
    /// </summary>
    public async Task ReportStepAsync(
        string testCaseId,
        string scenarioId,
        string stepId,
        StepKeyword keyword,
        string title,
        Models.Status status,
        long duration,
        ErrorInfo? error = null)
    {
        if (!_reporter.IsEnabled)
            return;

        var step = new StepTest
        {
            Id = stepId,
            Keyword = keyword,
            Title = title,
            Execution = new ExecutionResult
            {
                Status = status,
                Duration = duration,
                Error = error
            }
        };

        // Patch the step execution
        await _reporter.PatchExecutionAsync(stepId, step.Execution);
    }

    /// <summary>
    /// Reports a scenario completion.
    /// </summary>
    public async Task ReportScenarioCompleteAsync(
        string scenarioId,
        Models.Status status,
        long duration,
        ErrorInfo? error = null)
    {
        if (!_reporter.IsEnabled)
            return;

        var execution = new ExecutionResult
        {
            Status = status,
            Duration = duration,
            Error = error
        };

        await _reporter.PatchExecutionAsync(scenarioId, execution);
    }

    /// <summary>
    /// Reports an outline example result.
    /// </summary>
    public async Task ReportExampleResultAsync(
        string outlineId,
        int rowId,
        string testId,
        Models.Status status,
        long duration,
        ErrorInfo? error = null)
    {
        if (!_reporter.IsEnabled)
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

        await _reporter.UpsertExampleResultsAsync(outlineId, new[] { result });
    }

    /// <summary>
    /// Reports a standard test result (for vanilla [Fact]/[Theory] tests).
    /// Creates both the test case and result in one call.
    /// </summary>
    public async Task ReportStandardTestAsync(
        string className,
        string methodName,
        string displayName,
        Models.Status status,
        long duration,
        ErrorInfo? error = null)
    {
        if (!_reporter.IsEnabled)
            return;

        await EnsureRunStartedAsync();

        var testCaseId = $"standard:{className}";
        var testId = $"{className}.{methodName}";

        // Report the test case (class) if not already reported
        if (!_testCases.ContainsKey(testCaseId))
        {
            var testCase = new TestCase
            {
                Id = testCaseId,
                Style = TestStyles.Standard,
                Title = FormatClassName(className)
            };

            _testCases[testCaseId] = testCase;
            await _reporter.UpsertTestCaseAsync(testCase);
        }

        // Report the test as a BaseTest (standard tests have no steps)
        var test = new BaseTest
        {
            Id = testId,
            Kind = "Test",
            Title = displayName,
            Execution = new ExecutionResult
            {
                Status = status,
                Duration = duration,
                Error = error
            }
        };

        await _reporter.UpsertTestAsync(testCaseId, test);
    }

    private static string FormatClassName(string className)
    {
        // Extract just the class name from fully qualified name
        var lastDot = className.LastIndexOf('.');
        var name = lastDot >= 0 ? className.Substring(lastDot + 1) : className;
        
        // Convert PascalCase to Title Case with spaces
        return System.Text.RegularExpressions.Regex.Replace(
            name, "([a-z])([A-Z])", "$1 $2");
    }

    /// <summary>
    /// Completes the test run.
    /// </summary>
    public async Task CompleteRunAsync(int total, int passed, int failed, int skipped)
    {
        if (!_reporter.IsEnabled || !_runStarted)
            return;

        _runStopwatch.Stop();

        var status = failed > 0 ? Models.Status.Failed : Models.Status.Passed;
        var summary = new Statistics
        {
            Total = total,
            Passed = passed,
            Failed = failed,
            Skipped = skipped,
            Pending = 0
        };

        await _reporter.CompleteRunAsync(status, _runStopwatch.ElapsedMilliseconds, summary);
    }

    /// <summary>
    /// Generates a stable ID for a test case based on its class.
    /// </summary>
    public static string GenerateTestCaseId(Type testClass)
    {
        return $"TestCase:{testClass.FullName ?? testClass.Name}";
    }

    /// <summary>
    /// Generates a stable ID for a scenario.
    /// </summary>
    public static string GenerateScenarioId(Type testClass, string methodName, object[]? args = null)
    {
        var baseId = $"Scenario:{testClass.FullName ?? testClass.Name}:{methodName}";
        
        if (args != null && args.Length > 0)
        {
            // Include args hash for outline disambiguation
            var argsStr = string.Join(",", args.Select(a => a?.ToString() ?? "null"));
            baseId += $":{ComputeHash(argsStr)}";
        }
        
        return baseId;
    }

    /// <summary>
    /// Generates a stable ID for a step.
    /// </summary>
    public static string GenerateStepId(string scenarioId, string stepType, int stepIndex)
    {
        return $"Step:{scenarioId}:{stepType}:{stepIndex}";
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
