import { expect } from "vitest";
import * as Utils from "../../Utils";
import { feature, scenario, background, given, when, Then as then } from "../../../app/livedoc";

feature(`Async background steps
    @writing-features @background @async
    Background steps may await asynchronous setup before each scenario runs.
    `, () => {
    let balance = 0;

    background("Each scenario asynchronously loads account balance '100' dollars", () => {
        given("the account balance is loaded as '100' dollars", async (ctx) => {
            await Utils.sleep(10);
            balance = ctx.step.values[0];
        });
    });

    scenario("The first scenario waits for async background setup", () => {
        when("the customer withdraws '10' dollars", (ctx) => {
            balance -= ctx.step.values[0];
        });

        then("the account balance should be '90' dollars", (ctx) => {
            expect(balance).toBe(ctx.step.values[0]);
        });
    });

    scenario("The second scenario also waits for async background setup", () => {
        when("the customer withdraws '25' dollars", (ctx) => {
            balance -= ctx.step.values[0];
        });

        then("the account balance should be '75' dollars", (ctx) => {
            expect(balance).toBe(ctx.step.values[0]);
        });
    });
});
