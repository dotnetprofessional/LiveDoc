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
    [Example("wholesale")]
    public void Scenario_outline_without_steps(string value)
    {
        Assert.Contains(value, new[] { "retail", "wholesale" });
    }

    [ScenarioOutline("Forward discount '<discountPercent>' keeps a fixed cart total")]
    [Example(100)]
    [Example(10)]
    public void Forward_discount_template(int discountPercent)
    {
        Given("a cart totaling '100.00'", () => { });
        And($"a fixed discount ceiling of '100' precedes a discount of '{discountPercent}'", () => { });
        When($"a discount of '{discountPercent}' percent is applied", () => { });
        Then("the cart remains valid", () => Assert.True(discountPercent > 0));
    }

    [ScenarioOutline("Reverse discount '<discountPercent>' keeps a fixed cart total")]
    [Example(10)]
    [Example(100)]
    public void Reverse_discount_template(int discountPercent)
    {
        Given("a cart totaling '100.00'", () => { });
        And($"a fixed discount ceiling of '100' precedes a discount of '{discountPercent}'", () => { });
        When($"a discount of '{discountPercent}' percent is applied", () => { });
        Then("the cart remains valid", () => Assert.True(discountPercent > 0));
    }

    [ScenarioOutline("Decimal tax rate '<rate>' uses the current culture")]
    [Example(1.5)]
    [Example(2.5)]
    public void Decimal_comma_template(decimal rate)
    {
        var originalCulture = System.Globalization.CultureInfo.CurrentCulture;
        try
        {
            System.Globalization.CultureInfo.CurrentCulture =
                System.Globalization.CultureInfo.GetCultureInfo("fr-FR");
            When($"a tax rate '{rate}' is applied", () => Assert.True(rate > 0));
        }
        finally
        {
            System.Globalization.CultureInfo.CurrentCulture = originalCulture;
        }
    }

    [ScenarioOutline("Equal parameter values preserve distinct '<a>' and '<b>' bindings")]
    [Example(1, 1)]
    [Example(2, 3)]
    public void Equal_parameter_values(int a, int b)
    {
        Then($"values '{a}' and '{b}' remain distinct", () => Assert.True(a > 0 && b > 0));
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
