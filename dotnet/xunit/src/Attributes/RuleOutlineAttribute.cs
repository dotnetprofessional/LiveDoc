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
    /// <summary>
    /// Optional description with placeholders.
    /// Use &lt;paramName&gt; to reference method parameter names.
    /// If not provided, the method name is used with _ALLCAPS placeholders.
    /// </summary>
    public string? Description { get; }

    /// <summary>
    /// Creates a rule outline that uses the method name as description template.
    /// _ALLCAPS segments in the method name are treated as placeholders.
    /// </summary>
    /// <param name="testMethodName">Auto-populated with the method name.</param>
    public RuleOutlineAttribute([CallerMemberName] string testMethodName = "") : this(null, testMethodName)
    {
    }

    /// <summary>
    /// Creates a rule outline with an explicit description template.
    /// </summary>
    /// <param name="description">The description with &lt;placeholder&gt; for parameter names.</param>
    /// <param name="testMethodName">Auto-populated with the method name.</param>
    public RuleOutlineAttribute(string? description, [CallerMemberName] string testMethodName = "")
    {
        Description = description;
        // Use method name for DisplayName (not description with placeholders)
        // Placeholders are substituted in output, not in Test Explorer
        DisplayName = "Rule Outline: " + testMethodName.Replace("_", " ");
    }

    /// <summary>
    /// Gets the display name for this rule outline with values substituted.
    /// </summary>
    public string GetDisplayName(MethodInfo method, IReadOnlyDictionary<string, object?> paramValues)
    {
        if (!string.IsNullOrEmpty(Description))
        {
            // Replace <paramName> with actual values
            return System.Text.RegularExpressions.Regex.Replace(
                Description, 
                @"<([^>]+)>", 
                match =>
                {
                    var paramName = match.Groups[1].Value;
                    if (paramValues.TryGetValue(paramName, out var value))
                    {
                        return value?.ToString() ?? "";
                    }
                    return match.Value;
                });
        }

        // Use method name with _ALLCAPS placeholder replacement
        return SweDevTools.LiveDoc.xUnit.Core.ValueParser.FormatMethodNameWithValues(method.Name, paramValues);
    }
}
