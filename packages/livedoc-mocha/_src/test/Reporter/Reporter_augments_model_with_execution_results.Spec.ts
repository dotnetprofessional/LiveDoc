import { ExecutionResults, Scenario, SpecStatus, Describe } from "../../app/model";
import { LiveDoc } from "../../app/livedoc";

feature.only(`Reporter augments model with execution results`, () => {
    scenario(`Scenario Steps are updated with execution results`, () => {
        let results: ExecutionResults;
        let scenario: Scenario;

        given(`the following feature

        """
            feature("Valid feature", ()=> {
                scenario("Valid scenario", ()=> {
                    given("a valid step is marked as pass", ()=> { });

                    when("a step with an error is marked as fail", ()=> {
                        const x = undefined;
                        const y = x.blah;
                    });

                    then.skip("a skipped step is marked pending", ()=> { });
                });
            });
            """ 
            `, () => {
            });

        when(`executing feature`, async () => {
            results = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
            scenario = results.features[0].scenarios[0];
        });

        then(`the execution results are returned for the '3' steps`, () => {
            results.features.length.should.be.eq(1);
            results.features[0].scenarios.length.should.be.eq(1);
            results.features[0].scenarios[0].steps.length.should.be.eq(stepContext.values[0]);
        });

        and(`the given step is marked as 'pass'`, () => {
            scenario.steps[0].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

        and(`the when step is marked as 'fail'`, () => {
            scenario.steps[1].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

        and(`the then step is marked as 'pending'`, () => {
            scenario.steps[2].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

    });

    scenario.only(`Describe it statments are updated with execution results`, () => {
        let results: ExecutionResults;
        let describe: Describe;

        given(`the following feature

        """
            describe("Valid Describe", ()=> {
                it("a valid it is marked as pass", ()=> { });

                it("an it with an error is marked as fail", ()=> {
                    const x = undefined;
                    const y = x.blah;
                });

                it.skip("a skipped it is marked pending", ()=> { });
            });
        """ 
            `, () => {
            });

        when(`executing describe`, async () => {
            results = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
            describe = results.describes[0];
        });

        then(`the execution results are returned for the '3' it statements`, () => {
            results.describes.length.should.be.eq(1);
            results.describes[0].tests.length.should.be.eq(stepContext.values[0]);
        });

        and(`the first it is marked as 'pass'`, () => {
            describe.tests[0].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

        and(`the second it is marked as 'fail'`, () => {
            describe.tests[1].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

        and(`the third it is marked as 'pending'`, () => {
            describe.tests[2].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

    });

    scenario(`Executing a feature with exceptions`, () => {
        let results: ExecutionResults;
        let scenario: Scenario;

        given(`the following feature

        """
            const assert = require('assert');
            feature("Invalid feature", ()=> {
                scenario("Scenario with various errors", ()=> {
                    given("a valid step is marked as pass", ()=> { });

                    when("a step with an exception is executed", ()=> {
                        const x = undefined;
                        const y = x.blah;
                    });

                    then("a step fails with an assertion", ()=> {
                        assert.deepStrictEqual("Hello World", "Goodbye World");
                     });
                });
            });
        """ 
            `, () => {
            });

        when(`executing feature`, async () => {
            results = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
            scenario = results.features[0].scenarios[0];
        });

        then(`the when step has an exception with the following values
        
                | message    | Cannot read property 'blah' of undefined            |
                | stackTrace | TypeError: Cannot read property 'blah' of undefined |
        '`, () => {
                const errors = stepContext.tableAsEntity;
                scenario.steps[1].exception.message.should.be.equal(errors.message);
                scenario.steps[1].exception.stackTrace.startsWith(errors.stackTrace);
            });

        and(`the when step has an exception with the following values
        
            | message    | 'Hello World' deepStrictEqual 'Goodbye World'                                 |
            | stackTrace | AssertionError [ERR_ASSERTION]: 'Hello World' deepStrictEqual 'Goodbye World' |
            | actual     | Hello World                                                                   |
            | expected   | Goodbye World                                                                 |
    '`, () => {
                debugger;
                const errors = stepContext.tableAsEntity;
                scenario.steps[2].exception.message.should.be.equal(errors.message);
                scenario.steps[2].exception.stackTrace.startsWith(errors.stackTrace);
                scenario.steps[2].exception.expected.should.be.equal(errors.expected);
                scenario.steps[2].exception.actual.should.be.equal(errors.actual);
            });
    });

});