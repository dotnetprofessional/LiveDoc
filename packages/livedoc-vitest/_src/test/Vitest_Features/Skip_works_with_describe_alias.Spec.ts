require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults, ScenarioOutline } from "../../app/model/index";
import { feature, scenario, Given, When, Then, And } from "../../app/livedoc";

feature(`Skip works with describe alias'
    @dynamic
    `, (ctx) => {
    let executionResults: ExecutionResults;
    let givenCtx: any;

    scenario("Using skip to specify Features to execute", (ctx) => {

        Given(`the following features
        
        """
        import { feature, scenario, given } from './livedoc';
        
        feature.skip(\`This feature is not executed as it is skipped\`, () => {
            scenario(\`a scenario within the skipped feature\`, () => {
                given("given within the skipped scenario", () => {

                });
            });
        });

        feature(\`This feature is executed\`, () => {
            scenario(\`a scenario within the executed feature\`, () => {
                given("given within the executed scenario", () => {

                });
            });
        });
        """
        `, (ctx) => {
                givenCtx = ctx.step;
            });

        When(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        Then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the steps for the first feature are NOT executed`, (ctx) => {
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        And(`the steps for the second feature are executed`, (ctx) => {
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("Using skip to specify Scenarios to execute", (ctx) => {
        Given(`the following features
        
        """
        import { feature, scenario, given } from './livedoc';
        
        feature(\`This features Scenarios are not executed when using skip\`, () => {
            scenario(\`first scenario in skip-scenarios feature\`, () => {
                given("given in first scenario", () => {

                });
            });
            scenario.skip(\`a scenario that's excluded due to using skip\`, () => {
                given("given in skipped scenario", () => {

                });
            });
            scenario(\`third scenario in skip-scenarios feature\`, () => {
                given("given in third scenario", () => {

                });
            });
        });

        feature(\`Second feature is executed\`, () => {
            scenario(\`a scenario in second feature\`, () => {
                given("given in second feature scenario", () => {

                });
            });
        });
        """
        `, (ctx) => {
                givenCtx = ctx.step;
            });

        When(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        Then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the first scenarios steps are executed`, (ctx) => {
            const keyword = executionResults.features[0].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        And(`the second scenarios steps are marked as pending`, (ctx) => {
            const keyword = executionResults.features[0].scenarios[1].steps[0];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        And(`the third scenarios steps are executed`, (ctx) => {
            const keyword = executionResults.features[0].scenarios[2].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        And(`the steps for the second feature are executed`, (ctx) => {
            const keyword = executionResults.features[1].scenarios[0].steps[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("Using skip to specify ScenarioOutline to execute", (ctx) => {
        Given(`the following features
        
        """
        import { feature, scenarioOutline, given } from './livedoc';
        
        feature(\`This features ScenarioOutlines are executed\`, () => {
            scenarioOutline(\`first scenarioOutline in skip-outlines feature
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given in first outline", () => {

                });
            });
            scenarioOutline.skip(\`a scenarioOutline that's skipped
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given in skipped outline", () => {

                });
            });
            scenarioOutline(\`third scenarioOutline in skip-outlines feature
                Examples:
                | Col1  |
                | dummy |
                \`, () => {
                given("given in third outline", () => {

                });
            });
        });

        feature(\`Second feature with outlines is executed\`, () => {
            scenarioOutline(\`a scenarioOutline in second feature
                Examples:
                | Col1  |
                | dummy |
            \`, () => {
                given("given in second feature outline", () => {

                });
            });
        });
        """
        `, (ctx) => {
                givenCtx = ctx.step;
            });

        When(`the feature is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        Then(`'2' features are processed`, (ctx) => {
            executionResults.features.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the first scenarios steps are executed`, (ctx) => {
            const keyword = executionResults.features[0].scenarios[0] as ScenarioOutline;
            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        And(`the second scenarios steps are marked as pending`, (ctx) => {
            const keyword = executionResults.features[0].scenarios[1] as ScenarioOutline;
            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pending);
        });

        And(`the third scenarios steps are executed`, (ctx) => {
            const keyword = executionResults.features[0].scenarios[2] as ScenarioOutline;
            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });

        And(`the steps for the second feature are executed`, (ctx) => {
            const keyword = executionResults.features[1].scenarios[0] as ScenarioOutline;
            keyword.examples[0].steps[0].status.should.be.eq(SpecStatus.pass);
        });
    });
});
