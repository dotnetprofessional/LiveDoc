import { expect } from "vitest";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Tag-based filtering metadata
    @filtering-and-tags @tags @public-doc
    Include and exclude filters use the tags declared on features and
    scenarios. These examples show the metadata shape that filtering reads.
    `, () => {
    scenario(`A scenario marked important exposes the 'important' tag
        @important
        `, () => {
        let tags: string[];

        given("the scenario has tag 'important'", (ctx) => {
            tags = ctx.scenario.tags;
        });

        when("include filtering reads scenario tags", () => {
            tags = [...tags];
        });

        then("the tag list should include 'important'", (ctx) => {
            expect(tags).toContain(ctx.step.valuesRaw[0]);
        });
    });

    scenario("A fast scenario has no 'slow' tag", () => {
        let tags: string[];

        given("the scenario is intentionally untagged", (ctx) => {
            tags = ctx.scenario.tags;
        });

        when("exclude filtering reads scenario tags", () => {
            tags = [...tags];
        });

        then("the tag list should not include 'slow'", (ctx) => {
            expect(tags).not.toContain(ctx.step.valuesRaw[0]);
        });
    });

    scenario(`Multiple tags are preserved in order
        @tag1 tag2 @tag3
        `, () => {
        let tags: string[];

        given("a scenario has tags 'tag1', 'tag2', and 'tag3'", (ctx) => {
            tags = ctx.scenario.tags;
        });

        when("the scenario tag list is read", () => {
            tags = [...tags];
        });

        then("the tag list should be 'tag1', 'tag2', and 'tag3'", (ctx) => {
            expect(tags).toEqual(ctx.step.valuesRaw);
        });
    });
});
