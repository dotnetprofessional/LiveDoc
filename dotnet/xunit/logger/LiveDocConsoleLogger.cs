using System.Collections.Concurrent;
using System.Diagnostics;
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
    private const string DotnetCoverageToolEnvVar = "LIVEDOC_DOTNET_COVERAGE_TOOL";
    private readonly ConcurrentBag<TestResult> _results = new();
    private bool _useColor = true;
    private string? _metadataDir;
    private DateTime _initializedAtUtc;

    public void Initialize(TestLoggerEvents events, string testRunDirectory)
    {
        _initializedAtUtc = DateTime.UtcNow;
        _metadataDir = LiveDocPostRunCoverage.ConfigureEnvironment();
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
        _metadataDir = LiveDocPostRunCoverage.ConfigureEnvironment(parameters);

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
                // Fallback: derive from LiveDoc attributes when the test did not emit
                // a LiveDocContext header, otherwise fall back to the class name.
                var name = ResolveLiveDocHeading(group.Key) ?? $"  {FormatClassName(group.Key)}";
                sb.AppendLine(Color(name, AnsiColor.Yellow));
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

        var coverageDiagnostics = LiveDocPostRunCoverage.Publish(e.AttachmentSets, _metadataDir, reportMissingMetadata: true, _initializedAtUtc);
        if (coverageDiagnostics.Count > 0)
        {
            sb.AppendLine(Color("  Coverage", AnsiColor.Yellow));
            foreach (var diagnostic in coverageDiagnostics)
                sb.AppendLine(Color($"    {diagnostic}", AnsiColor.Yellow));
            sb.AppendLine();
        }

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

    internal static IReadOnlyList<string> BuildCoverageAttachmentDiagnostics(IEnumerable<AttachmentSet>? attachmentSets)
    {
        var coveragePaths = FindVisualStudioCoverageAttachments(attachmentSets)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (coveragePaths.Count == 0)
            return Array.Empty<string>();

        var artifactSummary = coveragePaths.Count == 1
            ? Quote(coveragePaths[0])
            : $"{coveragePaths.Count} Visual Studio .coverage artifacts";
        var firstPath = coveragePaths[0];
        var tool = ResolveDotnetCoverageTool();

        if (!IsDotnetCoverageAvailable(tool))
        {
            return
            [
                $"dotnet-coverage-missing: LiveDoc detected Visual Studio .coverage output ({artifactSummary}), but dotnet-coverage is not installed or is not on PATH. Install it with: dotnet tool install --global dotnet-coverage"
            ];
        }

        return
        [
            $"visualstudio-coverage-post-run: LiveDoc detected Visual Studio .coverage output ({artifactSummary}). VSTest writes this attachment after the xUnit reporter completes; the LiveDocCoverage logger can convert and attach it after the run. If the viewer still has no coverage, ensure the LiveDocCoverage logger is active or convert it manually with: dotnet-coverage merge {Quote(firstPath)} -f cobertura -o coverage.cobertura.xml"
        ];
    }

    private static IEnumerable<string> FindVisualStudioCoverageAttachments(IEnumerable<AttachmentSet>? attachmentSets)
    {
        if (attachmentSets == null)
            yield break;

        foreach (var attachmentSet in attachmentSets)
        {
            foreach (var attachment in attachmentSet.Attachments ?? Array.Empty<UriDataAttachment>())
            {
                var path = AttachmentPath(attachment.Uri);
                if (path.EndsWith(".coverage", StringComparison.OrdinalIgnoreCase))
                    yield return path;
            }
        }
    }

    private static string AttachmentPath(Uri uri)
    {
        return uri.IsFile ? uri.LocalPath : uri.ToString();
    }

    private static string ResolveDotnetCoverageTool()
    {
        var configured = Environment.GetEnvironmentVariable(DotnetCoverageToolEnvVar);
        if (string.IsNullOrWhiteSpace(configured))
            return "dotnet-coverage";

        return configured.Contains(Path.DirectorySeparatorChar) ||
               configured.Contains(Path.AltDirectorySeparatorChar) ||
               Path.IsPathRooted(configured)
            ? Path.GetFullPath(configured)
            : configured;
    }

    private static bool IsDotnetCoverageAvailable(string tool)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = tool,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };

            process.StartInfo.ArgumentList.Add("--version");
            if (!process.Start())
                return false;

            if (!process.WaitForExit(5_000))
            {
                process.Kill(entireProcessTree: true);
                return false;
            }

            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    private static string Quote(string value)
    {
        return value.Contains(' ') ? $"\"{value}\"" : value;
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

    private static string? ResolveLiveDocHeading(string className)
    {
        var type = ResolveType(className);
        if (type == null)
            return null;

        foreach (var attribute in type.GetCustomAttributes(inherit: true))
        {
            var attributeName = attribute.GetType().FullName;
            if (attributeName == "SweDevTools.LiveDoc.xUnit.SpecificationAttribute")
            {
                var title = GetStringProperty(attribute, "Title") ?? FormatClassName(className);
                return $"  Specification: {title}";
            }

            if (attributeName == "SweDevTools.LiveDoc.xUnit.FeatureAttribute")
            {
                var title = GetStringProperty(attribute, "Name") ?? FormatClassName(className);
                return $"  Feature: {title}";
            }
        }

        return null;
    }

    private static Type? ResolveType(string className)
    {
        return Type.GetType(className)
            ?? AppDomain.CurrentDomain.GetAssemblies()
                .Select(assembly =>
                {
                    try { return assembly.GetType(className); }
                    catch { return null; }
                })
                .FirstOrDefault(type => type != null);
    }

    private static string? GetStringProperty(object instance, string propertyName)
    {
        return instance.GetType().GetProperty(propertyName)?.GetValue(instance) as string;
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
