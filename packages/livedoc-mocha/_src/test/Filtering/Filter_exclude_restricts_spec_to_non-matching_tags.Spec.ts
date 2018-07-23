import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults, ScenarioOutline } from "../../app/model";
import { LiveDocOptions } from "../../app/LiveDocOptions";

feature("Filter exclude restricts spec to non-matching tags", () => {
    let executionResults: ExecutionResults;
    let liveDocOptions: LiveDocOptions = new LiveDocOptions();
    let featureText: string;

    scenario("Using exclude option to specify Features to execute", () => {
        given(`the filter is
        """
        {
            "exclude": ["filter:exclude"]
        }
        """
        `, () => {
                liveDocOptions.filters = stepContext.docStringAsEntity;
            });

        and(`the following features
        
        """
        feature(\`This feature is not executed as it matches the tag
            @filter:exclude
            \`, () => {
            scenario(\`a scenario within a tagged feature\`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is executed as there are no matching tags\`, () => {
            scenario(\`a scenario within a tagged feature\`, () => {
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

        then(`'2' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });

        and(`the steps for the first feature are NOT executed and marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the steps for the second feature are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("Using exclude option to specify Scenarios to execute", () => {
        given(`the filter is
        """
        {
            "exclude": ["filter:exclude"]
        }
        """
        `, () => {
                liveDocOptions.filters = stepContext.docStringAsEntity;
            });

        and(`the following features
        
        """
        feature(\`This features Scenarios are NOT executed they match the tag\`, () => {
            scenario(\`a scenario within a tagged feature
                @filter:exclude
                \`, () => {
                given("given within a scenario", () => {

                });
            });
            scenario(\`a scenario that's not tagged within a tagged feature\`, () => {
                given("given within a scenario", () => {

                });
            });
            scenario(\`another scenario within a tagged feature
                @filter:exclude
                \`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is executed as there are no matching tags\`, () => {
            scenario(\`a non-tagged scenario\`, () => {
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

        then(`'2' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });

        and(`the first scenarios steps are NOT executed and marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the second scenarios steps are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        and(`the third scenarios steps are NOT executed and marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the steps for the second feature are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("Using exclude option to specify ScenarioOutline to execute", () => {
        given(`the filter is
        """
        {
            "exclude": ["filter:exclude"]
        }
        """
        `, () => {
                liveDocOptions.filters = stepContext.docStringAsEntity;
            });

        and(`the following features
        
        """
        feature(\`This features Scenarios are NOT executed they match the tag\`, () => {
            scenarioOutline(\`a scenarioOutline within a tagged feature
                @filter:exclude

                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {
                    console.log("I should not be called :(");
                });
            });
            scenarioOutline(\`a scenario that's not tagged within a tagged feature
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
            scenarioOutline(\`another scenario within a tagged feature
                @filter:exclude

                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is executed as there are no matching tags\`, () => {
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
            try {
                executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
            } catch (e) {
                console.log(e)
            }
        });

        then(`'2' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });

        and(`the first scenarios steps are NOT executed and marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pending);
        });

        and(`the second scenarios steps are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        and(`the third scenarios steps are NOT executed and marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pending);
        });

        and(`the steps for the second feature are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });
    });
});

