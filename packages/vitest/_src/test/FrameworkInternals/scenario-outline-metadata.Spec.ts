import { expect } from "vitest";
import { feature, scenario, given, when, Then as then } from "../../app/livedoc";
import { LiveDoc } from "../../app/livedoc";
import { ScenarioOutline as ScenarioOutlineModel } from "../../app/model";

feature(`Scenario Outline metadata model
    @framework-internals @dynamic
    Dynamic execution should preserve scenario outline titles, tags,
    descriptions, and Examples table metadata in the internal model.
    `, () => {
    scenario("Scenario Outline metadata is added to the model", () => {
        let scenarioOutline: ScenarioOutlineModel;

        given(`the following feature source:
            """
            feature("Scenario Outline meta data", () => {
                scenarioOutline(\`Sample
                    @tag1 tag2 @tag3
                    This is a description of the Scenario Outline

                    Examples: Cow energy stats
                    | weight | energy | protein |
                    |    450 |  26500 |     215 |
                \`, () => {
                    given("some given step", () => {});
                    when("some when step", () => {});
                    then("some then step", () => {});
                });
            });
            """
            `, () => {
        });

        when("the feature source is executed dynamically", async (ctx) => {
            const executionResults = await LiveDoc.executeDynamicTestAsync(ctx.scenario.given!.docString);
            scenarioOutline = executionResults.features[0].scenarios[0] as ScenarioOutlineModel;
        });

        then(`the Scenario Outline metadata should be:
            """
            {
                "title": "Sample",
                "description": "This is a description of the Scenario Outline",
                "tags": [
                    "tag1",
                    "tag2",
                    "tag3"
                ],
                "tableName": "Cow energy stats",
                "headers": ["weight", "energy", "protein"],
                "row": ["450", "26500", "215"]
            }
            """`, (ctx) => {
            const expected = ctx.step.docStringAsEntity as {
                title: string;
                description: string;
                tags: string[];
                tableName: string;
                headers: string[];
                row: string[];
            };
            const table = scenarioOutline.tables[0];

            expect(scenarioOutline.title).toBe(expected.title);
            expect(scenarioOutline.description).toContain(expected.description);
            expect(scenarioOutline.tags).toEqual(expected.tags);
            expect(table.name).toBe(expected.tableName);
            expect(table.dataTable[0]).toEqual(expected.headers);
            expect(table.dataTable[1].map(String)).toEqual(expected.row);
        });
    });
});
