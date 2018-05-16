import { LiveDoc } from "../../app/livedoc";
import { StepContext } from "../../app/model/StepContext";
import { ParserException } from "../../app/model";

require('chai').should();


feature(`Enforce mocha limitations

    mocha only supports async operations on it statements. Describes must be synchronous

    `, () => {
        let parseException: ParserException;
        let outlineGiven: StepContext;

        scenarioOutline(`Use of async on top level describe alias'
            Examples:
            | alias    | display name |
            | feature  | Feature      |
            | describe | describe     |
        `, () => {
                given(`the following feature
            """
            <alias>("<alias> may not be marked as async", async () => { });            
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

                then(`a parse exception with the following description is thrown 
            """
            The async keyword is not supported for <display name>
            """`, () => {
                        stepContext.docString.should.eql(parseException.description);
                    });

            });

        scenario(`Use of async on scenarioOutline describe alias'`, () => {
            given(`the following feature
            """
            feature("Describe alias' do not support async", ()=> {
                scenarioOutline(\`Scenario Outline may not be marked as async
                    Examples:
                    | col1  |
                    | value |
                \`, async () => { });            
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

            then(`a parse exception with the following description is thrown 
            """
            The async keyword is not supported for Scenario Outline
            """`, () => {
                    stepContext.docString.should.eql(parseException.description);
                });

        });


        scenarioOutline(`Use of async on child level describe alias'
            Examples:
            | alias      | display name |
            | scenario   | Scenario     |
            | background | Background   |
        `, () => {
                given(`the following feature
            """
            feature("Describe alias' do not support async", ()=> {
                <alias>("<display name> may not be marked as async", async () => { });            
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

                then(`a parse exception with the following description is thrown 
            """
            The async keyword is not supported for <display name>
            """`, () => {
                        stepContext.docString.should.eql(parseException.description);
                    });

            });

    });