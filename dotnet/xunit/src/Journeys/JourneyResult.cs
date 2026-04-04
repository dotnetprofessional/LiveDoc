using System.Text.RegularExpressions;

namespace SweDevTools.LiveDoc.xUnit.Journeys;

/// <summary>
/// Result of running a single .http journey file via httpyac CLI.
/// Maps each @name'd request to a <see cref="StepResult"/> for per-step assertions.
/// </summary>
public class JourneyResult
{
    private static readonly Regex AnsiEscapePattern = new(@"\x1B\[[0-9;]*m", RegexOptions.Compiled);

    public bool Success { get; }
    public string Output { get; }
    public IReadOnlyDictionary<string, StepResult> Steps { get; }

    public JourneyResult(bool success, string output, Dictionary<string, StepResult> steps)
    {
        Success = success;
        Output = output;
        Steps = steps;
    }

    /// <summary>
    /// Asserts that the named step passed. Throws with request-specific output on failure.
    /// If the step was never reached (prior step failed + bail), reports "not reached".
    /// </summary>
    public void AssertStep(string name)
    {
        if (!Steps.TryGetValue(name, out var step))
        {
            throw new JourneyAssertionException(
                $"Step '{name}' not found in journey output. Available steps: {string.Join(", ", Steps.Keys)}\n\nRaw output:\n{Output}");
        }

        if (!step.Reached)
        {
            throw new JourneyAssertionException(
                $"Step '{name}' was not reached (a prior step failed).\n\nFull output:\n{Output}");
        }

        if (!step.Passed)
        {
            throw new JourneyAssertionException(
                $"Step '{name}' failed (HTTP {step.StatusCode}).\n\nStep output:\n{step.Output}");
        }
    }

    /// <summary>
    /// Asserts step passed, then runs additional assertions (e.g., payload validation).
    /// </summary>
    public void AssertStep(string name, Action<StepResult> additionalAssertions)
    {
        AssertStep(name);
        var step = Steps[name];
        additionalAssertions(step);
    }

    /// <summary>
    /// Parses httpyac CLI output into per-request StepResults.
    /// </summary>
    /// <remarks>
    /// httpyac output format:
    /// <code>
    ///   === stepName ===
    ///   GET http://...
    ///   HTTP/1.1 200  - OK
    ///   [x] assertion passed
    ///   [ ] assertion failed
    ///   ...
    ///   N requests processed (M succeeded)
    /// </code>
    /// </remarks>
    public static JourneyResult Parse(int exitCode, string output)
    {
        var steps = new Dictionary<string, StepResult>(StringComparer.OrdinalIgnoreCase);
        var lines = output.Split('\n');

        string? currentStep = null;
        int? currentStatus = null;
        bool hasFailedAssertion = false;
        var currentOutput = new List<string>();

        var stepHeaderPattern = new Regex(@"^===\s+(.+?)\s+===(?:\s.*)?$", RegexOptions.Compiled);
        var statusPattern = new Regex(@"HTTP/[\d.]+\s+(\d{3})\s", RegexOptions.Compiled);

        foreach (var rawLine in lines)
        {
            var line = StripAnsi(rawLine).TrimEnd('\r');

            var stepMatch = stepHeaderPattern.Match(line.Trim());
            if (stepMatch.Success)
            {
                if (currentStep != null)
                {
                    steps[currentStep] = new StepResult(
                        currentStep, !hasFailedAssertion, currentStatus,
                        string.Join("\n", currentOutput), true);
                }

                currentStep = NormalizeStepName(stepMatch.Groups[1].Value);
                currentStatus = null;
                hasFailedAssertion = false;
                currentOutput.Clear();
                continue;
            }

            if (currentStep == null) continue;

            currentOutput.Add(line);

            var statusMatch = statusPattern.Match(line);
            if (statusMatch.Success)
            {
                currentStatus = int.Parse(statusMatch.Groups[1].Value);
            }

            var trimmed = line.Trim();
            // httpyac assertion markers: bracketed on Windows [x], bare Unicode on Linux ✓/✖
            if (trimmed.StartsWith("[-]") || trimmed.StartsWith("[ ]") || trimmed.StartsWith("[✗]") ||
                trimmed.StartsWith("[✖]") || trimmed.StartsWith("✖") || trimmed.StartsWith("○"))
            {
                hasFailedAssertion = true;
            }
        }

        if (currentStep != null)
        {
            steps[currentStep] = new StepResult(
                currentStep, !hasFailedAssertion, currentStatus,
                string.Join("\n", currentOutput), true);
        }

        return new JourneyResult(exitCode == 0, output, steps);
    }

    private static string StripAnsi(string input) => AnsiEscapePattern.Replace(input, string.Empty);

    private static string NormalizeStepName(string rawName)
    {
        var cleaned = StripAnsi(rawName).Trim();
        if (string.IsNullOrEmpty(cleaned))
            return cleaned;

        var firstToken = cleaned.Split([' ', '\t'], StringSplitOptions.RemoveEmptyEntries)[0];
        return firstToken.Trim('"', '\'', '`');
    }
}
