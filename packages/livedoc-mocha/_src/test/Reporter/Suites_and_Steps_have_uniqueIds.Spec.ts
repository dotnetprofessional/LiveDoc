import { LiveDoc } from "../../app/livedoc";
import { ExecutionResults } from "../../app/model";
require('chai').should();

feature.only(`Suites and Steps have uniqueIds`, () => {
    let executionResults: ExecutionResults;

    scenario(`Features have Ids for suites and steps added to the model`, () => {
        given(`the following feature
        
        """
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

        when(`feature is executed`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
        });

        then(`the model has the following Ids for each of the feature parts
            | type       | Id |
            | Feature    | x  |
            | Background | d  |
            | Scenario   | x  |
            | Given      | x  |
            | When       | X  |
            | Then       | X  |
            | and        | X  |
            | but        | X  |
        
        `, () => {
                const feature = executionResults.features[0];
                const actual = {
                    Feature: feature.id,
                    Background: feature.background.id,
                    Scenario: feature.scenarios[0].id,
                    Given: feature.scenarios[0].steps[0].id,
                    When: feature.scenarios[0].steps[1].id,
                    Then: feature.scenarios[0].steps[2].id,
                    and: feature.scenarios[0].steps[3].id,
                    but: feature.scenarios[0].steps[4].id
                };

                debugger;
                const expected = stepContext.tableAsEntity;

                actual.should.be.eq(expected);
                // NOTES: Use mocha-clean for the rules and callsites for the parsing.
            });
    });
});