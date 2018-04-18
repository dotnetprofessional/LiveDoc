import { LiveDoc } from "../../app/livedoc";
import { LiveDocRuleViolation } from "../../app/model";
import { StepContext } from "../../app/model/StepContext";
require('chai').should();


feature(`Validate step rules

    There are some rules which are technically valid but are not recommended due to readability.
    These rules can be marked as Warning, Exception or Ignore. By default they are marked as warning.

`, () => {
        let violation: LiveDocRuleViolation;
        let outlineGiven: StepContext;

        scenarioOutline(`Using the same top level step multiple times
            Examples:
            | step  | display name |
            | given | Given        |
            | when  | When         |
            | then  | Then         |
        `, () => {
                given(`the following feature
                """
                feature("Validate the use of multiple steps", ()=> {
                    scenario("Multiple <step>s are used in a scenario", ()=>{
                        <step>("<step> sample 1", () => { });            
                        <step>("<step> sample 2", () => { });                
                    });
                });
                """
            `, () => {
                        outlineGiven = stepContext;
                    });

                when(`executing feature`, async () => {
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString);
                    }
                    catch (e) {
                        violation = e;
                    }
                });

                then(`a rule violation with the following description is thrown 
                """
                there should be only one <display name> in a Scenario, Scenario Outline or Background. Try using and or but instead.
                """`, () => {
                        stepContext.docString.should.eql(violation.message);
                    });


            });

        scenarioOutline(`Using secondary steps without a primary step
            
            The secondary steps and, but can only be used after a primary step given, when or then

            Examples:
            | step |
            | and  |
            | but  |
        `, () => {
                given(`the following feature
                """
                feature("Validate the use of invalid use of secondary steps", ()=> {
                    scenario("Secondary step <step>s used without given, when or then", ()=>{
                        <step>("<step> sample", () => { });            
                    });
                });
                """
            `, () => {
                        outlineGiven = stepContext;
                    });

                when(`executing feature`, async () => {
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString);
                    }
                    catch (e) {
                        violation = e;
                    }
                });

                then(`a rule violation with the following description is thrown 
                """
                <step> step definition must be preceded by a Given, When or Then.
                """`, () => {
                        stepContext.docString.should.eql(violation.message);
                    });
            });
    });
