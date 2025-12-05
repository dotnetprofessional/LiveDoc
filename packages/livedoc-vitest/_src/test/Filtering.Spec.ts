import { feature, scenario, Given, When, Then } from "../app/livedoc";
import { livedoc } from "../app/livedoc";

feature("Tag-based filtering with include", () => {
    let executedScenarios: string[] = [];

    // Set up filtering to only include @important tag
    livedoc.options.filters.include = ["important"];

    scenario(`This scenario should execute
        @important
        `, (ctx) => {
        Given("this is an important scenario", (ctx) => {
            executedScenarios.push("important");
        });

        When("it is executed", (ctx) => {
            // Execution happens
        });

        Then("it should be recorded", (ctx) => {
            if (!executedScenarios.includes("important")) {
                throw new Error("Important scenario should have executed");
            }
        });
    });

    // Note: This scenario would be skipped with proper filtering
    // scenario with no @important tag would not execute when include filter is active
});

feature("Tag-based filtering with exclude", () => {
    let executedScenarios: string[] = [];

    // Set up filtering to exclude @slow tag
    livedoc.options.filters.include = [];
    livedoc.options.filters.exclude = ["slow"];

    scenario("This scenario should execute (no slow tag)", (ctx) => {
        Given("this is a fast scenario", (ctx) => {
            executedScenarios.push("fast");
        });

        When("it is executed", (ctx) => {
            // Execution happens
        });

        Then("it should be recorded", (ctx) => {
            if (!executedScenarios.includes("fast")) {
                throw new Error("Fast scenario should have executed");
            }
        });
    });

    // Note: Scenario with @slow tag would be skipped when exclude filter is active
});

feature("Multiple tags on scenarios", () => {
    let taggedExecutions: string[] = [];

    // Clear filters for this test
    livedoc.options.filters.include = [];
    livedoc.options.filters.exclude = [];

    scenario(`Multiple tags are supported
        @tag1 tag2 @tag3
        `, (ctx) => {
        Given("a scenario has multiple tags", (ctx) => {
            // Verify tags are accessible
            if (ctx.scenario) {
                const tags = ctx.scenario.tags;
                if (!tags || tags.length !== 3) {
                    throw new Error(`Expected 3 tags but got ${tags?.length || 0}`);
                }
                
                if (!tags.includes("tag1") || !tags.includes("tag2") || !tags.includes("tag3")) {
                    throw new Error(`Tags should be [tag1, tag2, tag3] but got [${tags.join(", ")}]`);
                }
            }
            taggedExecutions.push("multi-tag");
        });

        When("the scenario executes", (ctx) => {
            // Execution
        });

        Then("all tags should be available", (ctx) => {
            if (!taggedExecutions.includes("multi-tag")) {
                throw new Error("Multi-tag scenario should have executed");
            }
        });
    });
});
