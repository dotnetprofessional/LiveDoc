import { ExecutionResults } from "../../app/model";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { LiveDoc } from "../../app/livedoc";
import { feature, scenario, Given, When, Then, And } from "../../app/livedoc";
import * as chai from 'chai';

chai.should();

// Vitest doesn't support empty only collections. The way filtering is currently
// implemented can't support scenarios where there are no matches. This logic
// needs to be refactored to use a different technique (matching Mocha behavior).
feature.skip(`Filters with no matches have no results
    @dynamic
    `, () => {
    let executionResults: ExecutionResults;
    let liveDocOptions: LiveDocOptions = new LiveDocOptions();
    let featureText: string;

    scenario("ld-include has no matches", (ctx) => {
        Given(`the filter is
            """
            {
                "include": ["filter:non-existent"]
            }
            """
        `, (ctx) => {
            liveDocOptions.filters = ctx.step!.docStringAsEntity;
        });

        And(`the following features
            """
            feature(\`A sample feature 1\`, () => {
                scenarioOutline(\`a scenarioOutline within a tagged feature
                    @filter:include

                    Examples:
                    | Col1  |
                    | dummy |
                    \`, () => {
                    given("given within a scenario", () => {

                    });
                });
                scenarioOutline(\`a scenario that's not executed due to exclude tag
                    @filter:include
                    @filter:exclude
                    Examples:
                    | Col1  |
                    | dummy |
                    \`, () => {
                    given("given within a scenario", () => {
                    });
                });
                scenarioOutline(\`another scenario within a tagged feature
                    @filter:include

                    Examples:
                    | Col1  |
                    | dummy |
                    \`, () => {
                    given("given within a scenario", () => {

                    });
                });
            });

            feature(\`This feature is not executed as there are no matching tags\`, () => {
                scenarioOutline(\`a non-tagged scenario

                    Examples:
                    | Col1  |
                    | dummy |
                
                \`, () => {
                    given("given within a scenario", () => {

                    });
                });
            });
            """
        `, (ctx) => {
            featureText = ctx.step!.docString;
        });

        When("the feature is executed", async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        Then("'0' features are processed", (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step!.values[0]);
        });
    });

    scenario("ld-exclude has no matches", (ctx) => {
        Given(`the filter is
            """
            {
                "exclude": ["filter:non-existent"]
            }
            """
        `, (ctx) => {
            liveDocOptions.filters = ctx.step!.docStringAsEntity;
        });

        And(`the following features
            """
            feature(\`A sample feature 1\`, () => {
                scenarioOutline(\`a scenarioOutline within a tagged feature
                    @filter:include

                    Examples:
                    | Col1  |
                    | dummy |
                    \`, () => {
                    given("given within a scenario", () => {

                    });
                });
                scenarioOutline(\`a scenario that's not executed due to exclude tag
                    @filter:include
                    @filter:exclude
                    Examples:
                    | Col1  |
                    | dummy |
                    \`, () => {
                    given("given within a scenario", () => {

                    });
                });
                scenarioOutline(\`another scenario within a tagged feature
                    @filter:include

                    Examples:
                    | Col1  |
                    | dummy |
                    \`, () => {
                    given("given within a scenario", () => {

                    });
                });
            });

            feature(\`This feature is not executed as there are no matching tags\`, () => {
                scenarioOutline(\`a non-tagged scenario

                    Examples:
                    | Col1  |
                    | dummy |
                
                \`, () => {
                    given("given within a scenario", () => {

                    });
                });
            });
            """
        `, (ctx) => {
            featureText = ctx.step!.docString;
        });

        When("the feature is executed", async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        Then("'0' features are processed", (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step!.values[0]);
        });
    });
});
