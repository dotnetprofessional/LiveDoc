import { ExecutionResults, SpecStatus, StepDefinition, MochaSuite } from "../../app/model";
import { LiveDoc } from "../../app/livedoc";
import * as chai from "chai";
let should = chai.should();

feature(`Reporter returns model including execution results`, () => {
    scenario(`Each passing step is captured as part of the model`, () => {
        let results: ExecutionResults;
        let step: StepDefinition;

        given(`the following feature
            """
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

        when(`executing feature`, async () => {
            // Cant have # as part of the feature as it conflicts with reading this steps docString
            // using a substitute to avoid conflicts
            results = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString.replace(/\$/g, '"'));
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
                "type": "Given"
            }
            """
            `, () => {
            const expected = stepContext.docStringAsEntity;
            const actual = {
                "sequence": 1,
                "title": step.title,
                "status": step.status,
                "exception": step.exception,
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
            should.equal(undefined, step.code);
        });

        and(`the elapsed time is captured`, () => {
            step.duration.should.be.greaterThan(0);
        });
    });

    scenario(`Steps that throw an exception have the meta-data added to model`, () => {
        let results: ExecutionResults;

        given(`the following feature

        """
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

        when(`executing feature`, async () => {
            results = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
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
        `, () => {
            const expected = stepContext.docStringAsEntity;
            const step = results.features[0].scenarios[0].steps[0];
            const actual = {
                "status": step.status,
                "exception": step.exception,
            }

            // As the stack trace is not predictable, validate specifically
            actual.exception.stackTrace.should.contain(".feature"); // reference to the file
            actual.exception.stackTrace = "";
            expected.exception.stackTrace = "";
            actual.should.be.eql(expected);
        });
    });

    scenario(`Steps that Fail have the meta-data added to model`, () => {
        let results: ExecutionResults;

        given(`the following feature

        """
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

        when(`executing feature`, async () => {
            results = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
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
        `, () => {
            const expected = stepContext.docStringAsEntity;
            const step = results.features[0].scenarios[0].steps[0];
            const actual = {
                "status": step.status,
                "exception": step.exception,
            }

            // This output will vary depending on the version of node being used. This is being tested
            // against node v10.7.0
            actual.exception.message = actual.exception.message.split('\n')[0];
            // As the stack trace is not predictable, validate specifically
            actual.exception.stackTrace.should.contain(".feature"); // reference to the file
            actual.exception.stackTrace = "";
            expected.exception.stackTrace = "";
            actual.should.be.eql(expected);
        });
    });

    scenario(`Describe it statements are updated with execution results`, () => {
        let results: ExecutionResults;
        let mochaSuite: MochaSuite;

        given(`the following feature

        """
            describe("Valid dDescribe", ()=> {
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
            mochaSuite = results.suites[1];
        });

        then(`the execution results are returned for the '3' it statements`, () => {
            results.suites.length.should.be.eq(2);
            mochaSuite.tests.length.should.be.eq(stepContext.values[0]);
        });

        and(`the first it is marked as 'pass'`, () => {
            mochaSuite.tests[0].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

        and(`the second it is marked as 'fail'`, () => {
            mochaSuite.tests[1].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

        and(`the third it is marked as 'pending'`, () => {
            mochaSuite.tests[2].status.should.be.equal(SpecStatus[stepContext.values[0]]);
        });

    });
});