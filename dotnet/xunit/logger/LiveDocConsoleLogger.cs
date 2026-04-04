using System.Collections.Concurrent;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;

namespace SweDevTools.LiveDoc.xUnit.Logger;

/// <summary>
/// VSTest Logger that outputs BDD-formatted test results to the console.
/// Activated with: dotnet test --logger LiveDoc
/// </summary>
[FriendlyName("LiveDoc")]
[ExtensionUri("logger://swedevtools/livedoc")]
public class LiveDocConsoleLogger : ITestLoggerWithParameters
{
    private readonly ConcurrentBag<TestResult> _results = new();
    private bool _useColor = true;

    public void Initialize(TestLoggerEvents events, string testRunDirectory)
    {
        events.TestResult += OnTestResult;
        events.TestRunComplete += OnTestRunComplete;
    }

    public void Initialize(TestLoggerEvents events, Dictionary<string, string?> parameters)
    {
        if (parameters.TryGetValue("nocolor", out _))
            _useColor = false;

        // Bridge logger parameters to environment variables so LiveDocConfig picks them up.
        // The logger initializes before test execution, so env vars are set before
        // LiveDocConfig.Default is first accessed by the test framework.
        BridgeParameter(parameters, "ServerUrl", "LIVEDOC_SERVER_URL");
        BridgeParameter(parameters, "Project", "LIVEDOC_PROJECT");
        BridgeParameter(parameters, "Environment", "LIVEDOC_ENVIRONMENT");
        BridgeParameter(parameters, "ExportPath", "LIVEDOC_EXPORT_PATH");

        Initialize(events, string.Empty);
    }

    /// <summary>
    /// Sets an environment variable from a logger parameter if present and non-empty.
    /// Logger parameters (--logger "LiveDoc;Key=Value") take precedence over
    /// existing environment variables.
    /// </summary>
    private static void BridgeParameter(Dictionary<string, string?> parameters, string paramName, string envVarName)
    {
        if (parameters.TryGetValue(paramName, out var value) && !string.IsNullOrEmpty(value))
            System.Environment.SetEnvironmentVariable(envVarName, value);
    }

    private void OnTestResult(object? sender, TestResultEventArgs e)
    {
        _results.Add(e.Result);
    }

    private void OnTestRunComplete(object? sender, TestRunCompleteEventArgs e)
    {
        var results = _results.ToArray();
        if (results.Length == 0) return;

        // Group by class name (Feature/Specification)
        var groups = results
            .GroupBy(r => GetClassName(r.TestCase.FullyQualifiedName))
            .OrderBy(g => g.Key);

        var sb = new StringBuilder();
        sb.AppendLine();

        int totalPassed = 0, totalFailed = 0, totalSkipped = 0;
        double totalDurationMs = 0;
        var failures = new List<(string Test, string Error, string? Stack)>();

        foreach (var group in groups)
        {
            var groupResults = group.OrderBy(r => r.TestCase.DisplayName).ToList();

            // Extract the Feature/Specification heading from the first test's output
            var heading = ExtractHeading(groupResults);
            if (heading != null)
            {
                sb.AppendLine(Color(heading, AnsiColor.Yellow));
            }
            else
            {
                // Fallback: derive from class name
                var name = FormatClassName(group.Key);
                sb.AppendLine(Color($"  {name}", AnsiColor.Yellow));
            }

            // Output each test result
            foreach (var result in groupResults)
            {
                var displayName = result.TestCase.DisplayName;
                var duration = result.Duration.TotalMilliseconds;
                totalDurationMs += duration;

                var (indicator, color) = result.Outcome switch
                {
                    TestOutcome.Passed => ("✓", AnsiColor.Green),
                    TestOutcome.Failed => ("✗", AnsiColor.Red),
                    TestOutcome.Skipped => ("-", AnsiColor.Cyan),
                    _ => ("○", AnsiColor.Gray),
                };

                switch (result.Outcome)
                {
                    case TestOutcome.Passed: totalPassed++; break;
                    case TestOutcome.Failed: totalFailed++; break;
                    case TestOutcome.Skipped: totalSkipped++; break;
                }

                // Format the test line
                var durationStr = duration >= 1 ? $" ({duration:F0}ms)" : "";
                sb.AppendLine(Color($"    {indicator} {displayName}{durationStr}", color));

                // Collect failure details
                if (result.Outcome == TestOutcome.Failed && !string.IsNullOrEmpty(result.ErrorMessage))
                {
                    failures.Add((displayName, result.ErrorMessage, result.ErrorStackTrace));

                    // Show brief inline error
                    var firstLine = result.ErrorMessage.Split('\n')[0].Trim();
                    if (firstLine.Length > 100) firstLine = firstLine[..97] + "...";
                    sb.AppendLine(Color($"        {firstLine}", AnsiColor.Red));
                }
            }

            sb.AppendLine();
        }

        // Summary
        var parts = new List<string>();
        if (totalPassed > 0) parts.Add(Color($"{totalPassed} passed", AnsiColor.Green));
        if (totalFailed > 0) parts.Add(Color($"{totalFailed} failed", AnsiColor.Red));
        if (totalSkipped > 0) parts.Add(Color($"{totalSkipped} skipped", AnsiColor.Cyan));

        var durationSummary = totalDurationMs >= 1000
            ? $"{totalDurationMs / 1000:F1}s"
            : $"{totalDurationMs:F0}ms";

        sb.AppendLine($"  Tests: {string.Join(", ", parts)} ({durationSummary})");
        sb.AppendLine();

        // Detailed failures at the end
        if (failures.Count > 0)
        {
            sb.AppendLine(Color("  ─── Failures ───", AnsiColor.Red));
            sb.AppendLine();
            for (int i = 0; i < failures.Count; i++)
            {
                var (test, error, stack) = failures[i];
                sb.AppendLine(Color($"  {i + 1}) {test}", AnsiColor.Red));
                sb.AppendLine($"     {error.Trim()}");
                if (!string.IsNullOrEmpty(stack))
                {
                    var firstStackLine = stack.Split('\n')[0].Trim();
                    sb.AppendLine(Color($"     {firstStackLine}", AnsiColor.Gray));
                }
                sb.AppendLine();
            }
        }

        Console.Write(sb.ToString());
    }

