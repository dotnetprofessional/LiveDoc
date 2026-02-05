require('chai').should();
import { feature, scenarioOutline, background, given, when, Then as then, and } from "../../../../app/livedoc";

const shippingRates = {
    Free: 0,
    StandardDomestic: 5,
    StandardInternational: 15,
}

class ShoppingCart {
    public items: CartItem[] = [];

    public country: string;

    public get orderTotal() {
        let total: number = 0;
        this.items.forEach(item => {
            total += item.quantity * item.price;
        });
        return total;
    }
    public calculateInvoice() {
        if (this.country === "Australia") {
            if (this.orderTotal >= 100) {
                this.shipping = shippingRates.Free;
            } else {
                this.shipping = shippingRates.StandardDomestic;
            }
            this.gst = this.orderTotal * 0.10;
        } else {
            this.gst = 0;
            this.shipping = shippingRates.StandardInternational;
        }
    }

    public gst: number = 0;
    public shipping: number = 0;
}

class CartItem {
    public quantity: number;
    public price: number;
    public product: string;
}

feature(`Beautiful Tea Shipping Costs

    * Australian customers pay GST
    * Overseas customers don't pay GST
    * Australian customers get free shipping for orders $100 and above
    * Overseas customers all pay the same shipping rate regardless of order size`, (ctx) => {

        background(``, () => {
            given(`my background test`, () => {

            });
        });

        scenarioOutline(`Calculate GST status and shipping rate

            Examples:

            | Customer's Country | GST Amount | Order Total |     Shipping Rate      |
            | Australia          |      9.999 |       99.99 | Standard Domestic      |
            | Australia          |      10.00 |      100.00 | Free                   |
            | New Zealand        |          0 |       99.99 | Standard International |
            | New Zealand        |          0 |      100.00 | Standard International |
            | Zimbabwe           |         10 |      100.00 | Standard International |
        `, (ctx) => {
                const cart = new ShoppingCart();

                given("the customer is from <Customer's Country>", (ctx) => {
                    cart.country = ctx.example.CustomersCountry;
                });

                when("the customer's order totals <Order Total>", (ctx) => {
                    const item = new CartItem();
                    item.quantity = 1;
                    item.price = ctx.example.OrderTotal;
                    item.product = "tea";
                    cart.items.push(item);
                    cart.calculateInvoice();

                });

                then("the customer pays <GST Amount> GST", (ctx) => {
                    cart.gst.should.be.equal(ctx.example.GSTAmount);
                });

                and("they are charged the <Shipping Rate> shipping rate", (ctx) => {
                    const rate = shippingRates[ctx.example.ShippingRate.replace(" ", "")];
                    cart.shipping.should.be.equal(rate);
                });
            });
    });
