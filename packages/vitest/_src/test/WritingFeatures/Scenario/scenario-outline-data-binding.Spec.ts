import { expect } from "vitest";
import { feature, scenarioOutline, given, when, Then as then, and } from "../../../app/livedoc";

type NutritionRow = {
    weight: number;
    energy: number;
    protein: number;
};

feature(`Scenario Outline data binding
    @writing-features @scenario-outline
    Scenario outline examples should be available through ctx.example with
    the same values that readers see in the Examples table.
    `, () => {

    scenarioOutline(`Example table values are available as typed values

        Examples:
            | weight | energy | protein |
            |    100 |   5000 |      50 |
            |    200 |  10000 |     100 |
            |    300 |  15000 |     150 |
        `, () => {
        let row: NutritionRow;

        given("the example row has weight <weight>, energy <energy>, and protein <protein>", (ctx) => {
            row = {
                weight: ctx.example.weight,
                energy: ctx.example.energy,
                protein: ctx.example.protein,
            };
        });

        when("the values are read from ctx.example", () => {
            row = { ...row };
        });

        then("the example row should equal weight <weight>, energy <energy>, and protein <protein>", (ctx) => {
            expect(row).toEqual({
                weight: ctx.example.weight,
                energy: ctx.example.energy,
                protein: ctx.example.protein,
            });
        });

        and("weight, energy, and protein should all be numbers", () => {
            expect(typeof row.weight).toBe("number");
            expect(typeof row.energy).toBe("number");
            expect(typeof row.protein).toBe("number");
        });
    });

    scenarioOutline(`Step titles replace placeholders with example values

        Examples:
            | name  | age | expectedTitle                          |
            | Alice |  25 | the person Alice is 25 years old      |
            | Bob   |  30 | the person Bob is 30 years old        |
        `, () => {
        let givenTitle: string;

        given("the person <name> is <age> years old", (ctx) => {
            givenTitle = ctx.step.title;
        });

        when("the given step title is read from ctx.step.title", () => {
            givenTitle = givenTitle.trim();
        });

        then("the given step title should equal <expectedTitle>", (ctx) => {
            expect(givenTitle).toBe(ctx.example.expectedTitle);
        });
    });
});
