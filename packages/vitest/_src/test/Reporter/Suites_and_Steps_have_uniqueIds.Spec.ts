require('chai').should();
import { LiveDoc, feature, scenario, Given, When, Then } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model/index";

feature(`Suites and Steps have uniqueIds
    @dynamic
    `, (ctx) => {
    let executionResults: ExecutionResults;
    let exception: Error;

    scenario(`Features have Ids for suites and steps added to the model`, (ctx) => {
        Given(`the following feature
        
        """
            import { feature, background, scenario, given, when, then, and, but } from './livedoc';
            
            feature("Sample Feature", ()=> {
                background("", ()=> {});
                scenario("Sample Scenario", ()=> {
                    given("Sample Given", ()=> {});
                    when("Sample When", ()=> {});
                    then("Sample Then", ()=> {});
                    and("Sample and", ()=> {});
                    but("Sample but", ()=> {});
                });
            });
        """
        `, () => { });

        When(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'Given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        Then(`the model has the following Ids for each of the feature parts
            | Feature    | jwuz5s               |
            | Background | jwuz5s-0             |
            | Scenario   | jwuz5s-dymhqe        |
            | Given      | jwuz5s-dymhqe-k972pl |
            | When       | jwuz5s-dymhqe-t53j00 |
            | Then       | jwuz5s-dymhqe-t51m1f |
            | and        | jwuz5s-dymhqe-zb5rpd |
            | but        | jwuz5s-dymhqe-zb5smj |
        
        `, (ctx) => {
                const feature = executionResults.features[0];
                const actual = {
                    Feature: feature.id,
                    Background: feature.background!.id,
                    Scenario: feature.scenarios[0].id,
                    Given: (feature.scenarios[0].steps[0] as any).id,
                    When: (feature.scenarios[0].steps[1] as any).id,
                    Then: (feature.scenarios[0].steps[2] as any).id,
                    and: (feature.scenarios[0].steps[3] as any).id,
                    but: (feature.scenarios[0].steps[4] as any).id
                };

                const expected = ctx.step.tableAsEntity;

                actual.should.be.eql(expected);
            });
    });

    scenario(`Features with duplicate titles`, (ctx) => {
        Given(`the following feature
        
        """
            import { feature, scenario, given } from './livedoc';
            
            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample Given", ()=> {});
                });
            });

            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample Given", ()=> {});
                });
            });

        """
        `, () => { });

        When(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'Given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        Then(`the following exception is thrown
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
        Given(`the following feature
        
        """
            import { feature, scenario, given } from './livedoc';
            
            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample Given", ()=> {});
                });

                scenario("Sample Scenario", ()=> {
                    given("Sample Given", ()=> {});
                });
            });
        """
        `, () => { });

        When(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'Given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        Then(`the following exception is thrown
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
        Given(`the following feature
        
        """
            import { feature, scenario, given } from './livedoc';
            
            feature("Sample Feature", ()=> {
                scenario("Sample Scenario", ()=> {
                    given("Sample Given", ()=> {});
                    given("Sample Given", ()=> {});
                });

            });
        """
        `, () => { });

        When(`feature is executed`, async (ctx) => {
            try {
                const givenStep = ctx.scenario.steps.find(s => s.type === 'Given');
                executionResults = await LiveDoc.executeDynamicTestAsync(givenStep!.docString!);
            } catch (e) {
                exception = e;
            }
        });

        Then(`the following exception is thrown
        """
        Feature titles must be unique. Scenarios must have unique titles within a Feature and Step Title must be unique within a Scenario.
          Title: Sample Given
        """
        `, (ctx) => {
                // Check that the exception message contains the expected text
                exception.message.should.contain("Feature titles must be unique");
                exception.message.should.contain("Title: Sample Given");
            });
    });
});
