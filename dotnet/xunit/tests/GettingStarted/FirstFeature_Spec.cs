using Xunit.Abstractions;

namespace SweDevTools.LiveDoc.xUnit.Tests.GettingStarted;

[Feature("First Feature", Description = @"
    A minimal BDD example that shows how a feature, scenario, and
    self-documenting Given/When/Then steps become executable documentation.")]
public class FirstFeature_Spec : FeatureTest
{
    public FirstFeature_Spec(ITestOutputHelper output) : base(output) { }

    [Scenario("A customer receives free shipping when the order total reaches the threshold")]
    public void Customer_receives_free_shipping_at_threshold()
    {
        decimal freeShippingThreshold = 0;
        decimal orderTotal = 0;
        string shippingRate = "";

        Given("the free shipping threshold is '100.00' dollars", ctx =>
        {
            freeShippingThreshold = ctx.Step!.Values[0].AsDecimal();
        });

        When("the customer order total is '101.00' dollars", ctx =>
        {
            orderTotal = ctx.Step!.Values[0].AsDecimal();
            shippingRate = orderTotal == freeShippingThreshold ? "Free" : "Standard";
        });

        Then("the shipping rate is 'Free'", ctx =>
        {
            Assert.Equal(ctx.Step!.Values[0].AsString(), shippingRate);
        });
    }
}
