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
    /// <summary>
    /// Optional description with embedded values.
    /// If not provided, the method name is used (with underscores converted to spaces).
    /// Use 'quoted values' or &lt;name:value&gt; for value extraction.
    /// </summary>
    public string? Description { get; }

    /// <summary>
    /// Creates a rule that uses the method name as description.
    /// </summary>
    /// <param name="testMethodName">Auto-populated with the method name.</param>
    public RuleAttribute([System.Runtime.CompilerServices.CallerMemberName] string testMethodName = "") 
        : this(null, testMethodName)
    {
    }

    /// <summary>
    /// Creates a rule with an explicit description.
    /// </summary>
    /// <param name="description">The rule description with optional embedded values.</param>
    /// <param name="testMethodName">Auto-populated with the method name.</param>
    public RuleAttribute(string? description, [System.Runtime.CompilerServices.CallerMemberName] string testMethodName = "")
    {
        Description = description;
        // Set DisplayName so Test Explorer shows "Rule: <readable name>"
        DisplayName = "Rule: " + (description ?? testMethodName.Replace("_", " "));
    }

    /// <summary>
    /// Gets the display name for this rule.
    /// </summary>
    public string GetDisplayName(MethodInfo method, IReadOnlyDictionary<string, object?>? paramValues = null)
    {
        if (!string.IsNullOrEmpty(Description))
        {
            return Description;
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
}
