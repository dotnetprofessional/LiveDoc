using System.Text.RegularExpressions;

namespace LiveDoc.xUnit.Core;

/// <summary>
/// Parses step descriptions to extract quoted values and named parameters.
/// </summary>
public static class ValueParser
{
    // Pattern for quoted values: 'value'
    private static readonly Regex QuotedValuePattern = new(@"'([^']*)'", RegexOptions.Compiled);

    // Pattern for named parameters: <name:value>
    private static readonly Regex NamedParamPattern = new(@"<([^:>]+):([^>]*)>", RegexOptions.Compiled);

    // Pattern for placeholder only: <name> (without value, for outline placeholders)
    private static readonly Regex PlaceholderPattern = new(@"<([^:>]+)>", RegexOptions.Compiled);

    /// <summary>
    /// Extracts all quoted values from a step description.
    /// </summary>
    /// <param name="description">The step description containing 'quoted values'.</param>
    /// <returns>Array of raw string values in order of appearance.</returns>
    public static string[] ExtractQuotedValues(string description)
    {
        var matches = QuotedValuePattern.Matches(description);
        var values = new string[matches.Count];
        
        for (int i = 0; i < matches.Count; i++)
        {
            values[i] = matches[i].Groups[1].Value;
        }
        
        return values;
    }

    /// <summary>
    /// Extracts all named parameters from a step description.
    /// </summary>
    /// <param name="description">The step description containing &lt;name:value&gt; patterns.</param>
    /// <returns>Dictionary of parameter names to values (case-insensitive keys).</returns>
    public static Dictionary<string, string> ExtractNamedParams(string description)
    {
        var matches = NamedParamPattern.Matches(description);
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        
        foreach (Match match in matches)
        {
            var name = match.Groups[1].Value.Trim();
            var value = match.Groups[2].Value;
            result[name] = value;
        }
        
        return result;
    }

    /// <summary>
    /// Replaces named parameters in a description with their values.
    /// &lt;name:value&gt; becomes just "value".
    /// </summary>
    /// <param name="description">The step description.</param>
    /// <returns>The description with named parameters replaced by their values.</returns>
    public static string ReplaceNamedParams(string description)
    {
        return NamedParamPattern.Replace(description, match =>
        {
            return match.Groups[2].Value;
        });
    }

    /// <summary>
    /// Replaces placeholders in a description with values from example data.
    /// &lt;name&gt; is replaced with the corresponding example value.
    /// </summary>
    /// <param name="description">The step description.</param>
    /// <param name="exampleData">Dictionary of placeholder names to values.</param>
    /// <returns>The description with placeholders replaced.</returns>
    public static string ReplacePlaceholders(string description, IReadOnlyDictionary<string, object?> exampleData)
    {
        return PlaceholderPattern.Replace(description, match =>
        {
            var name = match.Groups[1].Value.Trim();
            
            if (exampleData.TryGetValue(name, out var value))
            {
                return value?.ToString() ?? "";
            }
            
            // Leave unchanged if not found
            return match.Value;
        });
    }

    /// <summary>
    /// Creates LiveDocValue array from extracted string values.
    /// </summary>
    /// <param name="rawValues">The raw string values.</param>
    /// <param name="stepTitle">The step title for error context.</param>
    /// <returns>Array of LiveDocValue wrappers.</returns>
    public static LiveDocValue[] CreateValueArray(string[] rawValues, string stepTitle)
    {
        var result = new LiveDocValue[rawValues.Length];
        
        for (int i = 0; i < rawValues.Length; i++)
        {
            result[i] = new LiveDocValue(rawValues[i], stepTitle, index: i);
        }
        
        return result;
    }

    /// <summary>
    /// Creates a LiveDocValueDictionary from extracted named parameters.
    /// </summary>
    /// <param name="rawParams">The raw parameter dictionary.</param>
    /// <param name="stepTitle">The step title for error context.</param>
    /// <returns>LiveDocValueDictionary for typed access.</returns>
    public static LiveDocValueDictionary CreateParamDictionary(Dictionary<string, string> rawParams, string stepTitle)
    {
        return new LiveDocValueDictionary(rawParams, stepTitle);
    }

    /// <summary>
    /// Parses method name placeholders using _ALLCAPS convention.
    /// </summary>
    /// <param name="methodName">The method name with _PLACEHOLDER_ segments.</param>
    /// <param name="parameterNames">The method parameter names for matching.</param>
    /// <returns>Dictionary mapping placeholder names to their positions in the method name.</returns>
    public static Dictionary<string, string> ExtractMethodNamePlaceholders(string methodName, string[] parameterNames)
    {
        // Pattern: _ALLCAPS followed by _ or end of string
        var pattern = new Regex(@"_([A-Z][A-Z0-9]*)(?=_|$)", RegexOptions.Compiled);
        var matches = pattern.Matches(methodName);
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        // Create a lookup set for parameter names (case-insensitive)
        var paramLookup = new HashSet<string>(parameterNames, StringComparer.OrdinalIgnoreCase);

        foreach (Match match in matches)
        {
            var placeholderName = match.Groups[1].Value;
            
            // Only treat as placeholder if it matches a parameter name
            if (paramLookup.Contains(placeholderName))
            {
                result[placeholderName] = placeholderName;
            }
        }

        return result;
    }

    /// <summary>
    /// Converts a method name to a display string, replacing placeholders with values.
    /// </summary>
    /// <param name="methodName">The method name with underscores and _PLACEHOLDER_ segments.</param>
    /// <param name="parameterValues">Dictionary of parameter names to their values.</param>
    /// <returns>Human-readable display string with values inserted.</returns>
    public static string FormatMethodNameWithValues(string methodName, IReadOnlyDictionary<string, object?> parameterValues)
    {
        // Create a case-insensitive lookup from the provided values
        var caseInsensitiveValues = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in parameterValues)
        {
            caseInsensitiveValues[kvp.Key] = kvp.Value;
        }

        // Step 1: Replace _ALLCAPS with placeholder markers (before underscore-to-space)
        // The leading underscore is converted to a space in the replacement
        var pattern = new Regex(@"_([A-Z][A-Z0-9]*)(?=_|$)");
        var withMarkers = pattern.Replace(methodName, match =>
        {
            var name = match.Groups[1].Value;
            if (caseInsensitiveValues.TryGetValue(name, out var value))
            {
                // Replace _PLACEHOLDER with " value" (space + value)
                return $" \x00{value}\x00";
            }
            return match.Value;
        });

        // Step 2: Replace underscores with spaces
        var withSpaces = withMarkers.Replace('_', ' ');

        // Step 3: Remove markers and normalize whitespace
        var result = withSpaces.Replace("\x00", "");
        result = Regex.Replace(result, @"\s+", " ").Trim();

        return result;
    }
}
