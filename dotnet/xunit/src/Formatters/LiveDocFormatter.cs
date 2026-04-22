namespace SweDevTools.LiveDoc.xUnit.Formatters;

/// <summary>
/// Formats test output in BDD/Gherkin style with optional colors.
/// Can be extended to support different output formats.
/// </summary>
internal class LiveDocFormatter
{
    private const string FeatureIndent = "  ";
    private const string ScenarioIndent = "    ";
    private const string StepIndent = "      ";
    private const string AndButIndent = "        ";

    /// <summary>
    /// Formats a feature heading.
    /// </summary>
    public string FormatFeature(string name)
    {
        return $"{FeatureIndent}Feature: {name}";
    }

    /// <summary>
    /// Formats a specification heading.
    /// </summary>
    public string FormatSpecification(string name)
    {
        return $"{FeatureIndent}Specification: {name}";
    }

    /// <summary>
    /// Formats a rule heading (for specification tests).
    /// </summary>
    public string FormatRule(string name)
    {
        // If name already has the prefix, just add indentation
        if (name.StartsWith("Rule:"))
            return $"{ScenarioIndent}{name}";
        return $"{ScenarioIndent}Rule: {name}";
    }

    /// <summary>
    /// Formats a description with proper indentation.
    /// Handles multi-line descriptions by indenting each line.
    /// </summary>
    public string FormatDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
            return string.Empty;

