import { expect } from "vitest";
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Exclude filters omit matching LiveDoc output
    @dynamic @filtering
    Exclude filters prevent matching tests from executing and keep those
    filtered nodes out of the SDK output.
    `, () => {
    let results: ExecutionResults;
    let options: LiveDocOptions;
    let source: string;

    scenario("An exclude filter removes a feature tagged with 'filter:exclude'", () => {
        given("the exclude filter is 'filter:exclude'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.exclude = ctx.step.valuesRaw;
        });

        and(`one feature is excluded and one feature remains
            """
            feature(\`Excluded feature
                @filter:exclude
                \`, () => {
                scenario("omitted scenario", () => {
                    given("an excluded precondition", () => {
                        throw new Error("The excluded feature should not run");
                    });
                });
            });

            feature("Included feature", () => {
                scenario("remaining scenario", () => {
                    given("an included precondition", () => {});
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the features are executed with the exclude filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the output contains '1' feature named 'Included feature'", (ctx) => {
            expect(results.features).toHaveLength(ctx.step.values[0]);
            expect(results.features[0].title).toBe(ctx.step.valuesRaw[1]);
        });
    });

    scenario("An exclude filter removes only scenarios tagged with 'filter:exclude'", () => {
        given("the exclude filter is 'filter:exclude'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.exclude = ctx.step.valuesRaw;
        });

        and(`the feature has excluded and remaining scenarios
            """
            feature("Scenario filtering", () => {
                scenario(\`omitted scenario
                    @filter:exclude
                    \`, () => {
                    given("an excluded precondition", () => {
                        throw new Error("The excluded scenario should not run");
                    });
                });

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

        then("the output contains '1' feature named 'Scenario filtering'", (ctx) => {
            expect(results.features).toHaveLength(ctx.step.values[0]);
            expect(results.features[0].title).toBe(ctx.step.valuesRaw[1]);
        });

        and("the remaining scenario is 'remaining scenario'", (ctx) => {
            expect(results.features[0].scenarios.map(scenario => scenario.title)).toEqual(ctx.step.valuesRaw);
        });
    });

    scenario("An exclude filter removes a scenario outline tagged with 'filter:exclude'", () => {
        given("the exclude filter is 'filter:exclude'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.exclude = ctx.step.valuesRaw;
        });

        and(`the feature has one excluded outline and one remaining outline
            """
            feature("Scenario outline filtering", () => {
                scenarioOutline(\`omitted outline
                    @filter:exclude

                    Examples:
                    | value |
                    | skip  |
                    \`, () => {
                    given("an excluded '<value>' precondition", () => {
                        throw new Error("The excluded outline should not run");
                    });
                });

                scenarioOutline(\`remaining outline
                    Examples:
                    | value |
                    | keep  |
                    \`, () => {
                    given("an included '<value>' precondition", () => {});
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the feature is executed with the exclude filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the remaining scenario outline is 'remaining outline'", (ctx) => {
            expect(results.features[0].scenarios.map(scenario => scenario.title)).toEqual(ctx.step.valuesRaw);
        });
    });
});
