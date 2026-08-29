import { expect } from "vitest";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Tags make filtering choices visible
    @filtering-and-tags @public-doc
    Tags are written in feature and scenario titles so readers can see the
    same metadata that filter configuration uses.
    `, () => {
    scenario("A scenario can run without tags", () => {
        let tags: string[];

        given("a scenario has no tag lines", (ctx) => {
            tags = ctx.scenario.tags;
        });

        when("the scenario metadata is read", () => {
            tags = [...tags];
        });

        then("the scenario should have '0' tags", (ctx) => {
            expect(tags).toHaveLength(ctx.step.values[0]);
        });
    });

    scenario(`A scenario can have one tag
        @smoke
        `, () => {
        let tags: string[];

        given("a scenario is tagged with 'smoke'", (ctx) => {
            tags = ctx.scenario.tags;
        });

        when("the scenario metadata is read", () => {
            tags = [...tags];
        });

        then("the scenario tags should be 'smoke'", (ctx) => {
            expect(tags).toEqual(ctx.step.valuesRaw);
        });
    });

    scenario(`A scenario can have multiple tags
        @smoke @critical @fast
        `, () => {
        let tags: string[];

        given("a scenario is tagged with 'smoke', 'critical', and 'fast'", (ctx) => {
            tags = ctx.scenario.tags;
        });

        when("the scenario metadata is read", () => {
            tags = [...tags];
        });

        then("the scenario tags should be 'smoke', 'critical', and 'fast'", (ctx) => {
            expect(tags).toEqual(ctx.step.valuesRaw);
        });
    });
});

feature(`Feature-level tags
    @feature-level-tag
    Feature tags document metadata shared by every scenario in the feature.
    `, () => {
    scenario(`A scenario can also have its own tags
        @scenario-level-tag
        `, () => {
        let featureTags: string[];
        let scenarioTags: string[];

        given("the feature is tagged with 'feature-level-tag'", (ctx) => {
            featureTags = ctx.feature.tags;
        });

        and("the scenario is tagged with 'scenario-level-tag'", (ctx) => {
            scenarioTags = ctx.scenario.tags;
        });

        when("the tag metadata is read", () => {
            featureTags = [...featureTags];
            scenarioTags = [...scenarioTags];
        });

        then("the feature tags should be 'feature-level-tag'", (ctx) => {
            expect(featureTags).toEqual(ctx.step.valuesRaw);
        });

        and("the scenario tags should be 'scenario-level-tag'", (ctx) => {
            expect(scenarioTags).toEqual(ctx.step.valuesRaw);
        });
    });
});
