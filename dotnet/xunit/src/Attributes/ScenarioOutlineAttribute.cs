using System.Reflection;
using System.Runtime.CompilerServices;
using Xunit;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Marks a test method as a Scenario Outline (data-driven scenario) in BDD terminology.
/// Inherits from xUnit's TheoryAttribute.
/// Use with [Example] attributes to provide data rows.
/// </summary>
[XunitTestCaseDiscoverer("SweDevTools.LiveDoc.xUnit.ScenarioOutlineTestCaseDiscoverer", "livedoc-xunit")]
[AttributeUsage(AttributeTargets.Method)]
public class ScenarioOutlineAttribute : TheoryAttribute
{
    /// <summary>
    /// Constructs a new instance of the ScenarioOutlineAttribute with an optional test method name.
    /// </summary>
    /// <param name="testMethodName">
    /// The name of the test method. This is optional and defaults to the name of the method that calls the constructor.
    /// The testMethodName is used in the DisplayName of the test, with underscores replaced by spaces for better readability.
    /// </param>
    public ScenarioOutlineAttribute([CallerMemberName] string testMethodName = "")
    {
        this.DisplayName = "Scenario Outline: " + testMethodName.Replace("_", " ");
    }

    public string? Description { get; set; }

    /// <summary>
    /// Gets the display name for this scenario outline with example values substituted.
    /// </summary>
    public string GetDisplayName(MethodInfo method, IReadOnlyDictionary<string, object?> paramValues)
    {
        var defaultDisplayName = "Scenario Outline: " + method.Name.Replace("_", " ");
        if (!string.Equals(DisplayName, defaultDisplayName, StringComparison.Ordinal))
        {
            var template = DisplayName ?? defaultDisplayName;
            if (template.StartsWith("Scenario Outline: ", StringComparison.OrdinalIgnoreCase))
                template = template.Substring("Scenario Outline: ".Length);

            return System.Text.RegularExpressions.Regex.Replace(
                template,
                @"<([^>]+)>",
                match => paramValues.TryGetValue(match.Groups[1].Value, out var value)
                    ? OutlineDisplayNameFormatter.FormatValue(value)
                    : match.Value);
        }

        return Core.ValueParser.FormatMethodNameWithValues(method.Name, paramValues);
    }
}

internal static class OutlineDisplayNameFormatter
{
    public static IReadOnlyDictionary<string, object?> GetParameterValues(
        MethodInfo method,
        object?[]? arguments)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        if (arguments == null)
            return result;

        var parameters = method.GetParameters();
        for (var index = 0; index < Math.Min(parameters.Length, arguments.Length); index++)
            result[parameters[index].Name!] = arguments[index];

        return result;
    }

    public static string FormatValue(object? value)
    {
        return FormatValue(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    public static IReadOnlyList<string> GetValueFormats(object? value)
    {
        return new[]
        {
            FormatValue(value, System.Globalization.CultureInfo.CurrentCulture),
            FormatValue(value, System.Globalization.CultureInfo.InvariantCulture)
        }
        .Distinct(StringComparer.Ordinal)
        .ToArray();
    }

    private static string FormatValue(object? value, IFormatProvider formatProvider)
    {
        return value switch
        {
            null => "",
            IFormattable formattable => formattable.ToString(null, formatProvider),
            _ => value.ToString() ?? ""
        };
    }
}
