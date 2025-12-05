import { feature, scenarioOutline, scenario, Given, When, Then, And } from "../app/livedoc";
import { LiveDoc } from "../app/livedoc";
import { ExecutionResults, ScenarioOutline as ScenarioOutlineModel } from "../app/model";
import * as chai from 'chai';

chai.should();

feature("Scenario Outline keyword", () => {
    let executionResults: ExecutionResults;

    scenario(`Meta-data for Scenario Outline added to model
        @dynamic
        `, (ctx) => {
        Given(`the following feature
        
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
        `, (ctx) => { });

        When("executing feature", async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(ctx.scenario.given!.docString);
        });

        Then(`the execution results for the step are:
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
        `, (ctx) => {
            const expected = ctx.step!.docStringAsEntity;
            const scenarioOutline = executionResults.features[0].scenarios[0] as ScenarioOutlineModel;

            const actual = {
                "title": scenarioOutline.title,
                "description": scenarioOutline.description,
                "tags": scenarioOutline.tags,
                "tables": scenarioOutline.tables
            };

            chai.expect(actual).to.deep.equal(expected);
        });
    });
});

feature("Scenario Outline statement", () => {
    let weightTotal = 0;
    let weightTotalMultiTable = 0;

    scenarioOutline(`feeding a suckler cow

        Examples:
            | weight | energy | protein |
            |    450 |  26500 |     215 |
            |    500 |  29500 |     245 |
            |    575 |  31500 |     255 |
            |    600 |  37000 |     305 |
        `, (ctx) => {

        Given("the cow weighs <weight> kg", (ctx) => {
            weightTotal += ctx.example?.weight;
        });

        When("we calculate the feeding requirements", (ctx) => {
            // Calculation happens in the Given
        });

        Then("the energy should be <energy> MJ", (ctx) => {
            // Just verify the value is available
            if (ctx.example) {
                const expectedEnergy = ctx.example.energy;
                if (!expectedEnergy) {
                    throw new Error("Energy value not found in example");
                }
            }
        });

        And("the protein should be <protein> kg", (ctx) => {
            // Just verify the value is available
            if (ctx.example) {
                const expectedProtein = ctx.example.protein;
                if (!expectedProtein) {
                    throw new Error("Protein value not found in example");
                }
            }
        });

        And("the title should have the examples bound <weight>", (ctx) => {
            if (ctx.step?.title.includes("<weight>")) {
                throw new Error("Title should have weight bound but still contains placeholder");
            }
            // Title should contain the actual weight value
            const weight = ctx.example?.weight;
            if (weight && !ctx.step?.title.includes(String(weight))) {
                throw new Error(`Title should contain weight ${weight}`);
            }
        });
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
                `, (ctx) => {

        Given("the cow weighs <weight> kg", (ctx) => {
            weightTotalMultiTable += ctx.example?.weight;
        });

        When("we calculate the feeding requirements", (ctx) => {
            // Calculation happens in the Given
        });

        Then("the energy should be <energy> MJ", (ctx) => {
            // Just verify the value is available
        });

        And("the protein should be <protein> kg", (ctx) => {
            // Just verify the value is available
        });

        And("the title should have the examples bound <weight>", (ctx) => {
            if (ctx.step?.title.includes("<weight>")) {
                throw new Error("Title should have weight bound but still contains placeholder");
            }
        });
    });

    scenario("validate outline provided the correct values to steps", (ctx) => {
        Given("the previous scenario was a Scenario Outline", (ctx) => { });
        When("the scenario has completed", (ctx) => { });
        Then("the total of the weight column provided to the given is 2125", (ctx) => {
            if (weightTotal !== 2125) {
                throw new Error(`Expected weightTotal to be 2125 but got ${weightTotal}`);
            }
        });
    });

    scenario("validate multi-table outline provided the correct values to steps", (ctx) => {
        Given("the previous scenario was a Scenario Outline", (ctx) => { });
        When("the scenario has completed", (ctx) => { });
        Then("the total of the weight column provided to the given is 8250", (ctx) => {
            if (weightTotalMultiTable !== 8250) {
                throw new Error(`Expected weightTotalMultiTable to be 8250 but got ${weightTotalMultiTable}`);
            }
        });
    });
});
