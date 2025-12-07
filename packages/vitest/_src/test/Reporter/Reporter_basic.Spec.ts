require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults, SpecStatus } from "../../app/model/index";
import { feature, scenario, Given, When, Then, And } from "../../app/livedoc";

feature(`Reporter returns model including execution results
    @dynamic
    `, (ctx) => {
    scenario(`Each passing step is captured as part of the model`, (ctx) => {
        let results: ExecutionResults;
        let givenCtx: any;

        Given(`the following feature
            """
            feature("Valid feature", ()=> {
                scenario("Valid scenario", ()=> {
                    given("a valid step with values 'value1' '200'", ()=> {
                        const a = 1;
                        const b = a;
                     });
                });
            });
            """ 
            `, (ctx) => {
                givenCtx = ctx.step;
        });

        When(`executing feature`, async (ctx) => {
            results = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        Then(`'1' feature is processed`, (ctx) => {
            results.features.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the feature has '1' scenario`, (ctx) => {
            results.features[0].scenarios.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the scenario has '1' step`, (ctx) => {
            results.features[0].scenarios[0].steps.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the step is marked as 'pass'`, (ctx) => {
            const step = results.features[0].scenarios[0].steps[0];
            step.status.should.be.equal(SpecStatus[ctx.step!.values[0] as keyof typeof SpecStatus]);
        });
    });

    scenario(`Steps that throw an exception have the meta-data added to model`, (ctx) => {
        let results: ExecutionResults;
        let givenCtx: any;

        Given(`the following feature
        """
            feature("Valid feature", ()=> {
                scenario("Valid scenario", ()=> {
                    given("a valid step is marked as pass", ()=> {
                        throw new Error("I am an error!");
                     });
                });
            });
            """ 
            `, (ctx) => {
                givenCtx = ctx.step;
        });

        When(`executing feature`, async (ctx) => {
            results = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        Then(`the step status is 'fail'`, (ctx) => {
            const step = results.features[0].scenarios[0].steps[0];
            step.status.should.be.equal(SpecStatus[ctx.step!.values[0] as keyof typeof SpecStatus]);
        });

        And(`the error message is captured`, (ctx) => {
            const step = results.features[0].scenarios[0].steps[0];
            step.exception.message.should.contain("I am an error!");
        });
    });
});
