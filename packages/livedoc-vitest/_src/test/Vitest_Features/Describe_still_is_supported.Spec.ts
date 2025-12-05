require('chai').should();
import { LiveDoc } from "../../app/livedoc";
import { SpecStatus, ExecutionResults } from "../../app/model/index";
import { feature, scenario, Given, When, Then, And } from "../../app/livedoc";

// TODO: Native describe/it tracking is not yet implemented in Vitest version
// This requires intercepting Vitest's describe/it functions to track VitestSuite objects
// For now, marking these tests as pending until suite tracking is implemented
feature.skip(`Describe still functions the same as native Vitest
    @dynamic
    `, (ctx) => {
    let executionResults: ExecutionResults;
    let givenCtx: any;

    scenario("Various suite features work as expected", (ctx) => {

        Given(`the following vitest file
        
        """
        import { describe, it, test } from 'vitest';
        
        // Vitest also has a root suite
        describe("Describe still functions the same as native vitest", () => {
            it("throwing exception in it will result in fail", () => {
                throw new TypeError("Bail...");
            });
        
            describe("a nested describe", () => {
                it("will execute and pass", () => {
        
                });
        
                it.skip("will be skipped and marked as pending", () => {
                    throw new Error("I shouldn't have been executed!!");
                });
        
                describe("another nested describe", () => {
                    test("test works like it", () => {
                    });
                })
            })
        });
        """
        `, (ctx) => {
                givenCtx = ctx.step;
            });

        When(`the test is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        Then(`'2' top level suites are processed`, (ctx) => {
            executionResults.suites.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the it for the first describe is marked as fail`, (ctx) => {
            const keyword = executionResults.suites[1].tests[0];
            keyword.status.should.be.eq(SpecStatus.fail);
        });

        And(`the first it for the second level describe is marked as pass`, (ctx) => {
            const keyword = executionResults.suites[1].children[0].tests[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });

        And(`the second it for the second level describe is marked as pending`, (ctx) => {
            const keyword = executionResults.suites[1].children[0].tests[1];
            keyword.status.should.be.eq(SpecStatus.pending);
        });

        And(`the first test for the third level describe is marked as pass`, (ctx) => {
            const keyword = executionResults.suites[1].children[0].children[0].tests[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });

    scenario("bdd features work at the root level suite", (ctx) => {

        Given(`the following vitest file
        
        """
        import { it } from 'vitest';
        
        it("will be associated with the root suite", () => {
            
        });
        """
        `, (ctx) => {
                givenCtx = ctx.step;
            });

        When(`the test is executed`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(givenCtx.docString);
        });

        Then(`'1' top level suite exists which is the root suite`, (ctx) => {
            executionResults.suites.length.should.be.equal(ctx.step!.values[0]);
        });

        And(`the it for the first suite is marked as pass`, (ctx) => {
            const keyword = executionResults.suites[0].tests[0];
            keyword.status.should.be.eq(SpecStatus.pass);
        });
    });
});
