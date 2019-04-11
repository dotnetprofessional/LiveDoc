require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { ParserException, ExecutionResults } from "../../app/model";

feature(`Background reports errors

    When an exception/error occurs during the processing of a background the errors
    should be reported the same as if it were within a scenario.
    `, () => {

        let parseException: ParserException;
        let result: ExecutionResults;

        scenario(`Throw exception in a background step`, () => {
            given(`a step in a background throws and exception
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
            
            `, () => {

                });

            when(`executing feature`, async () => {
                try {
                    result = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
                }
                catch (e) {
                    parseException = e;
                }
            });

            then("an error should be recorded", () => {
                result.features[0].statistics.failedCount.should.be.greaterThan(0);
            });
        });

        scenario(`Throw exception in a afterbackground`, () => {
            given(`a step in a background throws and exception
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
            
            `, () => {

                });

            when(`executing feature`, async () => {
                try {
                    result = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
                }
                catch (e) {
                    parseException = e;
                }
            });

            then("an error should be recorded", () => {
                result.features[0].statistics.failedCount.should.be.greaterThan(0);
            });
        });
    });
