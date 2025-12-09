import { expect } from "chai";
import { feature, scenario, given, and, when, Then as then } from "@livedoc/vitest";

feature(`Calculator basics

    Validates a minimal @livedoc/vitest setup when installed from a local tarball.
    `, () => {
    scenario("Adding two numbers", () => {
        let first: number;
        let second: number;
        let result: number;

        given("a first number '2'", (ctx) => {
            first = ctx.step.values[0];
        });

        and("a second number '3'", (ctx) => {
            second = ctx.step.values[0];
        });

        when("the numbers are added", () => {
            result = first + second;
        });

        then("the result should be '5'", (ctx) => {
            expect(result).to.equal(ctx.step.values[0]);
        });
    });
});
