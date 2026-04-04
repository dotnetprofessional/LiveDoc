using System.Text.RegularExpressions;

namespace SweDevTools.LiveDoc.xUnit.Journeys;

/// <summary>
/// Result of a single request within a journey, identified by its @name.
/// </summary>
public record StepResult(
    string Name,
    bool Passed,
    int? StatusCode,
    string Output,
    bool Reached
)
{
    private static readonly Regex AnsiEscapePattern = new(@"\x1B\[[0-9;]*[A-Za-z]|\x1B\].*?(\x07|\x1B\\)", RegexOptions.Compiled);

    /// <summary>
    /// Extracts the JSON response body from the httpyac output.
    /// The body sits between the response headers (blank line after last header)
    /// and the assertion lines ([x]/[-]).
    /// </summary>
    public string? ResponseBody => ExtractResponseBody();

    private string? ExtractResponseBody()
    {
        if (string.IsNullOrEmpty(Output)) return null;

        var lines = Output.Split('\n');
        bool pastHeaders = false;
        bool foundStatus = false;
        var bodyLines = new List<string>();
        bool inBody = false;

        foreach (var rawLine in lines)
        {
            var line = StripAnsi(rawLine).TrimEnd('\r');

            if (!foundStatus && line.TrimStart().StartsWith("HTTP/"))
            {
                foundStatus = true;
                continue;
            }

            if (!foundStatus) continue;

            if (!pastHeaders)
            {
                if (string.IsNullOrWhiteSpace(line))
                {
                    pastHeaders = true;
                    continue;
                }
                continue;
            }

            var trimmed = line.TrimStart();
            // httpyac assertion markers: bracketed on Windows [x], bare Unicode on Linux ✓/✖
            if (trimmed.StartsWith("[x]") || trimmed.StartsWith("[-]") ||
                trimmed.StartsWith("[ ]") || trimmed.StartsWith("[✗]") ||
                trimmed.StartsWith("[✓]") || trimmed.StartsWith("[✖]") ||
                trimmed.StartsWith("✓") || trimmed.StartsWith("✖") || trimmed.StartsWith("○"))
                break;

            if (Regex.IsMatch(trimmed, @"^\d+ requests processed"))
                break;

            if (!string.IsNullOrWhiteSpace(line))
                inBody = true;

            if (inBody)
                bodyLines.Add(line);
        }

        while (bodyLines.Count > 0 && string.IsNullOrWhiteSpace(bodyLines[^1]))
            bodyLines.RemoveAt(bodyLines.Count - 1);

        return bodyLines.Count > 0 ? string.Join("\n", bodyLines) : null;
    }

    private static string StripAnsi(string input) => AnsiEscapePattern.Replace(input, string.Empty);
}
