import { expect } from "vitest";
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Filters with no matches have no results
    @dynamic @filtering
    When no tag matches the active filter, LiveDoc should publish no matching
    documentation nodes instead of skipped or pending placeholders.
    `, () => {
    let results: ExecutionResults;
    let options: LiveDocOptions;
    let source: string;

    scenario("An include filter with no matching tags returns '0' features", () => {
        given("the include filter is 'filter:missing'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.include = ctx.step.valuesRaw;
        });

        and(`the feature has no matching tags
            """
            feature("Untagged feature", () => {
                scenario("omitted scenario", () => {
                    given("a non-matching precondition", () => {
                        throw new Error("The non-matching scenario should not run");
                    });
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the feature is executed with the include filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the output contains '0' features", (ctx) => {
            expect(results.features).toHaveLength(ctx.step.values[0]);
        });
    });

    scenario("An exclude filter with no matching tags keeps '1' feature", () => {
        given("the exclude filter is 'filter:missing'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.exclude = ctx.step.valuesRaw;
        });

        and(`the feature has no excluded tags
            """
            feature("Remaining feature", () => {
                scenario("remaining scenario", () => {
                    given("an included precondition", () => {});
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the feature is executed with the exclude filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the output contains '1' feature named 'Remaining feature'", (ctx) => {
            expect(results.features).toHaveLength(ctx.step.values[0]);
            expect(results.features[0].title).toBe(ctx.step.valuesRaw[1]);
        });
    });
});
