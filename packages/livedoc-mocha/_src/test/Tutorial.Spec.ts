
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

feature(`Feature: Beautiful Tea Shipping Costs

    * Australian customers pay GST
    * Overseas customers don’t pay GST
    * Australian customers get free shipping for orders $100 and above
    * Overseas customers all pay the same shipping rate regardless of order size`, () => {

        scenarioOutline(`Calculate GST status and shipping rate

            Examples:

            | customer’s country  | GSTamount  | order total  | shipping rate           |
            | Australia           |      9.999 |        99.99 | Standard Domestic       |
            | Australia           |      10.00 |       100.00 | Free                    |
            | New Zealand         |          0 |        99.99 | Standard International  |
            | New Zealand         |          0 |       100.00 | Standard International  |
            | Zimbabwe            |          0 |       100.00 | Standard International  |
        `, () => {
                const cart = new ShoppingCart();

                given("the customer is from <customer’s country>", () => {
                    cart.country = scenarioOutlineContext.example["customer’s country"];
                });

                when("the customer’s order totals <order total>", () => {
                    const item = new CartItem();
                    item.quantity = 1;
                    item.price = scenarioOutlineContext.example["order total"];
                    item.product = "tea";
                    cart.items.push(item);
                    cart.calculateInvoice();
                });

                then("the customer <pays GST>", () => {
                    cart.gst.should.be.equal(Number(scenarioOutlineContext.example.GSTamount);
                });

                and("they are charged <shipping rate>", () => {
                    const rate = shippingRates[scenarioOutlineContext.example["shipping rate"].replace(" ", "")];
                    cart.shipping.should.be.equal(rate);
                });
            });
    });
