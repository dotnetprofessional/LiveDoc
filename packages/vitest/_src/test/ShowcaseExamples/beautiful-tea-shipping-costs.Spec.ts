import { expect } from "vitest";
import { feature, scenarioOutline, background, given, when, Then as then, and } from "../../app/livedoc";

type ShippingRate = "Free" | "StandardDomestic" | "StandardInternational";

const shippingRates: Record<ShippingRate, number> = {
    Free: 0,
    StandardDomestic: 5,
    StandardInternational: 15,
};

const shippingRateNames: Record<string, ShippingRate> = {
    Free: "Free",
    "Standard Domestic": "StandardDomestic",
    "Standard International": "StandardInternational",
};

class CartItem {
    constructor(
        public product: string,
        public quantity: number,
        public price: number
    ) {
    }
}

class ShoppingCart {
    public items: CartItem[] = [];
    public country = "";
    public gst = 0;
    public shipping = 0;

    public get orderTotal(): number {
        return this.items.reduce((total, item) => total + item.quantity * item.price, 0);
    }

    public calculateInvoice(): void {
        if (this.country === "Australia") {
            this.shipping = this.orderTotal >= 100 ? shippingRates.Free : shippingRates.StandardDomestic;
            this.gst = this.orderTotal * 0.10;
            return;
        }

        this.gst = 0;
        this.shipping = shippingRates.StandardInternational;
    }
}

feature(`Beautiful Tea Shipping Costs
    @showcase @public-doc @shipping

    * Australian customers pay GST
    * Overseas customers do not pay GST
    * Australian customers get free shipping for orders $100 and above
    * Overseas customers all pay the same shipping rate regardless of order size
    `, () => {
    background("Shipping rates are configured before each example", () => {
        given(`these shipping rates are available:
            | name                   | amount |
            | Free                   |      0 |
            | Standard Domestic      |      5 |
            | Standard International |     15 |
            `, (ctx) => {
            for (const rate of ctx.step.table) {
                const shippingRateName = shippingRateNames[rate.name as string];
                expect(shippingRates[shippingRateName]).toBe(rate.amount);
            }
        });
    });

    scenarioOutline(`Calculate GST status and shipping rate

        Examples:

        | Customer's Country | GST Amount | Order Total |     Shipping Rate      |
        | Australia          |      9.999 |       99.99 | Standard Domestic      |
        | Australia          |      10.00 |      100.00 | Free                   |
        | New Zealand        |          0 |       99.99 | Standard International |
        | New Zealand        |          0 |      100.00 | Standard International |
        | Zimbabwe           |          0 |      100.00 | Standard International |
        `, () => {
        const cart = new ShoppingCart();

        given("the customer is from <Customer's Country>", (ctx) => {
            cart.country = ctx.example.CustomersCountry;
        });

        when("the customer's order totals <Order Total>", (ctx) => {
            cart.items.push(new CartItem("tea", 1, ctx.example.OrderTotal));
            cart.calculateInvoice();
        });

        then("the customer pays <GST Amount> GST", (ctx) => {
            expect(cart.gst).toBe(ctx.example.GSTAmount);
        });

        and("they are charged the <Shipping Rate> shipping rate", (ctx) => {
            const shippingRateName = shippingRateNames[ctx.example.ShippingRate];
            expect(cart.shipping).toBe(shippingRates[shippingRateName]);
        });
    });
});
