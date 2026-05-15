import { expect } from "vitest";
import { feature, scenarioOutline, given, when, Then as then, and } from "../../../app/livedoc";

type FeedingRequirements = {
    region: string;
    weight: number;
    energy: number;
    protein: number;
};

feature(`Scenario Outline statements
    @writing-features @scenario-outline
    Scenario outlines run the same scenario once for each Examples row, with
    placeholder values bound into step titles and available through ctx.example.
    `, () => {
    scenarioOutline(`Feeding requirements are calculated for each cow weight

        Examples:
            | weight | energy | protein |
            |    450 |  26500 |     215 |
            |    500 |  29500 |     245 |
            |    575 |  31500 |     255 |
            |    600 |  37000 |     305 |
        `, () => {
        let requirements: Omit<FeedingRequirements, "region">;

        given("a cow weighing <weight> kilograms", (ctx) => {
            requirements = {
                weight: ctx.example.weight,
                energy: ctx.example.energy,
                protein: ctx.example.protein,
            };
        });

        when("the feeding requirements are read from the Examples row", () => {
            requirements = { ...requirements };
        });

        then("the energy requirement should be <energy> megajoules", (ctx) => {
            expect(requirements.energy).toBe(ctx.example.energy);
        });

        and("the protein requirement should be <protein> grams", (ctx) => {
            expect(requirements.protein).toBe(ctx.example.protein);
        });

        and("the rendered step title should include weight <weight>", (ctx) => {
            expect(ctx.step.title).toContain(String(ctx.example.weight));
        });
    });

    scenarioOutline(`Multiple Examples tables can document regional data sets

        Examples: Australian cows
            | region    | weight | energy | protein |
            | Australia |    450 |  26500 |     215 |
            | Australia |    500 |  29500 |     245 |
            | Australia |    575 |  31500 |     255 |
            | Australia |    600 |  37000 |     305 |

        Examples: New Zealand cows
            | region      | weight | energy | protein |
            | New Zealand |   1450 |  46500 |    1215 |
            | New Zealand |   1500 |  49500 |    1245 |
            | New Zealand |   1575 |  51500 |    1255 |
            | New Zealand |   1600 |  67000 |    1305 |
        `, () => {
        let requirements: FeedingRequirements;

        given("a <region> cow weighing <weight> kilograms", (ctx) => {
            requirements = {
                region: ctx.example.region,
                weight: ctx.example.weight,
                energy: ctx.example.energy,
                protein: ctx.example.protein,
            };
        });

        when("the regional feeding requirements are read from the matching Examples table", () => {
            requirements = { ...requirements };
        });

        then("the regional label should be <region>", (ctx) => {
            expect(requirements.region).toBe(ctx.example.region);
        });

        and("the energy requirement should be <energy> megajoules", (ctx) => {
            expect(requirements.energy).toBe(ctx.example.energy);
        });

        and("the protein requirement should be <protein> grams", (ctx) => {
            expect(requirements.protein).toBe(ctx.example.protein);
        });
    });
});
