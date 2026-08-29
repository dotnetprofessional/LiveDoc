import { ExecutionResults, SpecStatus, StepDefinition } from "../../app/model/index";
import { feature, scenario, given, when, Then as then, and, LiveDoc } from "../../app/livedoc";
import * as chai from "chai";
let should = chai.should();

feature(`Reporter captures code block for failed steps
    @dynamic
    `, () => {
    scenario(`A failing step should have its code block populated`, () => {
        let results: ExecutionResults;
        let step: StepDefinition;
        let featureString: string;

        given(`the following feature with a failing step
            """
            import { feature, scenario, given } from './livedoc';
            
            feature("Feature with failing step", ()=> {
                scenario("Scenario with failing step", ()=> {
                    given("a step that fails", ()=> {
                        // This is the code that should be captured
                        const a = 1;
                        const b = 2;
                        if (a !== b) {
                            throw new Error("Something went wrong");
                        }
                    });
                });
            });
            """ 
            `, (ctx) => {
                featureString = ctx.step.docString;
        });

        when(`executing feature`, async (ctx) => {
            results = await LiveDoc.executeDynamicTestAsync(featureString);
        });

        then(`the step status should be 'fail'`, () => {
            step = results.features[0].scenarios[0].steps[0];
            step.status.should.be.equal(SpecStatus.fail);
        });

        and(`the step code should be populated with the function body`, () => {
            step.code.should.include("const a = 1;");
            step.code.should.include("const b = 2;");
            step.code.should.include('throw new Error("Something went wrong");');
        });
    });
});
