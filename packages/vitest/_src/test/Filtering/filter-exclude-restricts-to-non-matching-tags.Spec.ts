require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults, ScenarioOutline } from "../../app/model/index";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Filter exclude restricts spec to non-matching tags
    @dynamic
    `, (ctx) => {
    let executionResults: ExecutionResults;
    let liveDocOptions: LiveDocOptions = new LiveDocOptions();
    let featureText: string;

    scenario("Using exclude option to specify Features to execute", (ctx) => {
        let givenCtx: any;
        let andCtx: any;

        given(`the filter is
        """
        {
            "exclude": ["filter:exclude"]
        }
        """
        `, (ctx) => {
                liveDocOptions.filters = ctx.step.docStringAsEntity;
                givenCtx = ctx.step;
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
        `, (ctx) => {
                featureText = ctx.step.docString;
                andCtx = ctx.step;
            });

        when(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step.values[0]);
        });

        and(`the steps for the first feature are NOT executed and marked as pending`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the steps for the second feature are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("Using exclude option to specify Scenarios to execute", (ctx) => {
        let givenCtx: any;
        let andCtx: any;

        given(`the filter is
        """
        {
            "exclude": ["filter:exclude"]
        }
        """
        `, (ctx) => {
                liveDocOptions.filters = ctx.step.docStringAsEntity;
                givenCtx = ctx.step;
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
        `, (ctx) => {
                featureText = ctx.step.docString;
                andCtx = ctx.step;
            });

        when(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step.values[0]);
        });

        and(`the first scenarios steps are NOT executed and marked as pending`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the second scenarios steps are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        and(`the third scenarios steps are NOT executed and marked as pending`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the steps for the second feature are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("Using exclude option to specify ScenarioOutline to execute", (ctx) => {
        let givenCtx: any;
        let andCtx: any;

        given(`the filter is
        """
        {
            "exclude": ["filter:exclude"]
        }
        """
        `, (ctx) => {
                liveDocOptions.filters = ctx.step.docStringAsEntity;
                givenCtx = ctx.step;
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
        `, (ctx) => {
                featureText = ctx.step.docString;
                andCtx = ctx.step;
            });

        when(`the feature is executed`, async (ctx) => {
            try {
                executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
            } catch (e) {
                console.log(e)
            }
        });

        then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step.values[0]);
        });

        and(`the first scenarios steps are NOT executed and marked as pending`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pending);
        });

        and(`the second scenarios steps are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        and(`the third scenarios steps are NOT executed and marked as pending`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pending);
        });

        and(`the steps for the second feature are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });
    });
});
