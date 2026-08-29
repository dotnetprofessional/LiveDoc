import { expect } from "vitest";
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Include filters omit non-matching LiveDoc output
    @dynamic @filtering
    Include filters select matching documentation nodes and leave non-matching
    features, scenarios, and rules out of the SDK output.
    `, () => {
    let results: ExecutionResults;
    let options: LiveDocOptions;
    let source: string;

    scenario("An include filter keeps only scenarios tagged with 'filter:include'", () => {
        given("the include filter is 'filter:include'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.include = ctx.step.valuesRaw;
        });

        and(`the feature has matching and non-matching scenarios
            """
            feature("Filtered checkout behavior", () => {
                scenario(\`included scenario
                    @filter:include
                    \`, () => {
                    given("an included precondition", () => {});
                });

                scenario("omitted scenario", () => {
                    given("a non-matching precondition", () => {
                        throw new Error("The omitted scenario should not run");
                    });
                });

                scenario(\`another included scenario
                    @filter:include
                    \`, () => {
                    given("another included precondition", () => {});
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the feature is executed with the include filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the output contains '1' feature named 'Filtered checkout behavior'", (ctx) => {
            expect(results.features).toHaveLength(ctx.step.values[0]);
            expect(results.features[0].title).toBe(ctx.step.valuesRaw[1]);
        });

        and("the remaining scenarios are 'included scenario' and 'another included scenario'", (ctx) => {
            expect(results.features[0].scenarios.map(scenario => scenario.title)).toEqual(ctx.step.valuesRaw);
        });
    });

    scenario("An include filter on a feature keeps every scenario in that feature", () => {
        given("the include filter is 'filter:include'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.include = ctx.step.valuesRaw;
        });

        and(`one feature is tagged and one feature is untagged
            """
            feature(\`Tagged feature
                @filter:include
                \`, () => {
                scenario("first inherited scenario", () => {
                    given("a first inherited precondition", () => {});
                });

                scenario("second inherited scenario", () => {
                    given("a second inherited precondition", () => {});
                });
            });

            feature("Untagged feature", () => {
                scenario("omitted scenario", () => {
                    given("a non-matching precondition", () => {
                        throw new Error("The omitted feature should not run");
                    });
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the features are executed with the include filter", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the output contains '1' feature named 'Tagged feature'", (ctx) => {
            expect(results.features).toHaveLength(ctx.step.values[0]);
            expect(results.features[0].title).toBe(ctx.step.valuesRaw[1]);
        });

        and("the remaining scenarios are 'first inherited scenario' and 'second inherited scenario'", (ctx) => {
            expect(results.features[0].scenarios.map(scenario => scenario.title)).toEqual(ctx.step.valuesRaw);
        });
    });

    scenario("An include filter with no matches returns '0' features", () => {
        given("the include filter is 'filter:missing'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.include = ctx.step.valuesRaw;
        });

        and(`no feature or scenario has the included tag
            """
            feature("Untagged feature", () => {
                scenario("omitted scenario", () => {
                    given("a non-matching precondition", () => {
                        throw new Error("No matching scenario should run");
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
});
