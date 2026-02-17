using System;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Adds tags to a LiveDoc test class or test method for filtering and categorization.
/// Tags are merged from class and method levels.
/// </summary>
/// <remarks>
/// Can be applied to:
/// - Classes with [Feature] or [Specification] — tags apply to all tests in the class
/// - Methods with [Scenario], [ScenarioOutline], [Rule], or [RuleOutline] — tags apply to that test
/// 
/// Multiple [Tag] attributes can be stacked, and each can contain comma-separated values.
/// </remarks>
/// <example>
/// <code>
/// [Tag("smoke, regression")]
/// [Feature]
/// public class ShoppingCartSpec : FeatureTest
/// {
///     [Tag("checkout")]
///     [Scenario("Add item to cart")]
///     public void Add_item() { ... }
///     
///     [Tag("slow")]
///     [Tag("integration")]
///     [ScenarioOutline("Calculate shipping")]
///     public void Calculate_shipping() { ... }
/// }
/// </code>
/// </example>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class TagAttribute : Attribute
{
    /// <summary>
    /// The parsed tag values.
    /// </summary>
    public string[] Tags { get; }

    /// <summary>
    /// Creates a tag attribute with one or more comma-separated tags.
    /// </summary>
    /// <param name="tags">Comma-separated tag values (e.g., "smoke, regression").</param>
    public TagAttribute(string tags)
    {
        Tags = (tags ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    /// <summary>
    /// Collects all tags from [Tag] attributes on a type and/or method.
    /// Class-level tags are merged with method-level tags.
    /// </summary>
    public static string[] GetTags(Type testClassType, System.Reflection.MethodInfo? testMethod = null)
    {
        var tags = new List<string>();

        // Collect class-level tags
        foreach (var attr in testClassType.GetCustomAttributes(typeof(TagAttribute), true))
        {
            tags.AddRange(((TagAttribute)attr).Tags);
        }

        // Collect method-level tags
        if (testMethod != null)
        {
            foreach (var attr in testMethod.GetCustomAttributes(typeof(TagAttribute), true))
            {
                tags.AddRange(((TagAttribute)attr).Tags);
            }
        }

        return tags.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }
}
