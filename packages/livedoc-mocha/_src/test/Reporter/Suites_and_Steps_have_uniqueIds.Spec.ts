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
            | Feature    | d629e814                   |
            | Background | d629e814-bba68bf6          |
            | Scenario   | d629e814-28e1fae0          |
            | Given      | d629e814-28e1fae0-ffd46f06 |
            | When       | d629e814-28e1fae0-39be8b8c |
            | Then       | d629e814-28e1fae0-39c145c6 |
            | and        | d629e814-28e1fae0-b789fa12 |
            | but        | d629e814-28e1fae0-b789f0be |
        
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

                const expected = stepContext.tableAsEntity;

                actual.should.be.eql(expected);
            });
    });
});