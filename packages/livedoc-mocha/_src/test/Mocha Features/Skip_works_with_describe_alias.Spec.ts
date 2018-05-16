import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults, ScenarioOutline } from "../../app/model";

feature("Skip works with describe alias'", () => {
    let executionResults: ExecutionResults;
    let featureText: string;

    scenario("Using skip to specify Features to execute", () => {

        given(`the following features
        
        """
        feature.skip(\`This feature is not executed as it is skipped\`, () => {
            scenario(\`a scenario within a feature\`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is executed as the exclude tag takes precedence\`, () => {
            scenario(\`a scenario within a feature\`, () => {
                given("given within a scenario", () => {

                });
            });
        });
        """
        `, () => {
                featureText = stepContext.docString;
            });

        when(`the feature is executed`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText);
        });

        then(`'2' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });

        and(`the steps for the first feature are NOT executed`, () => {
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

    scenario("Using skip to specify Scenarios to execute", () => {
        given(`the following features
        
        """
        feature(\`This features Scenarios are not executed when using skip\`, () => {
            scenario(\`a scenario within a feature\`, () => {
                given("given within a scenario", () => {

                });
            });
            scenario.skip(\`a scenario that's excluded due to using skip\`, () => {
                given("given within a scenario", () => {

                });
            });
            scenario(\`another scenario within a tagged feature\`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is executed\`, () => {
            scenario(\`a  scenario\`, () => {
                given("given within a scenario", () => {

                });
            });
        });
        """
        `, () => {
                featureText = stepContext.docString;
            });

        when(`the feature is executed`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText);
        });

        then(`'2' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });

        and(`the first scenarios steps are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        and(`the second scenarios steps are marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the third scenarios steps are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        and(`the steps for the second feature are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("Using skip to specify ScenarioOutline to execute", () => {
        given(`the following features
        
        """
        feature(\`This features Scenarios are executed\`, () => {
            scenarioOutline(\`a scenarioOutline within a feature
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
            scenarioOutline.skip(\`a scenario that's not executed due to using skip
                @filter:include
                @filter:exclude
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
            scenarioOutline(\`another scenario within a feature
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is executed\`, () => {
            scenarioOutline(\`a scenario

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
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText);
        });

        then(`'2' features are processed`, () => {
            executionResults.features.length.should.be.equal(stepContext.values[0]);
        });

        and(`the first scenarios steps are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        and(`the second scenarios steps are marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pending);
        });

        and(`the third scenarios steps are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        and(`the steps for the second feature are executed`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });
    });
});