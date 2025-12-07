require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";
import { feature, scenario, Given, When, Then } from "../../app/livedoc";

feature(`Background reports errors
    @dynamic

    When an exception/error occurs during the processing of a background the errors
    should be reported the same as if it were within a scenario.
    `, (ctx) => {

        let result: ExecutionResults;

        scenario(`Throw exception in a background step`, (ctx) => {
            let givenCtx: any;

            Given(`a step in a background throws and exception
            """
            feature("Validate background errors", ()=>{
                background("", ()=>{
                    given("an error occurs", ()=>{
                        throw new Error("An error occurred");
                    });
                })

                scenario("Trigger error", ()=>{
                    given("need one of these", ()=>{})
                })
            })
            """
            
            `, (ctx) => {
                givenCtx = ctx.step;
            });

            When(`executing feature`, async (ctx) => {
                result = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
            });

            Then("an error should be recorded", (ctx) => {
                result.features[0].statistics.failedCount.should.be.greaterThan(0);
            });
        });

        scenario(`Throw exception in a afterbackground`, (ctx) => {
            let givenCtx: any;

            Given(`a step in a background throws and exception
            """
            feature("Validate background errors", ()=>{
                background("", ()=>{
                    given("an error occurs", ()=>{
                    });

                    afterBackground(()=>{
                        throw new Error("An error occurred");
                    })
                })

                scenario("Trigger error", ()=>{
                    given("need one of these", ()=>{})
                })
            })
            """
            
            `, (ctx) => {
                givenCtx = ctx.step;
            });

            When(`executing feature`, async (ctx) => {
                result = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
            });

            Then("an error should be recorded", (ctx) => {
                result.features[0].statistics.failedCount.should.be.greaterThan(0);
            });
        });
    });
