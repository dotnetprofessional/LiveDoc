import { ExecutionResults } from "../../app/model";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { LiveDoc } from "../../app/livedoc";

// Mocha doesn't support empty only collections. The way filtering is currently
// implemented can't support scenarios where there are no matches. This logic
// needs to be refactored to use a different technique.
feature.skip(`Filters with no matches have no results`, () => {
    let executionResults: ExecutionResults;
    let liveDocOptions: LiveDocOptions = new LiveDocOptions();
    let featureText: string;

    scenario(`ld-include has no matches`, () => {
        given(`the filter is
            """
            {
                "include": ["filter:non-existent"]
            }
            """
            `, () => {
                liveDocOptions.filters = stepContext.docStringAsEntity;
            });

        and(`the following features
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
            `, () => {
                featureText = stepContext.docString;
            });

        when(`the feature is executed`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        then(`'0' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });
    });

    scenario(`ld-exclude has no matches`, () => {
        given(`the filter is
            """
            {
                "exclude": ["filter:non-existent"]
            }
            """
            `, () => {
                liveDocOptions.filters = stepContext.docStringAsEntity;
            });

        and(`the following features
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
            `, () => {
                featureText = stepContext.docString;
            });

        when(`the feature is executed`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        then(`'0' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });
    });

});
