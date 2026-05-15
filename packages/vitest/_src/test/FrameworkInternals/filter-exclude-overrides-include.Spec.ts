import { expect } from "vitest";
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Exclude filters override include filters
    @dynamic @filtering
    A test that matches both include and exclude is omitted by default so the
    published output only contains tests selected by the final filter decision.
    `, () => {
    let results: ExecutionResults;
    let options: LiveDocOptions;
    let source: string;

    scenario("A scenario with both 'filter:include' and 'filter:exclude' is omitted by default", () => {
        given("the include filter is 'filter:include'", (ctx) => {
            options = new LiveDocOptions();
            options.filters.include = ctx.step.valuesRaw;
        });

        and("the exclude filter is 'filter:exclude'", (ctx) => {
            options.filters.exclude = ctx.step.valuesRaw;
        });

        and(`one scenario is included and one scenario has conflicting tags
            """
            feature("Filter conflict behavior", () => {
                scenario(\`included scenario
                    @filter:include
                    \`, () => {
                    given("an included precondition", () => {});
                });

                scenario(\`conflicting scenario
                    @filter:include
                    @filter:exclude
                    \`, () => {
                    given("a conflicting precondition", () => {
                        throw new Error("The conflicting scenario should not run");
                    });
                });
            });
            """
            `, (ctx) => {
            source = ctx.step.docString;
        });

        when("the feature is executed with both filters", async () => {
            results = await LiveDoc.executeDynamicTestAsync(source, options);
        });

        then("the only remaining scenario is 'included scenario'", (ctx) => {
            expect(results.features[0].scenarios.map(scenario => scenario.title)).toEqual(ctx.step.valuesRaw);
        });
    });
});
