import { expect } from "vitest";
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Specification filters omit non-matching rules
    @dynamic @filtering @specifications
    Tag filtering applies to MSpec-style specifications as well as BDD
    features, so filtered rules do not appear as pending documentation.
    `, () => {
    let results: ExecutionResults;
    let options: LiveDocOptions;
    let source: string;

    scenario("An include filter keeps only rules tagged with 'filter:include'", () => {
        given("the include filter is 'filter:include'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.include = ctx.step.valuesRaw;
        });

        and(`the specification has matching and non-matching rules
            """
            specification("Filtered calculator rules", () => {
                rule(\`included rule
                    @filter:include
                    \`, () => {});

                rule("omitted rule", () => {
                    throw new Error("The omitted rule should not run");
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the specification is executed with the include filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the output contains '1' specification named 'Filtered calculator rules'", (ctx) => {
            expect(results.specifications).toHaveLength(ctx.step.values[0]);
            expect(results.specifications[0].title).toBe(ctx.step.valuesRaw[1]);
        });

        and("the remaining rule is 'included rule'", (ctx) => {
            expect(results.specifications[0].rules.map(rule => rule.title)).toEqual(ctx.step.valuesRaw);
        });
    });

    scenario("An exclude filter removes rules tagged with 'filter:exclude'", () => {
        given("the exclude filter is 'filter:exclude'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.exclude = ctx.step.valuesRaw;
        });

        and(`the specification has excluded and remaining rules
            """
            specification("Excluded calculator rules", () => {
                rule(\`omitted rule
                    @filter:exclude
                    \`, () => {
                    throw new Error("The excluded rule should not run");
                });

                rule("remaining rule", () => {});
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the specification is executed with the exclude filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the remaining rule is 'remaining rule'", (ctx) => {
            expect(results.specifications[0].rules.map(rule => rule.title)).toEqual(ctx.step.valuesRaw);
        });
    });
});
