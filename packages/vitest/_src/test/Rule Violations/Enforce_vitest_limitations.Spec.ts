require('chai').should();
import { LiveDoc, feature, scenario, scenarioOutline, Given, When, Then } from "../../app/livedoc";
import { ParserException, StepContext, ScenarioContext } from "../../app/model/index";

feature(`Enforce vitest limitations
    @dynamic

    vitest only supports async operations on test/it statements. Describes must be synchronous

    `, (ctx) => {
        let parseException: ParserException;
        let outlineGiven: StepContext;

        scenarioOutline(`Use of async on top level describe alias'
            Examples:
            | alias    | display name |
            | feature  | Feature      |
            | describe | describe     |
        `, (ctx) => {
                Given(`the following feature
            """
            import { <alias> } from './livedoc';
            
            <alias>("<alias> may not be marked as async", async () => { });            
            """
            `, (ctx) => {
                        outlineGiven = ctx.step;
                    });

                When(`executing feature`, async (ctx) => {
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!);
                    }
                    catch (e) {
                        parseException = e;
                    }
                });

                Then(`a parse exception with the following description is thrown 
            """
            The async keyword is not supported for <display name>
            """`, (ctx) => {
                        ctx.step.docString.should.eql(parseException.description);
                    });

            });

        scenario(`Use of async on scenarioOutline describe alias'`, (ctx) => {
            Given(`the following feature
            """
            import { feature, scenarioOutline } from './livedoc';
            
            feature("Describe alias' do not support async", ()=> {
                scenarioOutline(\`Scenario Outline may not be marked as async
                    Examples:
                    | col1  |
                    | value |
                \`, async () => { });            
            });
            """
            `, (ctx) => {
                    outlineGiven = ctx.step;
                });

            When(`executing feature`, async (ctx) => {
                try {
                    await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!);
                }
                catch (e) {
                    parseException = e;
                }
            });

            Then(`a parse exception with the following description is thrown 
            """
            The async keyword is not supported for Scenario Outline
            """`, (ctx) => {
                    ctx.step.docString.should.eql(parseException.description);
                });

        });


        scenarioOutline(`Use of async on child level describe alias'
            Examples:
            | alias      | display name |
            | scenario   | Scenario     |
            | background | Background   |
        `, (ctx) => {
                Given(`the following feature
            """
            import { feature, <alias> } from './livedoc';
            
            feature("Describe alias' do not support async", ()=> {
                <alias>("<display name> may not be marked as async", async () => { });            
            });
            """
            `, (ctx) => {
                        outlineGiven = ctx.step;
                    });

                When(`executing feature`, async (ctx) => {
                    try {
                        await LiveDoc.executeDynamicTestAsync(outlineGiven.docString!);
                    }
                    catch (e) {
                        parseException = e;
                    }
                });

                Then(`a parse exception with the following description is thrown 
            """
            The async keyword is not supported for <display name>
            """`, (ctx) => {
                        ctx.step.docString.should.eql(parseException.description);
                    });

            });

    });
