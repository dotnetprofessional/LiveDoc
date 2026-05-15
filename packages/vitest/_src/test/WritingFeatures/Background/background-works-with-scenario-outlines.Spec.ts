import { expect } from "vitest";
import { feature, scenarioOutline, background, given, when, Then as then } from "../../../app/livedoc";

feature(`Backgrounds with Scenario Outlines
    @writing-features @background @scenario-outline
    Background steps run before every scenario-outline example, so each row
    starts from the same shared setup.
    `, () => {
    let balance = 0;

    background("Each example starts with account balance '100' dollars", () => {
        given("the account balance is '100' dollars", (ctx) => {
            balance = ctx.step.values[0];
        });
    });

    scenarioOutline(`Each Examples row uses a fresh background balance
        Examples:
        | withdrawal | expectedBalance |
        |         10 |              90 |
        |         25 |              75 |
        |         40 |              60 |
        `, () => {
        when("the customer withdraws <withdrawal> dollars", (ctx) => {
            balance -= ctx.example.withdrawal;
        });

        then("the account balance should be <expectedBalance> dollars", (ctx) => {
            expect(balance).toBe(ctx.example.expectedBalance);
        });
    });
});
