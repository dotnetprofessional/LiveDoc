import { feature, scenario, given, livedoc } from "../../app/livedoc";

// Note: These tests demonstrate the filtering system
// In real usage, filters would be set via configuration or command line
// For testing, we're setting them programmatically

feature("Filtering demonstration - all scenarios execute (no filters)", () => {
    // Clear any previous filters
    livedoc.options.filters.include = [];
    livedoc.options.filters.exclude = [];

    let executionCount = 0;

    scenario("Scenario without tags", (ctx) => {
        given("no tags are present", (ctx) => {
            executionCount++;
        });
    });

    scenario(`Scenario with one tag
        @smoke
        `, (ctx) => {
        given("a smoke tag is present", (ctx) => {
            executionCount++;
        });
    });

    scenario(`Scenario with multiple tags
        @smoke @critical @fast
        `, (ctx) => {
        given("multiple tags are present", (ctx) => {
            executionCount++;
            // Verify all 3 tests executed
            if (executionCount !== 3) {
                throw new Error(`Expected 3 scenarios to execute but ${executionCount} did`);
            }
        });
    });
});

feature(`Feature with tag also affects its scenarios
    @feature-level-tag
    `, () => {
    
    // Clear filters
    livedoc.options.filters.include = [];
    livedoc.options.filters.exclude = [];

    scenario("Scenario inherits feature tag", (ctx) => {
        given("the scenario is in a tagged feature", (ctx) => {
            // Verify feature-level tag is accessible
            if (ctx.feature) {
                const featureTags = ctx.feature.tags;
                if (!featureTags || !featureTags.includes("feature-level-tag")) {
                    throw new Error(`Feature should have tag but got: ${featureTags?.join(", ") || "none"}`);
                }
            }
        });
    });

    scenario(`Scenario can have its own tags too
        @scenario-level-tag
        `, (ctx) => {
        given("the scenario has its own tag", (ctx) => {
            if (ctx.scenario) {
                const scenarioTags = ctx.scenario.tags;
                if (!scenarioTags || !scenarioTags.includes("scenario-level-tag")) {
                    throw new Error(`Scenario should have tag but got: ${scenarioTags?.join(", ") || "none"}`);
                }
            }
        });
    });
});

// Note: To properly test include/exclude filtering, you would need to:
// 1. Set livedoc.options.filters.include = ["important"]
// 2. Only scenarios with @important tag would execute
// 3. Or set livedoc.options.filters.exclude = ["slow"]
// 4. Scenarios with @slow tag would be skipped

// These filters affect Vitest's describe.skip and describe.only behavior
// which is applied at test registration time
