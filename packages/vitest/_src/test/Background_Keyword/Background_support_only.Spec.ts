require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";
import { feature, scenario, given, when, Then as then } from "../../app/livedoc";

feature(`Marking a scenario with .only or a tagged filter which has a background
    @dynamic
    `, (ctx) => {
    let results: ExecutionResults;

    scenario(`Scenario marked as .only`, (ctx) => {
        let givenCtx: any;

        given(`the following spec
            """
            feature("Validate background execute", () => {
                let wasExecuted = false;
                let scenarioCount = 0;
            
                background("", () => {
                    given("sample given", () => {
                        // debugger;
                        wasExecuted = true;
                    });
                });
            
                scenario("sample scenario", () => {
                    given("sample given", () => {
                        // debugger;
                        throw Error("Scenario shouldn't have been executed");                
                    });
                })
            
                scenario.only("sample scenario marked as .only", () => {
                    given("sample given", () => {
                        // debugger;
                        if (!wasExecuted) {
                            throw Error("Background not executed");
                        }
                    });
                })
            });
            """
        `, (ctx) => {
            givenCtx = ctx.step;
        });

        when(`executing feature`, async (ctx) => {
            results = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        then(`only one scenario was executed`, (ctx) => {
            // includes the background steps
            results.features[0].statistics.passCount.should.eq(2, "passCount");
            results.features[0].statistics.failedCount.should.eq(0, "failedCount");
        });
    });

    scenario(`Scenario marked with a tag`, (ctx) => {
        let givenCtx: any;

        given(`the following spec
            """
            feature("Validate background execute", () => {
                let wasExecuted = false;
                let scenarioCount = 0;
            
                background("", () => {
                    given("sample given", () => {
                        wasExecuted = true;
                    });
                });
            
                scenario("sample scenario", () => {
                    given("sample given", () => {
                        throw Error("Scenario shouldn't have been executed");                
                    });
                })
            
                scenario(\`sample scenario marked as .only
                    @only
                \`, () => {
                    given("sample given", () => {
                        if (!wasExecuted) {
                            throw Error("Background not executed");
                        }
                    });
                })
            });
            """
        `, (ctx) => {
            givenCtx = ctx.step;
        });

        when(`executing feature`, async (ctx) => {
            results = await LiveDoc.executeDynamicTestAsync(givenCtx.docString, { filters: { include: ["only"] } });
        });

        then(`only one scenario was executed`, (ctx) => {
            // includes the background steps
            results.features[0].statistics.passCount.should.eq(2, "passCount");
            results.features[0].statistics.failedCount.should.eq(0, "failedCount");
        });
    });
});
