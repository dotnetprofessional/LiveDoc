/*
const shippingRates = {
    Free: 0,
    StandardDomestic: 5,
    StandardInternational: 15,
}

class ShoppingCart {
    public items: CartItem[];

    public country: string;

    public get orderTotal() {
        let total: number = 0;
        this.items.forEach(item => {
            total += item.quantity * item.price;
        });

        return total;
    }
    private calculateInvoice() {
        var orderTotal = this.orderTotal;
        if (this.country === "Australia") {
            this.gst = orderTotal * 0.10;
            if (this.orderTotal > 100) {
                this.shipping = shippingRates.Free;
            }
            this.shipping = shippingRates.StandardDomestic;
        } else {
            this.gst = 0;
            this.shipping = shippingRates.StandardInternational;
        }
    }

    public gst: number;
    public shipping: number;
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

        | customer’s country| pays GST | order total| shipping rate          |
        | Australia         | Must     |     $99.99 | Standard Domestic      |
        | Australia         | Must     |    $100.00 | Free                   |
        | New Zealand       | Must Not |     $99.99 | Standard International |
        | New Zealand       | Must Not |    $100.00 | Standard International |
        | Zimbabwe          | Must Not |    $100.00 | Standard International |
        `, () => {
                const cart = new ShoppingCart();

                given("the customer is from <customer’s country>", () => {
                    console.log(scenarioOutlineContext.example["customer’s country"]);
                    console.log(scenarioOutlineContext.example["order total"]);
                    //cart.country = scenarioOutlineContext.example
                });

                when("the customer’s order totals <order total>", () => {

                });

                then("the customer <pays GST>", () => {

                });

                and("they are charged <shipping rate>", () => {

                });
            });
    });
*/