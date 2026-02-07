using LiveDoc.xUnit;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Specification;

/// <summary>
/// Specification: Specification Attribute
/// 
/// Tests for the [Specification] class-level attribute.
/// </summary>
[Specification("Specification Attribute", Description = @"
    The [Specification] attribute marks a test class as a specification container.
    It provides a title and optional description and tags.
")]
public class Specification_Attribute_Spec : SpecificationTest
{
    public Specification_Attribute_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule]
    public void Specification_provides_grouping()
    {
        // Verify the class is recognized as a specification
        var specAttr = typeof(Specification_Attribute_Spec)
            .GetCustomAttributes(typeof(SpecificationAttribute), false)
            .FirstOrDefault() as SpecificationAttribute;
        
        Assert.NotNull(specAttr);
        Assert.Equal("Specification Attribute", specAttr!.Title);
    }

    [Rule]
    public void Specification_can_have_description()
    {
        var specAttr = typeof(Specification_Attribute_Spec)
            .GetCustomAttributes(typeof(SpecificationAttribute), false)
            .FirstOrDefault() as SpecificationAttribute;
        
        Assert.NotNull(specAttr?.Description);
        Assert.Contains("specification container", specAttr!.Description);
    }
}
