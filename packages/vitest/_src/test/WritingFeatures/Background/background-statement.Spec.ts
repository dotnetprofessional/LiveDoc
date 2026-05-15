import { expect } from "vitest";
import { feature, scenario, background, given, when, Then as then } from "../../../app/livedoc";

feature(`Background statements
    @writing-features @background
    Background steps run before each scenario, keeping shared setup visible
    without repeating it in every scenario body.
    `, () => {
    let balance = 0;

    background("Each scenario starts with account balance '100' dollars", () => {
        given("the account balance is '100' dollars", (ctx) => {
            balance = ctx.step.values[0];
        });
    });

    scenario("Withdrawing 10 dollars uses the background balance", () => {
        when("the customer withdraws '10' dollars", (ctx) => {
            balance -= ctx.step.values[0];
        });

        then("the account balance should be '90' dollars", (ctx) => {
            expect(balance).toBe(ctx.step.values[0]);
        });
    });

    scenario("Withdrawing 25 dollars starts from the same background balance", () => {
        when("the customer withdraws '25' dollars", (ctx) => {
            balance -= ctx.step.values[0];
        });

        then("the account balance should be '75' dollars", (ctx) => {
            expect(balance).toBe(ctx.step.values[0]);
        });
    });
});
