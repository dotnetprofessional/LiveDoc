require('chai').should();
import { ExecutionResults, SpecStatus, StepDefinition, VitestSuite } from "../../app/model/index";
import { LiveDoc, feature, scenario, given, when, Then as then, and } from "../../app/livedoc";
import * as chai from "chai";
let should = chai.should();

feature(`Reporter returns model including execution results
    @dynamic
    `, () => {
    scenario(`Each passing step is captured as part of the model`, (ctx) => {
        let results: ExecutionResults;
        let step: StepDefinition;

        given(`the following feature
            """
            import { feature, scenario, given } from './livedoc';
            
            feature("Valid feature", ()=> {
                scenario("Valid scenario", ()=> {
                    given(\`a valid step with values 'value1' '200'
                    
                    line 1 of the description
                    line 2 of the description

                    $$$
                    this is my doc string
                    $$$

                    | column1 | column2 | column3 |
                    | r1c1    | r1c2    | r1c3    |
                    | r2c1    | r2c2    | r3c3    |
                    | r3c1    | r3c2    | r3c3    |
                
                    \`, ()=> {
                        const a = 1;
                        const b = a;

                        // ensure this method registers a little execution time
                        let x= "";
                        for(let i=0;i<1000000;i++) {
                            x+="A";
                        }
                     });
                });
            });
            """ 
            `, () => {
        });

        when(`executing feature`, async (ctx) => {
            // Cant have # as part of the feature as it conflicts with reading this steps docString
            // using a substitute to avoid conflicts
            const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
            results = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!.replace(/\$/g, '"'));
            step = results.features[0].scenarios[0].steps[0]
        });

        then(`the execution results for the step are:
            """
            {
                "sequence": 1,
                "title": "a valid step with values 'value1' '200'",
                "status": "pass",
                "exception": {},
                "docString": "this is my doc string",
                "dataTable": [
                    [
                        "column1",
                        "column2",
                        "column3"
                    ],
                    [
                        "r1c1",
                        "r1c2",
                        "r1c3"
                    ],
                    [
                        "r2c1",
                        "r2c2",
                        "r3c3"
                    ],
                    [
                        "r3c1",
                        "r3c2",
                        "r3c3"
                    ]
                ],
                "values": [
                    "value1",
                    200
                ],
                "valuesRaw": [
                    "value1",
                    "200"
                ],
                "ruleViolations": [],
                "type": "given"
            }
            """
            `, (ctx) => {
            const expected = ctx.step.docStringAsEntity;
            const actual = {
                "sequence": 1,
                "title": step.title,
                "status": step.status,
                // Use toJSON() to get consistent representation for comparison
                "exception": step.exception.toJSON ? step.exception.toJSON() : step.exception,
                "docString": step.docString,
                "dataTable": step.dataTable,
                "values": step.values,
                "valuesRaw": step.valuesRaw,
                "ruleViolations": step.ruleViolations,
                "type": step.type
            }

            actual.should.be.eql(expected);
        });

        // Only captured for errors to save space
        and(`the code of the step is not captured as they are only captured for error steps
            `, () => {
            // step.code should be empty (undefined or empty string) when not captured
            // This is consistent with Mocha - code is only set for error steps
            const codeIsEmpty = step.code === undefined || step.code === '';
            codeIsEmpty.should.be.true;
        });

        and(`the elapsed time is captured`, () => {
            step.duration.should.be.greaterThan(0);
        });
    });

    scenario(`Steps that throw an exception have the meta-data added to model`, (ctx) => {
        let results: ExecutionResults;

        given(`the following feature

        """
            import { feature, scenario, given } from './livedoc';
            
            feature("Valid feature", ()=> {
                scenario("Valid scenario", ()=> {
                    given("a valid step is marked as pass", ()=> {
                        throw new Error("I am an error!");
                     });
                });
            });
            """ 
            `, () => {
        });

        when(`executing feature`, async (ctx) => {
            const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
            results = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
        });

        then(`the execution results include the error details:
            """
            {
                "status": "fail",
                "exception": {
                    "actual": "",
                    "expected": "",
                    "message": "I am an error!"
                }
            }      
            """
        `, (ctx) => {
            const expected = ctx.step.docStringAsEntity;
            const step = results.features[0].scenarios[0].steps[0];
            const actual = {
                "status": step.status,
                "exception": step.exception,
            }

            // As the stack trace is not predictable, validate specifically
            // In Vitest, the temp files are .Spec.ts (not .feature like in Mocha)
            actual.exception.stackTrace.should.contain(".Spec.ts"); // reference to the file
            actual.exception.stackTrace = "";
            expected.exception.stackTrace = "";
            actual.should.be.eql(expected);
        });
    });

    scenario(`Steps that Fail have the meta-data added to model`, (ctx) => {
        let results: ExecutionResults;

        given(`the following feature

        """
            import { feature, scenario, given } from './livedoc';
            const assert = require('assert');

            feature("Valid feature", ()=> {
                scenario("Valid scenario", ()=> {
                    given("a valid step is marked as pass", ()=> {
                        assert.deepStrictEqual("You say Goodbye", "I say Hello");
                     });
                });
            });
            """ 
            `, () => {
        });

        when(`executing feature`, async (ctx) => {
            const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
            results = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
        });

        then(`the execution results include the error details:
            """
            {
                "status": "fail",
                "exception": {
                    "actual": "You say Goodbye",
                    "expected": "I say Hello",
                    "message": "Expected values to be strictly deep-equal:"
                }
            }
            """
        `, (ctx) => {
            const expected = ctx.step.docStringAsEntity;
            const step = results.features[0].scenarios[0].steps[0];
            const actual = {
                "status": step.status,
                "exception": step.exception,
            }

            // This output will vary depending on the version of node being used. This is being tested
            // against node v10.7.0
            actual.exception.message = actual.exception.message.split('\n')[0];
            // As the stack trace is not predictable, validate specifically
            // In Vitest, the temp files are .Spec.ts (not .feature like in Mocha)
            actual.exception.stackTrace.should.contain(".Spec.ts"); // reference to the file
            actual.exception.stackTrace = "";
            expected.exception.stackTrace = "";
            actual.should.be.eql(expected);
        });
    });

    // TODO: Native describe/it tracking is not yet implemented in Vitest version
    // This scenario tests VitestSuite tracking which requires intercepting Vitest's describe/it functions
    scenario.skip(`Describe it statements are updated with execution results`, (ctx) => {
        let results: ExecutionResults;
        let vitestSuite: VitestSuite;

        given(`the following feature

        """
            import { describe, it } from 'vitest';
            
            describe("Valid describe", ()=> {
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

        when(`executing describe`, async (ctx) => {
            const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
            results = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            vitestSuite = results.suites[1];
        });

        then(`the execution results are returned for the '3' it statements`, (ctx) => {
            results.suites.length.should.be.eq(2);
            vitestSuite.tests.length.should.be.eq(ctx.step.values[0]);
        });

        and(`the first it is marked as 'pass'`, (ctx) => {
            vitestSuite.tests[0].status.should.be.equal(SpecStatus[ctx.step.values[0]]);
        });

        and(`the second it is marked as 'fail'`, (ctx) => {
            vitestSuite.tests[1].status.should.be.equal(SpecStatus[ctx.step.values[0]]);
        });

        and(`the third it is marked as 'pending'`, (ctx) => {
            vitestSuite.tests[2].status.should.be.equal(SpecStatus[ctx.step.values[0]]);
        });

    });
});
