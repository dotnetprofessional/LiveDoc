using SweDevTools.LiveDoc.xUnit;
using Xunit;
using Xunit.Abstractions;

namespace ShippingSample;

/// <summary>
/// Feature: Beautiful Tea Shipping Costs
/// 
/// Business Rules:
/// - Australian customers pay GST (10%)
/// - Overseas customers don't pay GST
/// - Australian customers get free shipping for orders $100 and above
/// - Overseas customers all pay the same shipping rate regardless of order size
/// </summary>
[Feature("Beautiful Tea Shipping Costs")]
public class ShippingCostsTests : FeatureTest
{
    private ShoppingCart _cart = null!;

    public ShippingCostsTests(ITestOutputHelper output) : base(output)
    {
    }

    [Scenario(nameof(Free_shipping_in_Australia))]
    public void Free_shipping_in_Australia()
    {
        this.Given("the customer is from Australia", () =>
        {
            _cart = new ShoppingCart { Country = "Australia" };
        });

        this.When("the customer's order totals $100", () =>
        {
            _cart.AddItem(new CartItem { Name = "Byron Breakfast Tea", Price = 100.00m });
            _cart.Calculate();
        });

        this.Then("the customer pays GST", () =>
        {
            Assert.Equal(10.00m, _cart.GST);
        });

        this.And("they are charged Free shipping", () =>
        {
            Assert.Equal(0, _cart.Shipping);
            Assert.Equal("Free", _cart.ShippingType);
        });
    }

    [Scenario(nameof(Standard_shipping_in_Australia_for_orders_under_100_dollars))]
    public void Standard_shipping_in_Australia_for_orders_under_100_dollars()
    {
        this.Given("the customer is from Australia", () =>
        {
            _cart = new ShoppingCart { Country = "Australia" };
        });

        this.When("the customer's order totals $99.99", () =>
        {
            _cart.AddItem(new CartItem { Name = "Byron Breakfast Tea", Price = 99.99m });
            _cart.Calculate();
        });

        this.Then("the customer pays GST", () =>
        {
            Assert.Equal(9.999m, Math.Round(_cart.GST, 3));
        });

        this.And("they are charged Standard Domestic shipping", () =>
        {
            Assert.Equal(9.95m, _cart.Shipping);
            Assert.Equal("Standard Domestic", _cart.ShippingType);
        });
    }

    [Scenario(nameof(International_shipping_for_overseas_customers))]
    public void International_shipping_for_overseas_customers()
    {
        this.Given("the customer is from New Zealand", () =>
        {
            _cart = new ShoppingCart { Country = "New Zealand" };
        });

        this.When("the customer's order totals $100", () =>
        {
            _cart.AddItem(new CartItem { Name = "Byron Breakfast Tea", Price = 100.00m });
            _cart.Calculate();
        });

        this.Then("the customer pays no GST", () =>
        {
            Assert.Equal(0, _cart.GST);
        });

        this.And("they are charged Standard International shipping", () =>
        {
            Assert.Equal(25.00m, _cart.Shipping);
            Assert.Equal("Standard International", _cart.ShippingType);
        });
    }

    [ScenarioOutline(nameof(Calculate_GST_and_shipping))]
    [Example("Australia", 99.99, 9.999, "Standard Domestic")]
    [Example("Australia", 100.00, 10.00, "Free")]
    [Example("New Zealand", 99.99, 0, "Standard International")]
    [Example("New Zealand", 100.00, 0, "Standard International")]
    [Example("Zimbabwe", 100.00, 0, "Standard International")]
    public void Calculate_GST_and_shipping(
        string CustomerCountry,
        decimal OrderTotal,
        decimal ExpectedGST,
        string ExpectedShippingRate)
    {
        this.Given("the customer is from <CustomerCountry>", () =>
        {
            _cart = new ShoppingCart { Country = CustomerCountry };
        });

        this.When("the customer's order totals <OrderTotal>", () =>
        {
            _cart.AddItem(new CartItem { Name = "Byron Breakfast Tea", Price = OrderTotal });
            _cart.Calculate();
        });

        this.Then("the customer pays <ExpectedGST> GST", () =>
        {
            Assert.Equal(ExpectedGST, Math.Round(_cart.GST, 3));
        });

        this.And("they are charged the <ExpectedShippingRate> shipping rate", () =>
        {
            Assert.Equal(ExpectedShippingRate, _cart.ShippingType);
        });
    }

    [Scenario("Async shipping calculation")]
    public async Task Async_shipping_test()
    {
        ShoppingCart? cart = null;

        await this.Given("a customer from Australia with $150 order", async () =>
        {
            await Task.Delay(10); // Simulate async setup
            cart = new ShoppingCart { Country = "Australia" };
            cart.AddItem(new CartItem { Name = "Byron Breakfast Tea", Price = 150.00m });
        });

        await this.When("we calculate shipping asynchronously", async () =>
        {
            await Task.Delay(5); // Simulate async calculation
            cart!.Calculate();
        });

        await this.Then("the shipping should be Free", async () =>
        {
            await Task.Delay(2); // Simulate async assertion
            Assert.Equal("Free", cart!.ShippingType);
        });

        this.And("GST should be calculated correctly", () =>
        {
            Assert.Equal(15.00m, cart!.GST);
        });
    }
}
