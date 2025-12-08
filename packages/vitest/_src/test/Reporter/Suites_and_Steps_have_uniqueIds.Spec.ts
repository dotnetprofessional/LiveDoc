require('chai').should();
import { LiveDoc, feature, scenario, given, when, Then as then } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";

feature(`Suites and Steps have uniqueIds
    @dynamic
    `, (ctx) => {
    let executionResults: ExecutionResults;
    let exception: Error;

    scenario(`Features have Ids for suites and steps added to the model`, (ctx) => {
        given(`the following feature
        
        """
            import { feature, background, scenario, given, when, Then as then, and, but } from './livedoc';
            
            feature("Sample Feature", ()=> {
                background("", ()=> {});
                scenario("Sample Scenario", ()=> {
                    given("Sample given", ()=> {});
                    when("Sample when", ()=> {});
                    then("Sample then", ()=> {});
                    and("Sample and", ()=> {});
                    but("Sample but", ()=> {});
                });
            });
        """
        `, () => { });

        when(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        then(`the model has the following Ids for each of the feature parts
            | Feature    | jwuz5s               |
            | Background | jwuz5s-0             |
            | Scenario   | jwuz5s-dymhqe        |
            | given      | jwuz5s-dymhqe-jrlnq1 |
            | when       | jwuz5s-dymhqe-t5nykw |
            | then       | jwuz5s-dymhqe-t5m1mb |
            | and        | jwuz5s-dymhqe-zb5rpd |
            | but        | jwuz5s-dymhqe-zb5smj |
        
        `, (ctx) => {
                const feature = executionResults.features[0];
                const actual = {
                    Feature: feature.id,
                    Background: feature.background!.id,
                    Scenario: feature.scenarios[0].id,
                    given: (feature.scenarios[0].steps[0] as any).id,
                    when: (feature.scenarios[0].steps[1] as any).id,
                    then: (feature.scenarios[0].steps[2] as any).id,
                    and: (feature.scenarios[0].steps[3] as any).id,
                    but: (feature.scenarios[0].steps[4] as any).id
                };

                const expected = ctx.step.tableAsEntity;

                actual.should.be.eql(expected);
            });
    });

    scenario(`Features with duplicate titles`, (ctx) => {
        given(`the following feature
        
        """
            import { feature, scenario, given } from './livedoc';
            
            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample given", ()=> {});
                });
            });

            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample given", ()=> {});
                });
            });

        """
        `, () => { });

        when(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        then(`the following exception is thrown
        """
        Feature titles must be unique. Scenarios must have unique titles within a Feature and Step Title must be unique within a Scenario.
          Title: Sample Feature
        """
        `, (ctx) => {
                // Check that the exception message contains the expected text
                // (The full message includes additional context from ParserException wrapper)
                exception.message.should.contain("Feature titles must be unique");
                exception.message.should.contain("Title: Sample Feature");
            });
    });

    scenario(`Scenarios with duplicate titles within a Feature`, (ctx) => {
        given(`the following feature
        
        """
            import { feature, scenario, given } from './livedoc';
            
            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample given", ()=> {});
                });

                scenario("Sample Scenario", ()=> {
                    given("Sample given", ()=> {});
                });
            });
        """
        `, () => { });

        when(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        then(`the following exception is thrown
        """
        Feature titles must be unique. Scenarios must have unique titles within a Feature and Step Title must be unique within a Scenario.
          Title: Sample Scenario
        """
        `, (ctx) => {
                // Check that the exception message contains the expected text
                exception.message.should.contain("Feature titles must be unique");
                exception.message.should.contain("Title: Sample Scenario");
            });
    });

    scenario(`Steps with duplicate titles within a Scenario`, (ctx) => {
        given(`the following feature
        
        """
            import { feature, scenario, given } from './livedoc';
            
            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample given", ()=> {});
                    given("Sample given", ()=> {});
                });

            });
        """
        `, () => { });

        when(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        then(`the following exception is thrown
        """
        Feature titles must be unique. Scenarios must have unique titles within a Feature and Step Title must be unique within a Scenario.
          Title: Sample given
        """
        `, (ctx) => {
                // Check that the exception message contains the expected text
                exception.message.should.contain("Feature titles must be unique");
                exception.message.should.contain("Title: Sample given");
            });
    });
});
