/**
 * Simple test to verify the LiveDoc DSL functions work correctly
 */

import { feature, scenario, given, when, Then as then, and } from "../../../app/livedoc";

feature("Basic Calculator", (ctx) => {
    scenario("Adding two numbers", (ctx) => {
        let result: number;

        given("I have entered 50 into the calculator", async (ctx) => {
            result = 50;
        });

        and("I have entered 70 into the calculator", async (ctx) => {
            result = result + 70;
        });

        when("I press add", async (ctx) => {
            // Addition happens above
        });

        then("the result should be 120", async (ctx) => {
            if (result !== 120) {
                throw new Error(`Expected 120 but got ${result}`);
            }
        });
    });
});
