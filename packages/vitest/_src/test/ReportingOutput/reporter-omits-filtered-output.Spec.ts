import { expect } from "vitest";
import LiveDocSpecReporter from "../../app/reporter/LiveDocSpecReporter";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature(`Reporter omits filtered LiveDoc tasks
    @reporting-output @filtering
    Filtered LiveDoc tasks are omitted when the reporter rebuilds execution
    results from Vitest's task tree, so the viewer does not receive pending
    placeholders for tests excluded by LiveDoc filters.
    `, () => {
    let testModules: any[];
    let results: any;

    scenario("Filtered tasks do not become pending viewer nodes", () => {
        given("a reporter task tree contains included scenario 'included scenario', filtered scenario 'filtered scenario', included rule 'included rule', and filtered rule 'filtered rule'", (ctx) => {
            const [includedScenario, filteredScenario, includedRule, filteredRule] = ctx.step.valuesRaw;

            testModules = [
                {
                    task: {
                        filepath: "D:/repo/features/Filtering.Spec.ts",
                        tasks: [
                            {
                                type: "suite",
                                name: "Feature: Filtered viewer output",
                                tasks: [
                                    {
                                        type: "suite",
                                        name: `Scenario: ${includedScenario}`,
                                        tasks: [
                                            {
                                                type: "test",
                                                name: "given an included precondition",
                                                meta: {
                                                    livedoc: {
                                                        kind: "step",
                                                        step: {
                                                            type: "given",
                                                            rawTitle: "an included precondition",
                                                        },
                                                    },
                                                },
                                                result: { state: "pass", duration: 1 },
                                            },
                                        ],
                                    },
                                    {
                                        type: "suite",
                                        name: `Scenario: ${filteredScenario}`,
                                        tasks: [
                                            {
                                                type: "test",
                                                name: "given a filtered precondition",
                                                meta: {
                                                    livedoc: {
                                                        kind: "step",
                                                        step: {
                                                            type: "given",
                                                            rawTitle: "a filtered precondition",
                                                        },
                                                        filter: {
                                                            filteredOut: true,
                                                            reason: "include-miss",
                                                        },
                                                    },
                                                },
                                                mode: "skip",
                                                result: { state: "skip", duration: 0 },
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                type: "suite",
                                name: "Specification: Filtered specification output",
                                tasks: [
                                    {
                                        type: "test",
                                        name: `Rule: ${includedRule}`,
                                        meta: {
                                            livedoc: {
                                                kind: "rule",
                                                rule: {
                                                    title: includedRule,
                                                    tags: [],
                                                    description: "",
                                                },
                                            },
                                        },
                                        result: { state: "pass", duration: 1 },
                                    },
                                    {
                                        type: "test",
                                        name: `Rule: ${filteredRule}`,
                                        meta: {
                                            livedoc: {
                                                kind: "rule",
                                                rule: {
                                                    title: filteredRule,
                                                    tags: [],
                                                    description: "",
                                                },
                                                filter: {
                                                    filteredOut: true,
                                                    reason: "exclude",
                                                },
                                            },
                                        },
                                        mode: "skip",
                                        result: { state: "skip", duration: 0 },
                                    },
                                ],
                            },
                        ],
                    },
                },
            ];
        });

        when("building execution results from the reporter task tree", () => {
            const reporter = new LiveDocSpecReporter({ detailLevel: "silent" });
            results = (reporter as any).buildExecutionResults(testModules);
        });

        then("the Feature output contains only scenario 'included scenario' and no scenario named 'filtered scenario'", (ctx) => {
            const [includedScenario, filteredScenario] = ctx.step.valuesRaw;
            const featureResult = results.features[0];

            expect(results.features).toHaveLength(1);
            expect(featureResult.scenarios.map((scenario: any) => scenario.title)).toEqual([includedScenario]);
            expect(featureResult.scenarios.map((scenario: any) => scenario.title)).not.toContain(filteredScenario);
            expect(featureResult.statistics.pendingCount).toBe(0);
        });

        and("the Specification output contains only rule 'included rule' and no rule named 'filtered rule'", (ctx) => {
            const [includedRule, filteredRule] = ctx.step.valuesRaw;
            const specificationResult = results.specifications[0];

            expect(results.specifications).toHaveLength(1);
            expect(specificationResult.rules.map((rule: any) => rule.title)).toEqual([includedRule]);
            expect(specificationResult.rules.map((rule: any) => rule.title)).not.toContain(filteredRule);
            expect(specificationResult.statistics.pendingCount).toBe(0);
        });
    });
});
