require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults, ScenarioOutline } from "../../app/model/index";
import { LiveDocOptions } from "../../app/LiveDocOptions";
import { feature, scenario, Given, When, Then, And } from "../../app/livedoc";

feature(`Filter include restricts spec to matching tags
    @dynamic
    `, (ctx) => {
    let executionResults: ExecutionResults;
    let liveDocOptions: LiveDocOptions = new LiveDocOptions();
    let featureText: string;

    scenario("Using include option to specify Features to execute", (ctx) => {
        let givenCtx: any;
        let andCtx: any;

        Given(`the filter is
        """
        {
            "include": ["filter:include"]
        }
        """
        `, (ctx) => {
                liveDocOptions.filters = ctx.step.docStringAsEntity;
                givenCtx = ctx.step;
            });

        And(`the following features
        
        """
        feature(\`This feature is executed as it matches the tag
            @filter:include
            \`, () => {
            scenario(\`a scenario within a tagged feature\`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is not executed as there are no matching tags\`, () => {
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

        When(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        Then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step.values[0]);
        });

        And(`the steps for the first feature are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        And(`the steps for the second feature are NOT executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.unknown);
        });
    });

    scenario("Using include option to specify Scenarios to execute", (ctx) => {
        let givenCtx: any;
        let andCtx: any;

        Given(`the filter is
        """
        {
            "include": ["filter:include"]
        }
        """
        `, (ctx) => {
                liveDocOptions.filters = ctx.step.docStringAsEntity;
                givenCtx = ctx.step;
            });

        And(`the following features
        
        """
        feature(\`This features Scenarios are executed they match the tag\`, () => {
            scenario(\`a scenario within a tagged feature
                @filter:include
                \`, () => {
                given("given within a scenario", () => {

                });
            });
            scenario(\`a scenario that's not tagged within a tagged feature\`, () => {
                given("given within a scenario", () => {

                });
            });
            scenario(\`another scenario within a tagged feature
                @filter:include
                \`, () => {
                given("given within a scenario", () => {

                });
            });
        });

        feature(\`This feature is not executed as there are no matching tags\`, () => {
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

        When(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        Then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step.values[0]);
        });

        And(`the first scenarios steps are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        And(`the second scenarios steps are NOT executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1].steps[0];
            keyword.status.should.be.eq(SpecStatus.unknown);
        });

        And(`the third scenarios steps are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        And(`the steps for the second feature are NOT executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.unknown);
        });
    });

    scenario("Using include option to specify ScenarioOutline to execute", (ctx) => {
        let givenCtx: any;
        let andCtx: any;

        Given(`the filter is
        """
        {
            "include": ["filter:include"]
        }
        """
        `, (ctx) => {
                liveDocOptions.filters = ctx.step.docStringAsEntity;
                givenCtx = ctx.step;
            });

        And(`the following features
        
        """
        feature(\`This features Scenarios are executed they match the tag\`, () => {
            scenarioOutline(\`a scenarioOutline within a tagged feature
                @filter:include

                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given within a scenario", () => {

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
                featureText = ctx.step.docString;
                andCtx = ctx.step;
            });

        When(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText, liveDocOptions);
        });

        Then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step.values[0]);
        });

        And(`the first scenarios steps are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        And(`the second scenarios steps are NOT executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[1] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.unknown);
        });

        And(`the third scenarios steps are executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[0].scenarios[2] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        And(`the steps for the second feature are NOT executed`, (ctx) => {
            // locate the second step that has the violation
            const keyword = executionResults.features[1].scenarios[0] as ScenarioOutline;

            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.unknown);
        });
    });
});
