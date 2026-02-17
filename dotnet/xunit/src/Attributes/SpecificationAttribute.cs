using Xunit;
using Xunit.Sdk;

namespace SweDevTools.LiveDoc.xUnit;

/// <summary>
/// Marks a test class as a Specification (MSpec-style container).
/// An alternative to [Feature] for more technical/unit-level tests.
/// </summary>
/// <example>
/// <code>
/// // Title derived from class name (preferred when class name is descriptive)
/// [Specification]
/// public class Calculator_Operations : SpecificationTest
/// {
///     [Rule]
///     public void Adding_positive_numbers_increases_the_value()
///     {
///         Assert.Equal(8, Calculator.Add(5, 3));
///     }
/// }
/// 
/// // Explicit title (use only when class name differs or for binding)
/// [Specification("Calculator Operations")]
/// public class CalcSpec : SpecificationTest { }
/// </code>
/// </example>
[TraitDiscoverer(SpecificationDiscoverer.DiscovererTypeName, SpecificationDiscoverer.AssemblyName)]
[AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
public class SpecificationAttribute : Attribute, ITraitAttribute
{
    /// <summary>
    /// The specification title. If null, derived from class name.
    /// </summary>
    public string? Title { get; }

    /// <summary>
    /// Optional description providing additional context.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Creates a specification. Title is derived from the class name.
    /// </summary>
    public SpecificationAttribute()
    {
        Title = null;
    }

    /// <summary>
    /// Creates a specification with the given title.
    /// </summary>
    /// <param name="title">The specification title.</param>
    public SpecificationAttribute(string title)
    {
        Title = title;
    }

    /// <summary>
    /// Gets the display name, using the title or falling back to formatted class name.
    /// </summary>
    public string GetDisplayName(Type testClass)
    {
        return !string.IsNullOrEmpty(Title) 
            ? Title 
            : FeatureAttribute.FormatName(testClass.Name);
    }
}
