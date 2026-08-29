import { expect } from "vitest";
import { feature, scenario, given, when, Then as then, and } from "../../../app/livedoc";

type Checkout = {
    customer: string;
    cartTotal: number;
    shipping: number;
};

feature(`Step statements
    @writing-features @steps
    Steps describe the setup, action, and expected outcome of a scenario.
    Values that matter to readers should appear in the step text, tables, or
    doc strings and be read through ctx.step.
    `, () => {
    scenario("Given, When, Then, and And steps tell one complete flow", () => {
        let balance = 0;

        given("an account balance of '100' dollars", (ctx) => {
            balance = ctx.step.values[0];
        });

        when("the customer withdraws '25' dollars", (ctx) => {
            balance -= ctx.step.values[0];
        });

        then("the account balance should be '75' dollars", (ctx) => {
            expect(balance).toBe(ctx.step.values[0]);
        });

        and("the balance should remain above the minimum '0' dollars", (ctx) => {
            expect(balance).toBeGreaterThan(ctx.step.values[0]);
        });
    });

    scenario("Doc strings make multi-line payloads visible", () => {
        let requestPayload = "";

        given(`this checkout request payload:
            """
            {
              "customer": "Ada",
              "cartTotal": 125
            }
            """`, (ctx) => {
            requestPayload = ctx.step.docString;
        });

        when("the request payload is parsed", () => {
            requestPayload = JSON.stringify(JSON.parse(requestPayload), null, 2);
        });

        then(`the normalized payload should be:
            """
            {
              "customer": "Ada",
              "cartTotal": 125
            }
            """`, (ctx) => {
            expect(requestPayload).toBe(ctx.step.docString);
        });
    });

    scenario("Data tables make structured setup visible", () => {
        let checkout: Checkout;

        given(`this checkout context:
            | customer  | Ada |
            | cartTotal | 125 |
            | shipping  | 0   |
            `, (ctx) => {
            checkout = ctx.step.tableAsEntity as Checkout;
        });

        when("the checkout context is read from ctx.step.tableAsEntity", () => {
            checkout = { ...checkout };
        });

        then("the customer should be 'Ada'", (ctx) => {
            expect(checkout.customer).toBe(ctx.step.valuesRaw[0]);
        });

        and("the cart total should be '125' dollars", (ctx) => {
            expect(checkout.cartTotal).toBe(ctx.step.values[0]);
        });

        and("the shipping charge should be '0' dollars", (ctx) => {
            expect(checkout.shipping).toBe(ctx.step.values[0]);
        });
    });
});
