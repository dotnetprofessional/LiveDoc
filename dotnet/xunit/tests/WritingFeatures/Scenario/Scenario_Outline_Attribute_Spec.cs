using SweDevTools.LiveDoc.xUnit;
using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.WritingFeatures.Scenario;

/// <summary>
/// Specification: Scenario Outline Attribute
/// 
/// Unit tests for the [ScenarioOutline] attribute metadata.
/// </summary>
[Specification("Scenario Outline Attribute", Description = @"
    The [ScenarioOutline] attribute marks a method as a data-driven scenario.
    It supports descriptions, tags, and [Example] attributes that provide
    parameterized test data to the method.")]
public class Scenario_Outline_Attribute_Spec : SpecificationTest
{
    public Scenario_Outline_Attribute_Spec(ITestOutputHelper output) : base(output)
    {
    }

    [Rule]
    public void ScenarioOutline_attribute_can_have_description()
    {
        var method = typeof(Scenario_Outline_Attribute_Fixtures).GetMethod(nameof(Scenario_Outline_Attribute_Fixtures.Described_outline));
        var attr = method?.GetCustomAttributes(typeof(ScenarioOutlineAttribute), false)
            .FirstOrDefault() as ScenarioOutlineAttribute;
        
        Assert.NotNull(attr?.Description);
        Assert.Contains("data-driven", attr!.Description);
    }

    [Rule("ScenarioOutline attribute can have tags")]
    public void ScenarioOutline_can_have_tags()
    {
        var method = typeof(Scenario_Outline_Attribute_Fixtures).GetMethod(nameof(Scenario_Outline_Attribute_Fixtures.Tagged_outline));
        Assert.NotNull(method);
        
        var tags = TagAttribute.GetTags(typeof(Scenario_Outline_Attribute_Fixtures), method!);
        
        Assert.Contains("edge-cases", tags);
        Assert.Contains("boundary", tags);
    }

    [Rule("Example attribute can provide data to test methods")]
    public void Example_provides_data()
    {
        var method = typeof(Scenario_Outline_Attribute_Fixtures).GetMethod(nameof(Scenario_Outline_Attribute_Fixtures.With_examples));
        var examples = method?.GetCustomAttributes(typeof(ExampleAttribute), false)
            .Cast<ExampleAttribute>()
            .ToList();
        
        Assert.NotNull(examples);
        Assert.Equal(2, examples!.Count);
        
        // Each ExampleAttribute provides data via GetData
        var firstData = examples[0].GetData(method!).First();
        Assert.Equal(1, firstData[0]);
        Assert.Equal("one", firstData[1]);
        
        var secondData = examples[1].GetData(method!).First();
        Assert.Equal(2, secondData[0]);
        Assert.Equal("two", secondData[1]);
    }
}
