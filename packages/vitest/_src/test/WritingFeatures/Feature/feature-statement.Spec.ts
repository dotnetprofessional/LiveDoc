import { expect } from "vitest";
import { feature, scenario, given, when, Then as then, and } from "../../../app/livedoc";

feature(`Feature statements
    @writing-features @feature @public-doc
    Features group related scenarios and carry the title, description, and tags
    that readers see at the top of the living documentation page.
    `, (ctx) => {
    scenario("Feature context is available inside each scenario and step", () => {
        const featureContext = ctx.feature;

        given("a feature titled 'Feature statements'", () => {
        });

        when("the scenario reads ctx.feature", () => {
        });

        then("ctx.feature.title should be 'Feature statements'", (ctx) => {
            expect(featureContext.title).toBe(ctx.step.valuesRaw[0]);
            expect(ctx.feature.title).toBe(ctx.step.valuesRaw[0]);
        });

        and("ctx.feature.tags should include 'writing-features', 'feature', and 'public-doc'", (ctx) => {
            expect(featureContext.tags).toEqual(ctx.step.valuesRaw);
        });

        and("ctx.feature.description should mention 'living documentation page'", (ctx) => {
            expect(featureContext.description).toContain(ctx.step.valuesRaw[0]);
        });
    });
});
