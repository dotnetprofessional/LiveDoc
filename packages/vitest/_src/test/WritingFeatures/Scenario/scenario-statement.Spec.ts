import { expect } from "vitest";
import { feature, scenario, given, when, Then as then, and } from "../../../app/livedoc";

type ScenarioSummary = {
    title: string;
    description: string;
};

feature(`Scenario statements
    @writing-features @scenario
    Scenarios describe one example of behavior within a feature. The scenario
    context exposes the title, description, tags, and steps for that example.
    `, () => {
    scenario(`Scenario context includes title, description, and tags
        @scenario-context @public-doc
        This scenario demonstrates metadata available through ctx.scenario.
        `, () => {
        let summary: ScenarioSummary;

        given(`the expected scenario metadata:
            | title       | Scenario context includes title, description, and tags |
            | description | This scenario demonstrates metadata available through ctx.scenario. |
            `, (ctx) => {
            summary = ctx.step.tableAsEntity as ScenarioSummary;
        });

        when("the scenario reads ctx.scenario", () => {
            summary = { ...summary };
        });

        then("ctx.scenario.title should match the expected title", (ctx) => {
            expect(ctx.scenario.title).toBe(summary.title);
        });

        and("ctx.scenario.description should match the expected description", (ctx) => {
            expect(ctx.scenario.description).toBe(summary.description);
        });

        and("ctx.scenario.tags should include 'scenario-context' and 'public-doc'", (ctx) => {
            expect(ctx.scenario.tags).toEqual(ctx.step.valuesRaw);
        });
    });

    scenario("Scenario setup data is isolated between scenarios", () => {
        let account = "";

        given("this scenario starts with account 'A-100'", (ctx) => {
            account = ctx.step.valuesRaw[0];
        });

        when("the scenario reads its own setup data", () => {
            account = account.trim();
        });

        then("the account should be 'A-100'", (ctx) => {
            expect(account).toBe(ctx.step.valuesRaw[0]);
        });
    });

    scenario("A different scenario gets different setup data", () => {
        let account = "";

        given("this scenario starts with account 'B-200'", (ctx) => {
            account = ctx.step.valuesRaw[0];
        });

        when("the scenario reads its own setup data", () => {
            account = account.trim();
        });

        then("the account should be 'B-200'", (ctx) => {
            expect(account).toBe(ctx.step.valuesRaw[0]);
        });
    });
});
