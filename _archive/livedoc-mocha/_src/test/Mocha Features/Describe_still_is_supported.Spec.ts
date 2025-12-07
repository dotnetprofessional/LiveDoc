import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults } from "../../app/model";

feature("Describe still functions the same as native mocha", () => {
    let executionResults: ExecutionResults;
    let featureText: string;

    scenario("Various suite features work as expected", () => {

        given(`the following mocha file
        
        """
        // Mocha also has a root suite
        describe("Describe still functions the same as native mocha", () => {
            it("throwing exception in it will result in fail", () => {
                throw new TypeError("Bail...");
            });
        
            describe("a nested describe", () => {
                it("will execute and pass", () => {
        
                });
        
                it.skip("will be skipped and marked as pending", () => {
                    throw new Error("I shouldn't have been executed!!");
                });
        
                context("a context is nested within a describe", () => {
                    it("will execute and pass", () => {
                    });
                })
            })
        });
        """
        `, () => {
                featureText = stepContext.docString;
            });

        when(`the test is executed`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText);
        });

        then(`'2' top level describe is processed`, () => {
            executionResults.suites.length.should.be.equal(stepContext.values[0]);
        });

        and(`the it for the first describe is marked as fail`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.suites[1].tests[0];
            keyword.status.should.be.eq(SpecStatus.fail);
        });

        and(`the first it for the second level describe is marked as pass`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.suites[1].children[0].tests[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        and(`the second it for the second level describe is marked as pending`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.suites[1].children[0].tests[1];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        and(`the first it for the third level context is marked as pass`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.suites[1].children[0].children[0].tests[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("bdd features work at the root level suite", () => {

        given(`the following mocha file
        
        """
            it("will be associated with the root suite", () => {
                
            });
        """
        `, () => {
                featureText = stepContext.docString;
            });

        when(`the test is executed`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(featureText);
        });

        then(`'1' top level suite exists which is the root suite`, () => {
            executionResults.suites.length.should.be.equal(stepContext.values[0]);
        });

        and(`the it for the first suite is marked as pass`, () => {
            // locate the second step that has the violation
            const keyword = executionResults.suites[0].tests[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });
});