    /// <summary>
    /// Extracts the Feature/Specification heading from test output messages.
    /// </summary>
    private static string? ExtractHeading(List<TestResult> results)
    {
        foreach (var result in results)
        {
            foreach (var message in result.Messages)
            {
                if (message.Category != TestResultMessage.StandardOutCategory) continue;
                if (string.IsNullOrEmpty(message.Text)) continue;

                foreach (var line in message.Text.Split('\n'))
                {
                    var trimmed = line.TrimEnd('\r');
                    if (Regex.IsMatch(trimmed, @"^\s+(Feature|Specification):\s+"))
                        return trimmed;
                }
            }
        }
        return null;
    }

    /// <summary>
    /// Extracts the class name from a fully qualified test name.
    /// e.g., "LiveDoc.Samples.ShippingCostsTests.MethodName" → "LiveDoc.Samples.ShippingCostsTests"
    /// </summary>
    private static string GetClassName(string fullyQualifiedName)
    {
        var lastDot = fullyQualifiedName.LastIndexOf('.');
        return lastDot >= 0 ? fullyQualifiedName[..lastDot] : fullyQualifiedName;
    }

    /// <summary>
    /// Formats a class name as a readable heading.
    /// e.g., "LiveDoc.Samples.ShippingCostsTests" → "Shipping Costs Tests"
    /// </summary>
    private static string FormatClassName(string className)
    {
        var simple = className.Contains('.') ? className[(className.LastIndexOf('.') + 1)..] : className;
        return Regex.Replace(simple, "([a-z])([A-Z])", "$1 $2").Replace("_", " ");
    }

    #region ANSI Colors

    private enum AnsiColor
    {
        Green,
        Red,
        Yellow,
        Cyan,
        Gray,
    }

    private string Color(string text, AnsiColor color)
    {
        if (!_useColor) return text;

        var code = color switch
        {
            AnsiColor.Green => "\x1b[32m",
            AnsiColor.Red => "\x1b[31m",
            AnsiColor.Yellow => "\x1b[33m",
            AnsiColor.Cyan => "\x1b[36m",
            AnsiColor.Gray => "\x1b[90m",
            _ => "",
        };

        return $"{code}{text}\x1b[0m";
    }

    #endregion
}
