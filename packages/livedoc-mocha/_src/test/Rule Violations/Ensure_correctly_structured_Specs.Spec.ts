import { LiveDoc } from "../../app/livedoc";
import { ParserException, StepContext } from "../../app/model";
require('chai').should();


feature(`Ensure correctly structured Specs`, () => {
    let parseException: ParserException;
    let outlineGiven: StepContext;

    scenarioOutline(`Invalid top level keywords

        Examples:
        | keyword         | error message                                                                            |
        | scenario        | Scenario must be within a feature.                                                       |
        | scenarioOutline | Scenario Outline must be within a feature.                                               |
        | background      | Background must be within a feature.                                                     |
      //| given           | Invalid Gherkin, Given can only appear within a Background, Scenario or Scenario Outline |
      //| when            | Invalid Gherkin, When can only appear within a Background, Scenario or Scenario Outline  |
      //| then            | Invalid Gherkin, Then can only appear within a Background, Scenario or Scenario Outline  |
      //| and             | Invalid Gherkin, and can only appear within a Background, Scenario or Scenario Outline   |
      //| but             | Invalid Gherkin, but can only appear within a Background, Scenario or Scenario Outline   |

      # currently treating GWT as BDD, need to make code more strict before enabling
        `, () => {
            given(`the following feature file
                """
                <keyword>('Defining a <keyword> without a feature', () => {
                    given('a sample given', () => { });
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
                    parseException = e;
                }
            });

            then(`a parseException with the following description is thrown 
            """
            <error message>
            """`, () => {
                    stepContext.docString.should.eql(parseException.description);
                });
        });

    scenarioOutline(`Invalid Feature children
        Examples:
        | step  | display name |
        | given | Given        |
        | when  | When         |
        | then  | Then         |
        | and   | and          |
        | but   | but          |
        `, () => {
            let featureGherkin: string;

            given(`the following feature
            """
            feature("Ensure bad Gherkin is not allowed", () => {
                <step>("a <step> step definition is added to a feature", () => { });
            });            
            """`, () => {
                    featureGherkin = stepContext.docString;
                });

            when(`executing feature`, async () => {
                try {
                    await LiveDoc.executeDynamicTestAsync(featureGherkin);
                }
                catch (e) {
                    parseException = e;
                }
            });

            then(`a parseException with the following description is thrown 
            """
            Invalid Gherkin, <display name> can only appear within a Background, Scenario or Scenario Outline
            """`, () => {
                    stepContext.docString.should.eql(parseException.description);
                });
        });

    scenarioOutline(`Invalid Background children
        Examples:
        | step | display name |
        | when | When         |
        | then | Then         |
        `, () => {
            let featureGherkin: string;

            given(`the following feature
            """
            feature("Ensure bad Gherkin is not allowed", () => {
                background("", ()=> {
                    <step>("a <step> step definition is not permitted in a background", () => { });
                });
            });            
            """`, () => {
                    featureGherkin = stepContext.docString;
                });

            when(`executing feature`, async () => {
                try {
                    await LiveDoc.executeDynamicTestAsync(featureGherkin);
                }
                catch (e) {
                    parseException = e;
                }
            });

            then(`a parseException with the following description is thrown 
            """
            Backgrounds only support using the given step definition. Consider moving the <display name> to a scenario.
            """`, () => {
                    stepContext.docString.should.eql(parseException.description);
                });
        });

    scenarioOutline(`Feature mixes BDD languages
        Examples:
        | keyword  | suggestion |
        | it       | given      |
        | describe | scenario   |
        `, () => {
            let featureGherkin: string;

            given(`the following feature
            """
            feature("Ensure bad Gherkin is not allowed", () => {
                <keyword>("a <keyword> step definition is added to a feature", () => { });
            });            
            """`, () => {
                    featureGherkin = stepContext.docString;
                });

            when(`executing feature`, async () => {
                try {
                    await LiveDoc.executeDynamicTestAsync(featureGherkin);
                }
                catch (e) {
                    parseException = e;
                }
            });

            then(`a parseException with the following description is thrown 
            """
            This Feature is using bdd syntax, did you mean to use <suggestion> instead?
            """`, () => {
                    stepContext.docString.should.eql(parseException.description);
                });
        });

    scenarioOutline(`Scenario mixes BDD languages
        Examples:
        | keyword  | suggestion |
      //| it       | given      |
        | describe | scenario   |
        `, () => {
            let featureGherkin: string;

            given(`the following feature
            """
            feature("Ensure bad Gherkin is not allowed", () => {
                scenario("Scenario uses bdd syntax", ()=> {
                    <keyword>("a <keyword> step definition is added to a feature", () => { });
                });
            });            
            """`, () => {
                    featureGherkin = stepContext.docString;
                });

            when(`executing feature`, async () => {
                try {
                    await LiveDoc.executeDynamicTestAsync(featureGherkin);
                }
                catch (e) {
                    parseException = e;
                }
            });

            then(`a parseException with the following description is thrown 
            """
            This Scenario is using bdd syntax, did you mean to use <suggestion> instead?
            """`, () => {
                    stepContext.docString.should.eql(parseException.description);
                });
        });
});
