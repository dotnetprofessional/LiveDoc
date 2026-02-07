using LiveDoc.xUnit;
using LiveDoc.xUnit.Core;
using Xunit.Abstractions;

namespace LiveDoc.xUnit.Tests.Gherkin.Feature;

/// <summary>
/// Specification: Feature Statement
/// 
/// Tests for the [Feature] attribute and Feature context.
/// Validates that features properly capture and expose their metadata.
/// </summary>
[Specification]
public class Feature_Statement_Spec : SpecificationTest
{
    public Feature_Statement_Spec(ITestOutputHelper output) : base(output)
    {
    }

    #region Attribute Properties

    [Rule("Feature attribute can be applied to a class")]
    public void Feature_attribute_can_be_applied()
    {
        var attr = typeof(SampleFeatureTests)
            .GetCustomAttributes(typeof(FeatureAttribute), false)
            .FirstOrDefault() as FeatureAttribute;
        
        Assert.NotNull(attr);
    }

    [Rule("Feature name defaults to class name with underscores replaced")]
    public void Feature_name_defaults_to_class_name()
    {
        var attr = typeof(Sample_Feature_Tests)
            .GetCustomAttributes(typeof(FeatureAttribute), false)
            .FirstOrDefault() as FeatureAttribute;
        
        Assert.NotNull(attr);
        var displayName = attr!.GetDisplayName(typeof(Sample_Feature_Tests));
        Assert.Equal("Sample Feature Tests", displayName);
    }

    [Rule("Feature name can be explicitly set")]
    public void Feature_name_can_be_set()
    {
        var attr = typeof(NamedFeatureTests)
            .GetCustomAttributes(typeof(FeatureAttribute), false)
            .FirstOrDefault() as FeatureAttribute;
        
        Assert.NotNull(attr);
        Assert.Equal("User Authentication", attr!.Name);
    }

    [Rule("Feature can have a description")]
    public void Feature_can_have_description()
    {
        var attr = typeof(DescribedFeatureTests)
            .GetCustomAttributes(typeof(FeatureAttribute), false)
            .FirstOrDefault() as FeatureAttribute;
        
        Assert.NotNull(attr?.Description);
        Assert.Contains("detailed description", attr!.Description);
    }

    [Rule("Feature can have tags")]
    public void Feature_can_have_tags()
    {
        var tags = TagAttribute.GetTags(typeof(TaggedFeatureTests));
        
        Assert.Contains("smoke", tags);
        Assert.Contains("regression", tags);
    }

    #endregion

    #region Context Access

    [Rule("Specification context is accessible")]
    public void Specification_context_is_accessible()
    {
        // SpecificationTest provides Specification property (equivalent to Feature)
        var specification = this.Specification;
        
        Assert.NotNull(specification);
    }

    #endregion
}

#region Test Fixtures

[Feature]
public class SampleFeatureTests : FeatureTest
{
    public SampleFeatureTests(ITestOutputHelper output) : base(output) { }
}

[Feature]
public class Sample_Feature_Tests : FeatureTest
{
    public Sample_Feature_Tests(ITestOutputHelper output) : base(output) { }
}

[Feature("User Authentication")]
public class NamedFeatureTests : FeatureTest
{
    public NamedFeatureTests(ITestOutputHelper output) : base(output) { }
}

[Feature(Description = "This is a detailed description of the feature.")]
public class DescribedFeatureTests : FeatureTest
{
    public DescribedFeatureTests(ITestOutputHelper output) : base(output) { }
}

[Tag("smoke, regression")]
[Feature]
public class TaggedFeatureTests : FeatureTest
{
    public TaggedFeatureTests(ITestOutputHelper output) : base(output) { }
}

#endregion
