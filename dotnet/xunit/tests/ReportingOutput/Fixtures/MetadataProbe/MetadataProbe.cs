using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

[assembly: TestFramework("SweDevTools.LiveDoc.xUnit.LiveDocTestFramework", "livedoc-xunit")]

namespace SweDevTools.LiveDoc.xUnit.Tests.ReportingOutput.Fixtures.MetadataProbe;

[Tag("feature-class")]
[Feature("Checkout Feature Attribute", Description = "Feature description from attribute")]
public class Checkout_Feature_Metadata_Spec : FeatureTest
{
    public Checkout_Feature_Metadata_Spec(ITestOutputHelper output) : base(output) { }

    [Tag("scenario-method")]
    [Scenario("Scenario attribute sends <customer:retail> metadata", Description = "Scenario description from attribute")]
    public void Scenario_attribute_without_steps()
    {
        Assert.True(true);
    }

    [Tag("gwt-method")]
    [Scenario("Given When Then steps send metadata", Description = "Given/When/Then description from attribute")]
    public void Scenario_with_gwt_steps()
    {
        var itemCount = 0;
        var shippingMethod = "";

        Given("a cart with <items:2> items", ctx =>
        {
            itemCount = ctx.Step!.Params["items"].AsInt();
        });

        When("shipping method is <method:ground>", ctx =>
        {
            shippingMethod = ctx.Step!.Params["method"].AsString();
        });

        Then("the cart has '2' items", ctx =>
        {
            Assert.Equal(ctx.Step!.Values[0].AsInt(), itemCount);
        });

        And("shipping method remains <method:ground>", ctx =>
        {
            Assert.Equal(ctx.Step!.Params["method"].AsString(), shippingMethod);
        });

        But("shipping method is not <method:air>", ctx =>
        {
            Assert.NotEqual(ctx.Step!.Params["method"].AsString(), shippingMethod);
        });
    }

    [Tag("scenario-outline-method")]
    [ScenarioOutline("Scenario outline sends '<value>' metadata", Description = "Scenario outline description from attribute")]
    [Example("retail")]
    public void Scenario_outline_without_steps(string value)
    {
        Assert.Equal("retail", value);
    }
}

[Tag("spec-class")]
[Specification("Rule Specification Attribute", Description = "Specification description from attribute")]
public class Rule_Specification_Metadata_Spec : SpecificationTest
{
    public Rule_Specification_Metadata_Spec(ITestOutputHelper output) : base(output) { }

    [Tag("rule-method")]
    [Rule("Rule attribute sends <threshold:42> metadata")]
    public void Rule_attribute_without_context()
    {
        Assert.True(true);
    }

    [Tag("rule-context-method")]
    [Rule("Rule context extracts <limit:7> and sends metadata")]
    public void Rule_context_sends_metadata()
    {
        Assert.Equal(7, Rule.Params["limit"].AsInt());
    }

    [Tag("rule-outline-method")]
    [RuleOutline("Rule outline sends '<value>' metadata")]
    [Example(42)]
    [Example(100)]
    public void Rule_outline_sends_metadata(int value)
    {
        Assert.True(value > 0);
    }
}
