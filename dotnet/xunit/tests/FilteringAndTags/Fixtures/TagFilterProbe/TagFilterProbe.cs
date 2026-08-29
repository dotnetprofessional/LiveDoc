using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

[assembly: TestFramework("SweDevTools.LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]

namespace SweDevTools.LiveDoc.xUnit.Tests.FilteringAndTags.Fixtures.TagFilterProbe;

[Tag("feature-scope")]
[Feature("Tag Filter Feature Class")]
public class Feature_Class_Tag_Probe : FeatureTest
{
    public Feature_Class_Tag_Probe(ITestOutputHelper output) : base(output) { }

    [Scenario("Feature class category is discoverable")]
    public void Feature_class_category() { }
}

[Feature("Tag Filter Feature Methods")]
public class Feature_Method_Tag_Probe : FeatureTest
{
    public Feature_Method_Tag_Probe(ITestOutputHelper output) : base(output) { }

    [Tag("scenario-scope")]
    [Scenario("Scenario category is discoverable")]
    public void Scenario_category() { }

    [Tag("scenario-outline-scope")]
    [ScenarioOutline("Scenario outline category '<value>' is discoverable")]
    [Example("first")]
    [Example("second")]
    public void Scenario_outline_category(string value)
    {
        Assert.NotEmpty(value);
    }
}

[Tag("specification-scope")]
[Specification("Tag Filter Specification Class")]
public class Specification_Class_Tag_Probe : SpecificationTest
{
    public Specification_Class_Tag_Probe(ITestOutputHelper output) : base(output) { }

    [Rule("Specification class category is discoverable")]
    public void Specification_class_category() { }
}

[Specification("Tag Filter Specification Methods")]
public class Specification_Method_Tag_Probe : SpecificationTest
{
    public Specification_Method_Tag_Probe(ITestOutputHelper output) : base(output) { }

    [Tag("rule-scope")]
    [Rule("Rule category is discoverable")]
    public void Rule_category() { }

    [Tag("rule-outline-scope")]
    [RuleOutline("Rule outline category '<value>' is discoverable")]
    [Example("first")]
    [Example("second")]
    public void Rule_outline_category(string value)
    {
        Assert.NotEmpty(value);
    }

    [Rule("Unselected rule remains hidden")]
    public void Unselected_rule() { }
}
