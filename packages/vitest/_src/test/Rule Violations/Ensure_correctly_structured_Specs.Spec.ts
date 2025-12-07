require('chai').should();
import { LiveDoc, feature, scenario, scenarioOutline, Given, When, Then, And } from "../../app/livedoc";
import { ParserException, ScenarioContext, StepContext } from "../../app/model/index";

feature(`Ensure correctly structured Specs
    @dynamic
    `, (ctx) => {
        let parseException: ParserException;
        let outlineGiven: StepContext;

        scenarioOutline(`Invalid top level keywords

        Examples:
        | keyword         | error message                                                                            |
        | scenario        | Scenario must be within a feature.                                                       |
        | scenarioOutline | Scenario Outline must be within a feature.                                               |
        | background      | Background must be within a feature.                                                     |
        | Given           | Invalid Gherkin, Given can only appear within a Background, Scenario or Scenario Outline |
        | When            | Invalid Gherkin, When can only appear within a Background, Scenario or Scenario Outline  |
        | Then            | Invalid Gherkin, Then can only appear within a Background, Scenario or Scenario Outline  |
        | And             | Invalid Gherkin, and can only appear within a Background, Scenario or Scenario Outline   |
        | But             | Invalid Gherkin, but can only appear within a Background, Scenario or Scenario Outline   |

        `, (ctx) => {
                Given(`the following feature file
                """
                import { <keyword> } from './livedoc';
                
                <keyword>('Defining a <keyword> without a feature', () => {
                    Given('a sample given', () => { });
                });
                """        
            `, (ctx) => {
                        outlineGiven = ctx.step;
                    });

                When(`executing feature`, async (ctx) => {
                    parseException = null as any;
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!);
                    }
                    catch (e) {
                        parseException = e as ParserException;
                    }
                });

                Then(`a parseException with the following description is thrown 
                """
                <error message>
                """`, (ctx) => {
                        ctx.step.docString.should.eql(parseException.description);
                    });
            });

        scenarioOutline(`Invalid Feature children
        Examples:
        | step  | display name |
        | Given | Given        |
        | When  | When         |
        | Then  | Then         |
        | And   | and          |
        | But   | but          |
        `, (ctx) => {
                let featureGherkin: string;

                Given(`the following feature
            """
            import { feature, <step> } from './livedoc';
            
            feature("Ensure bad Gherkin is not allowed", () => {
                <step>("a <step> step definition is added to a feature", () => { });
            });            
            """`, (ctx) => {
                        featureGherkin = ctx.step.docString!;
                    });

                When(`executing feature`, async (ctx) => {
                    parseException = null as any;
                    try {
                        await LiveDoc.executeDynamicTestAsync(featureGherkin);
                    }
                    catch (e) {
                        parseException = e as ParserException;
                    }
                });

                Then(`a parseException with the following description is thrown 
            """
            Invalid Gherkin, <display name> can only appear within a Background, Scenario or Scenario Outline
            """`, (ctx) => {
                        ctx.step.docString.should.eql(parseException.description);
                    });
            });

        scenarioOutline(`Invalid Background children
        Examples:
        | step | display name |
        | When | When         |
        | Then | Then         |
        `, (ctx) => {
                let featureGherkin: string;

                Given(`the following feature
            """
            import { feature, background, <step> } from './livedoc';
            
            feature("Ensure bad Gherkin is not allowed", () => {
                background("", ()=> {
                    <step>("a <step> step definition is not permitted in a background", () => { });
                });
            });            
            """`, (ctx) => {
                        featureGherkin = ctx.step.docString!;
                    });

                When(`executing feature`, async (ctx) => {
                    parseException = null as any;
                    try {
                        await LiveDoc.executeDynamicTestAsync(featureGherkin);
                    }
                    catch (e) {
                        parseException = e as ParserException;
                    }
                });

                Then(`a parseException with the following description is thrown 
            """
            Backgrounds only support using the given step definition. Consider moving the <display name> to a scenario.
            """`, (ctx) => {
                        ctx.step.docString.should.eql(parseException.description);
                    });
            });

        scenarioOutline(`Feature mixes BDD languages
        Examples:
        | keyword  | suggestion |
        | it       | given      |
        | describe | scenario   |
        `, (ctx) => {
                let featureGherkin: string;

                Given(`the following feature
            """
            import { feature, <keyword> } from './livedoc';
            
            feature("Ensure bad Gherkin is not allowed", () => {
                <keyword>("a <keyword> step definition is added to a feature", () => { });
            });            
            """`, (ctx) => {
                        featureGherkin = ctx.step.docString!;
                    });

                When(`executing feature`, async (ctx) => {
                    parseException = null as any;
                    try {
                        await LiveDoc.executeDynamicTestAsync(featureGherkin);
                    }
                    catch (e) {
                        parseException = e as ParserException;
                    }
                });

                Then(`a parseException with the following description is thrown 
            """
            This Feature is using bdd syntax, did you mean to use <suggestion> instead?
            """`, (ctx) => {
                        ctx.step.docString.should.eql(parseException.description);
                    });
            });

        scenarioOutline(`Scenario mixes BDD languages
        Examples:
        | keyword  | suggestion |
      //| it       | given      |
        | describe | scenario   |
        `, (ctx) => {
                let featureGherkin: string;

                Given(`the following feature
            """
            import { feature, scenario, <keyword> } from './livedoc';
            
            feature("Ensure bad Gherkin is not allowed", () => {
                scenario("Scenario uses bdd syntax", ()=> {
                    <keyword>("a <keyword> step definition is added to a feature", () => { });
                });
            });            
            """`, (ctx) => {
                        featureGherkin = ctx.step.docString!;
                    });

                When(`executing feature`, async (ctx) => {
                    parseException = null as any;
                    try {
                        await LiveDoc.executeDynamicTestAsync(featureGherkin);
                    }
                    catch (e) {
                        parseException = e as ParserException;
                    }
                });

                Then(`a parseException with the following description is thrown 
            """
            This Scenario is using bdd syntax, did you mean to use <suggestion> instead?
            """`, (ctx) => {
                        ctx.step.docString.should.eql(parseException.description);
                    });
            });
    });
