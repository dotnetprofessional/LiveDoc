///<reference path="../app/livedoc.ts" />

import { ExecutionResults, ScenarioOutline } from "../app/model";
import { LiveDoc } from "../app/livedoc";

require('chai').should();

feature(`Scenario Outline keyword`, () => {
    let executionResults: ExecutionResults;

    scenario(`Meta-data for Scenario Outline added to model`, () => {
        given(`the following feature
        
        """
        feature("Scenario Outline meta data", ()=>{
            scenarioOutline(\`Sample
                @tag1 tag2 @tag3
                This is a description of the Scenario Outline
                
                Examples: Cow energy stats
                | weight | energy | protein |
                |    450 |  26500 |     215 |
            \`, ()=>{
                given("some given step", ()=>{});
                when("some when step", ()=>{});
                then("some then step", ()=>{});
            });
        });
        """
            `, () => { });
        when(`executing feature`, async () => {
            executionResults = await LiveDoc.executeDynamicTestAsync(scenarioContext.given.docString);
        });

        then(`the execution results for the step are:
            """
            {
                "title": "Sample",
                "description": "This is a description of the Scenario Outline",
                "tags": [
                    "tag1",
                    "tag2",
                    "tag3"
                ],
                "tables": [
                    {
                        "name": "Cow energy stats",
                        "description": "",
                        "dataTable": [
                            [
                                "weight",
                                "energy",
                                "protein"
                            ],
                            [
                                "450",
                                "26500",
                                "215"
                            ]
                        ]
                    }
                ]
            
            }
            """
            `, () => {
                const expected = stepContext.docStringAsEntity;
                const scenarioOutline = executionResults.features[0].scenarios[0] as ScenarioOutline;

                const actual = {
                    "title": scenarioOutline.title,
                    "description": scenarioOutline.description,
                    "tags": scenarioOutline.tags,
                    "tables": scenarioOutline.tables
                }

                actual.should.be.eql(expected);
            });
    });
});


feature(`Scenario Outline statement`, () => {
    let weightTotal = 0;
    let weightTotalMultiTable = 0;
    scenarioOutline(`feeding a suckler cow

        Examples:
            | weight | energy | protein |
            |    450 |  26500 |     215 |
            |    500 |  29500 |     245 |
            |    575 |  31500 |     255 |
            |    600 |  37000 |     305 |
        `, () => {

            given("the cow weighs <weight> kg", (args) => {
                weightTotal += scenarioOutlineContext.example.weight;
            });

            when("we calculate the feeding requirements", () => {
            });

            then("the energy should be <energy> MJ", () => {
            });

            and("the protein should be <protein> kg", () => {
            });

            and("the title should have the examples bound <weight>", () => {
                stepContext.title.should.contain(scenarioOutlineContext.example.weight);
            })
        });

    scenarioOutline(`scenarios can have multiple data tables
        
            Examples: Australian Cows
                | weight | energy | protein |
                |    450 |  26500 |     215 |
                |    500 |  29500 |     245 |
                |    575 |  31500 |     255 |
                |    600 |  37000 |     305 |

            Examples: New Zealand Cows
                | weight | energy | protein |
                |   1450 |  46500 |    1215 |
                |   1500 |  49500 |    1245 |
                |   1575 |  51500 |    1255 |
                |   1600 |  67000 |    1305 |
                `, () => {

            given("the cow weighs <weight> kg", (args) => {
                weightTotalMultiTable += scenarioOutlineContext.example.weight;
            });

            when("we calculate the feeding requirements", () => {
            });

            then("the energy should be <energy> MJ", () => {
            });

            and("the protein should be <protein> kg", () => {
            });

            and("the title should have the examples bound <weight>", () => {
                stepContext.title.should.contain(scenarioOutlineContext.example.weight);
            })
        });

    scenario("validate outline provided the correct values to steps", () => {
        given("the previous scenario was a Scenario Outline", () => { });
        when("the scenario has completed", () => { });
        then("the total of the weight column provided to the given is '2125'", () => {
            weightTotal.should.be.equal(stepContext.values[0]);
        });
    });

    scenario("validate multi-table outline provided the correct values to steps", () => {
        given("the previous scenario was a Scenario Outline", () => { });
        when("the scenario has completed", () => { });
        then("the total of the weight column provided to the given is '8250'", () => {
            weightTotalMultiTable.should.be.equal(stepContext.values[0]);
        });
    });
});