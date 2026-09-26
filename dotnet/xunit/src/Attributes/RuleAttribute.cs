using System.Reflection;
using Xunit;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Marks a test method as a Rule (single assertion in a Specification).
/// Similar to [Scenario] but without Gherkin step ceremony.
/// </summary>
/// <example>
/// <code>
/// [Specification("Calculator")]
/// public class CalculatorSpec : SpecificationTest
/// {
///     // Simple rule - method name becomes description
///     [Rule]
///     public void Adding_positive_numbers_works()
///     {
///         Assert.Equal(8, Calculator.Add(5, 3));
///     }
///     
///     // Rule with explicit description and embedded values
///     [Rule("Multiplying by '0' returns '0'")]
///     public void Multiply_by_zero()
///     {
///         Assert.Equal(0, Calculator.Multiply(100, 0));
///     }
/// }
/// </code>
/// </example>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
[XunitTestCaseDiscoverer("SweDevTools.LiveDoc.xUnit.RuleTestCaseDiscoverer", "livedoc-xunit")]
public class RuleAttribute : FactAttribute
{
    private readonly string? _sourceTitle;

    /// <summary>
    /// Optional explicit title with embedded values.
    /// If not provided, the method name is used (with underscores converted to spaces).
    /// Use 'quoted values' or &lt;name:value&gt; for value extraction.
    /// </summary>
    public string? Title { get; }

    /// <summary>
    /// Optional secondary description providing additional context.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Creates a rule with an optional title.
    /// </summary>
    /// <param name="title">The title, or the caller method name when omitted.</param>
    public RuleAttribute(
        [System.Runtime.CompilerServices.CallerMemberName] string title = "",
        [System.Runtime.CompilerServices.CallerArgumentExpression(nameof(title))]
        string? titleExpression = null)
    {
        _sourceTitle = title;
        Title = AttributeTitleFormatter.FormatExplicitName(title, titleExpression);
        DisplayName = "Rule: " +
            AttributeTitleFormatter.FormatMemberName(title, titleExpression);
    }

    /// <summary>
    /// Gets the display name for this rule.
    /// </summary>
    public string GetDisplayName(MethodInfo method, IReadOnlyDictionary<string, object?>? paramValues = null)
    {
        if (HasExplicitTitle(method))
        {
            return Title!;
        }

        // Use method name, applying _ALLCAPS placeholder replacement if values provided
        var methodName = method.Name;
        
        if (paramValues != null && paramValues.Count > 0)
        {
            return SweDevTools.LiveDoc.xUnit.Core.ValueParser.FormatMethodNameWithValues(methodName, paramValues);
        }

        // Simple underscore to space conversion
        return methodName.Replace('_', ' ');
    }

    private bool HasExplicitTitle(MethodInfo method)
    {
        return !string.IsNullOrEmpty(_sourceTitle) &&
               !string.Equals(_sourceTitle, method.Name, StringComparison.Ordinal);
    }
}