        // Normalize line endings and split into lines
        var lines = description
            .Replace("\r\n", "\n")
            .Replace("\r", "\n")
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => !string.IsNullOrEmpty(line))
            .ToList();

        if (lines.Count == 0)
            return string.Empty;

        // Use scenario indent for description lines (aligned with scenario)
        var formattedLines = lines.Select(line => $"{ScenarioIndent}{line}");
        return string.Join("\n", formattedLines);
    }

    /// <summary>
    /// Formats a scenario heading.
    /// </summary>
    public string FormatScenario(string name)
    {
        // If name already has the prefix, just add indentation
        if (name.StartsWith("Scenario:") || name.StartsWith("Scenario Outline:"))
            return $"{ScenarioIndent}{name}";
        return $"{ScenarioIndent}Scenario: {name}";
    }

    /// <summary>
    /// Formats a scenario outline heading.
    /// </summary>
    public string FormatScenarioOutline(string name)
    {
        // If name already has the prefix, just add indentation
        if (name.StartsWith("Scenario Outline:"))
            return $"{ScenarioIndent}{name}";
        return $"{ScenarioIndent}Scenario Outline: {name}";
    }

    /// <summary>
    /// Formats an example heading with data summary.
    /// </summary>
    public string FormatExample(string dataSummary)
    {
        return $"{StepIndent}Example: {dataSummary}";
    }

    /// <summary>
    /// Formats an example header with number (like "Example: 1").
    /// </summary>
    public string FormatExampleHeader(int exampleNumber)
    {
        return $"{ScenarioIndent}Example: {exampleNumber}";
    }

    /// <summary>
    /// Formats example parameter values in a nice layout.
    /// </summary>
    public string FormatExampleValues(List<string> parameterLines)
    {
        if (parameterLines.Count == 0) return "";
        
        var indent = new string(' ', StepIndent.Length);
        
        // For 5 or fewer parameters, use horizontal table format
        if (parameterLines.Count <= 5)
        {
            return FormatExampleValuesHorizontal(parameterLines, indent);
        }
        else
        {
            // For more than 5 parameters, use vertical format
            return FormatExampleValuesVertical(parameterLines, indent);
        }
    }

    private string FormatExampleValuesHorizontal(List<string> parameterLines, string indent)
    {
        // Parse parameter names and values
        var parameters = parameterLines
            .Select(p => p.Split(new[] { ": " }, 2, StringSplitOptions.None))
            .Select(parts => new { Name = parts[0], Value = parts.Length > 1 ? parts[1] : "" })
            .ToList();

        var names = parameters.Select(p => p.Name).ToList();
        var values = parameters.Select(p => p.Value).ToList();

        // Calculate column widths
        var columnWidths = new List<int>();
        for (int i = 0; i < parameters.Count; i++)
        {
            var width = Math.Max(names[i].Length, values[i].Length);
            columnWidths.Add(width);
        }

        // Build table
        var lines = new List<string>();
        
        // Top border
        var topBorder = indent + "┌─" + string.Join("─┬─", columnWidths.Select(w => new string('─', w))) + "─┐";
        lines.Add(topBorder);
        
        // Header row
        var headerRow = indent + "│ " + string.Join(" │ ", names.Select((n, i) => n.PadRight(columnWidths[i]))) + " │";
        lines.Add(headerRow);
        
        // Separator
        var separator = indent + "├─" + string.Join("─┼─", columnWidths.Select(w => new string('─', w))) + "─┤";
        lines.Add(separator);
        
        // Values row
        var valuesRow = indent + "│ " + string.Join(" │ ", values.Select((v, i) => v.PadRight(columnWidths[i]))) + " │";
        lines.Add(valuesRow);
        
        // Bottom border
        var bottomBorder = indent + "└─" + string.Join("─┴─", columnWidths.Select(w => new string('─', w))) + "─┘";
        lines.Add(bottomBorder);
        
        return string.Join("\n", lines);
    }

    private string FormatExampleValuesVertical(List<string> parameterLines, string indent)
    {
        // Use vertical format for many parameters (original format)
        var lines = new List<string>();
        foreach (var param in parameterLines)
        {
            lines.Add($"{indent}  {param}");
        }
        return string.Join("\n", lines);
    }

    /// <summary>
    /// Formats a step (Given/When/Then/And/But).
    /// </summary>
    public string FormatStep(string type, string description)
    {
        var indent = (type == "and" || type == "but") ? AndButIndent : StepIndent;
        return $"{indent}{type} {description}";
    }

    /// <summary>
    /// Formats a passing summary line.
    /// </summary>
    public string FormatPassingSummary(int count, double totalMs)
    {
        return $"{StepIndent}✓ {count} passing ({totalMs:F0}ms)";
    }

    /// <summary>
    /// Formats a failing summary line.
    /// </summary>
    public string FormatFailingSummary(int count)
    {
        return $"{StepIndent}✗ {count} failing";
    }

    /// <summary>
    /// Formats a step with pass/fail indicator.
    /// </summary>
    public string FormatStepWithStatus(string type, string description, bool passed)
    {
        var indent = (type == "and" || type == "but") ? AndButIndent : StepIndent;
        var status = passed ? "✓" : "✗";
        return $"{indent}{status} {type} {description}";
    }

    /// <summary>
    /// Formats error details for a failed step.
    /// </summary>
    public string FormatStepError(string errorMessage, string? stackTrace = null)
    {
        var indent = new string(' ', AndButIndent.Length + 2);
        var lines = new List<string>();
        
        lines.Add($"{indent}Error: {errorMessage}");
        
        if (!string.IsNullOrEmpty(stackTrace))
        {
            // Include just the first line of stack trace for brevity
            var firstStackLine = stackTrace.Split('\n')[0].Trim();
            if (!string.IsNullOrEmpty(firstStackLine) && firstStackLine != errorMessage)
            {
                lines.Add($"{indent}  at {firstStackLine}");
            }
        }
        
        return string.Join("\n", lines);
    }

    /// <summary>
    /// Formats tags (e.g., @smoke @fast).
    /// </summary>
    public string FormatTags(string[] tags)
    {
        if (tags == null || tags.Length == 0)
            return string.Empty;

        var formatted = string.Join(" ", tags.Select(t => t.StartsWith("@") ? t : $"@{t}"));
        return $"{ScenarioIndent}{formatted}";
    }
}
