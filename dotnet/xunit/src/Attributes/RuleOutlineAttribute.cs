using System.Reflection;
using System.Runtime.CompilerServices;
using Xunit;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Marks a test method as a RuleOutline (data-driven rule in a Specification).
/// Similar to [ScenarioOutline] but without Gherkin step ceremony.
/// Use with [Example] attributes to provide test data.
/// </summary>
/// <example>
/// <code>
/// [Specification("Email Validation")]
/// public class EmailSpec : SpecificationTest
/// {
///     [RuleOutline("Email '<email>' should return <valid>")]
///     [Example("test@example.com", true)]
///     [Example("invalid", false)]
///     public void Validate_email(string email, bool valid)
///     {
///         Assert.Equal(valid, EmailValidator.IsValid(email));
///     }
///     
///     // Or using method name placeholders:
///     [RuleOutline]
///     [Example(5, 3, 8)]
///     [Example(10, 20, 30)]
///     public void Adding_A_and_B_returns_RESULT(int a, int b, int result)
///     {
///         Assert.Equal(result, Calculator.Add(a, b));
///     }
/// }
/// </code>
/// </example>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
[XunitTestCaseDiscoverer("SweDevTools.LiveDoc.xUnit.RuleOutlineTestCaseDiscoverer", "livedoc-xunit")]
public class RuleOutlineAttribute : TheoryAttribute
{
    private readonly string? _sourceTitle;

    /// <summary>
    /// Optional title with placeholders.
    /// Use &lt;paramName&gt; to reference method parameter names.
    /// If not provided, the method name is used with _ALLCAPS placeholders.
    /// </summary>
    public string? Title { get; }

    /// <summary>
    /// Optional secondary description providing additional context.
    /// Placeholders are preserved for binding to the selected example row.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Creates a rule outline that derives its narrative from the method name.
    /// _ALLCAPS segments in the method name are treated as placeholders.
    /// </summary>
    public RuleOutlineAttribute()
    {
    }

    /// <summary>
    /// Creates a rule outline with a positional authored title.
    /// </summary>
    /// <param name="title">The title template.</param>
    public RuleOutlineAttribute(
        string title,
        [CallerArgumentExpression(nameof(title))] string? titleExpression = null)
    {
        _sourceTitle = title;
        Title = AttributeTitleFormatter.FormatExplicitName(title, titleExpression);
        DisplayName = "Rule Outline: " +
            AttributeTitleFormatter.FormatMemberName(title, titleExpression);
    }

    /// <summary>
    /// Gets the display name for this rule outline with values substituted.
    /// </summary>
    public string GetDisplayName(MethodInfo method, IReadOnlyDictionary<string, object?> paramValues)
    {
        var template = GetTitleTemplate(method);
        if (!string.IsNullOrEmpty(template))
        {
            return System.Text.RegularExpressions.Regex.Replace(
                template,
                @"<([^<>\r\n]+)>",
                match =>
                {
                    var paramName = match.Groups[1].Value;
                    if (paramValues.TryGetValue(paramName, out var value))
                    {
                        return OutlineDisplayNameFormatter.FormatValue(value);
                    }
                    return match.Value;
                });
        }

        // Use method name with _ALLCAPS placeholder replacement
        return SweDevTools.LiveDoc.xUnit.Core.ValueParser.FormatMethodNameWithValues(method.Name, paramValues);
    }

    /// <summary>
    /// Gets the user-configured title template from DisplayName or Title.
    /// </summary>
    public string? GetTitleTemplate(MethodInfo method)
    {
        var defaultDisplayName = "Rule Outline: " + method.Name.Replace("_", " ");
        var generatedFromTitle = HasExplicitTitle(method) &&
            string.Equals(
                DisplayName,
                "Rule Outline: " + Title!.Replace("_", " "),
                StringComparison.Ordinal);
        if (!string.IsNullOrEmpty(DisplayName) &&
            !string.Equals(DisplayName, defaultDisplayName, StringComparison.Ordinal) &&
            !generatedFromTitle)
        {
            return DisplayName.StartsWith("Rule Outline: ", StringComparison.OrdinalIgnoreCase)
                ? DisplayName.Substring("Rule Outline: ".Length)
                : DisplayName;
        }

        return HasExplicitTitle(method) ? Title : null;
    }

    private bool HasExplicitTitle(MethodInfo method)
    {
        return !string.IsNullOrEmpty(_sourceTitle) &&
               !string.Equals(_sourceTitle, method.Name, StringComparison.Ordinal);
    }
}
