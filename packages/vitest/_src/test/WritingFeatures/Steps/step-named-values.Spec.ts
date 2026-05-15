import { expect } from "vitest";
import { feature, scenario, given, when, Then as then, and } from "../../../app/livedoc";

feature(`Named step values
    @writing-features @steps @named-values
    Named values use <name:value> syntax when a step reads better with labels
    than with positional quoted values.
    `, () => {
    scenario("Named values expose string and number parameters", () => {
        let params: Record<string, unknown>;

        given("a user with <name:John> and <age:30> years old", (ctx) => {
            params = ctx.step.params;
        });

        when("the named values are read from ctx.step.params", () => {
            params = { ...params };
        });

        then("params.name should be 'John'", (ctx) => {
            expect(params.name).toBe(ctx.step.valuesRaw[0]);
        });

        and("params.age should be '30'", (ctx) => {
            expect(params.age).toBe(ctx.step.values[0]);
        });
    });

    scenario("Named values support booleans, numbers, and arrays", () => {
        let params: Record<string, unknown>;

        given("a config with <active:true>, <count:10>, and <tags:[\"a\", \"b\"]>", (ctx) => {
            params = ctx.step.params;
        });

        when("the named values are type-coerced", () => {
            params = { ...params };
        });

        then("params.active should be 'true'", (ctx) => {
            expect(params.active).toBe(ctx.step.values[0]);
        });

        and("params.count should be '10'", (ctx) => {
            expect(params.count).toBe(ctx.step.values[0]);
        });

        and(`params.tags should be:
            """
            ["a","b"]
            """`, (ctx) => {
            expect(params.tags).toEqual(ctx.step.docStringAsEntity);
        });
    });

    scenario("Named and quoted values can be used together", () => {
        let params: Record<string, unknown>;
        let values: unknown[];

        given("a user 'John' with <age:30> and 'active' status", (ctx) => {
            params = ctx.step.params;
            values = ctx.step.values;
        });

        when("quoted values and named values are read from the same step", () => {
            values = [...values];
            params = { ...params };
        });

        then("the quoted values should be 'John' and 'active'", (ctx) => {
            expect(values).toEqual(ctx.step.valuesRaw);
        });

        and("params.age should be '30'", (ctx) => {
            expect(params.age).toBe(ctx.step.values[0]);
        });
    });

    scenario("Spaces in parameter names are removed", () => {
        let params: Record<string, unknown>;

        given("a user with <user name:John> and <user age:30>", (ctx) => {
            params = ctx.step.params;
        });

        when("the parameter names are normalized", () => {
            params = { ...params };
        });

        then("params.username should be 'John'", (ctx) => {
            expect(params.username).toBe(ctx.step.valuesRaw[0]);
        });

        and("params.userage should be '30'", (ctx) => {
            expect(params.userage).toBe(ctx.step.values[0]);
        });
    });
});
