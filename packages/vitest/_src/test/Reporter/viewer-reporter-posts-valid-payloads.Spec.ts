require('chai').should();

import { expect } from "vitest";
import { V3UpsertTestCaseRequestSchema } from "@swedevtools/livedoc-schema";
import LiveDocSpecReporter from "../../app/reporter/LiveDocSpecReporter";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature("Viewer reporter posts valid payloads", () => {
    scenario("Posting results produces schema-valid nodes including tags and path", () => {
        let posted: Array<{ testCase: any }> = [];
        let testModules: any[] = [];

        given(
            "a Vitest run with a Feature at 'D:/repo/root/features/Tags.Spec.ts' tagged @smoke fast with a Scenario tagged @critical, a ScenarioOutline tagged @outline, a Specification at 'D:/repo/root/specs/SpecTags.Spec.ts' tagged @spec-tag containing a Rule tagged @rule-tag and a RuleOutline tagged @outline-tag with Examples x=1 and x=2, and a Suite at 'D:/repo/root/suites/Pure.Spec.ts'",
            (ctx) => {
                const featureFile = String(ctx.step.values[0]);
                const specFile = String(ctx.step.values[1]);
                const suiteFile = String(ctx.step.values[2]);

                const featureTask = {
                    type: "suite",
                    name: "Feature: Tagged Feature\n@smoke fast\nFeature description",
                    tasks: [
                        {
                            type: "suite",
                            name: "Scenario: Tagged Scenario\n@critical\nScenario description",
                            tasks: [
                                {
                                    type: "test",
                                    name: "given a precondition",
                                    meta: {
                                        livedoc: {
                                            kind: "step",
                                            step: {
                                                type: "given",
                                                rawTitle: "a precondition"
                                            }
                                        }
                                    },
                                    result: { state: "pass", duration: 1 }
                                }
                            ]
                        },
                        {
                            type: "suite",
                            // Vitest represents Scenario Outlines as a "Scenario:" suite with nested "Example ..." suites.
                            // This matches what livedoc.ts registers.
                            name: "Scenario: Tagged Outline\n@outline\nOutline description",
                            tasks: [
                                {
                                    type: "suite",
                                    name: "Example 1",
                                    tasks: [
                                        {
                                            type: "test",
                                            name: "when an action occurs",
                                            meta: {
                                                livedoc: {
                                                    kind: "step",
                                                    step: {
                                                        type: "when",
                                                        rawTitle: "an action occurs"
                                                    },
                                                    scenarioOutline: {
                                                        tables: [{ name: "", description: "", dataTable: [] }],
                                                        tags: ["outline"],
                                                        description: "Outline description",
                                                        example: {
                                                            sequence: 1,
                                                            values: {}
                                                        }
                                                    }
                                                }
                                            },
                                            result: { state: "pass", duration: 1 }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                };

                const specTask = {
                    type: "suite",
                    name: "Specification: Tagged Spec\n@spec-tag\nSpec description",
                    tasks: [
                        {
                            type: "test",
                            name: "Rule: Tagged Rule\n@rule-tag\nRule description",
                            meta: {
                                livedoc: {
                                    kind: "rule",
                                    rule: {
                                        title: "Tagged Rule",
                                        description: "Rule description",
                                        tags: ["rule-tag"]
                                    }
                                }
                            },
                            result: { state: "pass", duration: 1 }
                        },
                        {
                            type: "suite",
                            name: "Rule Outline: Tagged RuleOutline",
                            tasks: [
                                {
                                    type: "test",
                                    name: "Example 1: Tagged RuleOutline",
                                    meta: {
                                        livedoc: {
                                            kind: "ruleExample",
                                            ruleOutline: {
                                                title: "Tagged RuleOutline",
                                                description: "Outline description",
                                                tags: ["outline-tag"],
                                                tables: [
                                                    {
                                                        name: "",
                                                        description: "",
                                                        dataTable: [
                                                            ["x"],
                                                            ["1"],
                                                            ["2"]
                                                        ]
                                                    }
                                                ],
                                                example: {
                                                    sequence: 1,
                                                    values: { x: 1 },
                                                    valuesRaw: { x: "1" }
                                                }
                                            }
                                        }
                                    },
                                    result: { state: "pass", duration: 1 }
                                },
                                {
                                    type: "test",
                                    name: "Example 2: Tagged RuleOutline",
                                    meta: {
                                        livedoc: {
                                            kind: "ruleExample",
                                            ruleOutline: {
                                                title: "Tagged RuleOutline",
                                                description: "Outline description",
                                                tags: ["outline-tag"],
                                                tables: [
                                                    {
                                                        name: "",
                                                        description: "",
                                                        dataTable: [
                                                            ["x"],
                                                            ["1"],
                                                            ["2"]
                                                        ]
                                                    }
                                                ],
                                                example: {
                                                    sequence: 2,
                                                    values: { x: 2 },
                                                    valuesRaw: { x: "2" }
                                                }
                                            }
                                        }
                                    },
                                    result: { state: "pass", duration: 1 }
                                }
                            ]
                        }
                    ]
                };

                const suiteTask = {
                    type: "suite",
                    name: "Pure Suite",
                    tasks: [
                        {
                            type: "test",
                            name: "a plain vitest test",
                            result: { state: "pass", duration: 1 }
                        }
                    ]
                };

                testModules = [
                    { task: { filepath: featureFile, tasks: [featureTask] } },
                    { task: { filepath: specFile, tasks: [specTask] } },
                    { task: { filepath: suiteFile, tasks: [suiteTask] } }
                ];
            }
        );

        when("building execution results via LiveDocSpecReporter and posting via LiveDocViewerReporter", async () => {
            const reporter = new LiveDocSpecReporter({ detailLevel: 'silent' });
            const results = (reporter as any).buildExecutionResults(testModules);

            const originalFetch = globalThis.fetch;
            posted = [];

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);

                if (urlString.includes("/api/v3/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ protocolVersion: "3.0", runId: "run-1", websocketUrl: "" }),
                        text: async () => ""
                    };
                }

                if (urlString.includes("/api/v3/runs/run-1/testcases")) {
                    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
                    posted.push({ testCase: body?.testCase });
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
                }

                if (urlString.includes("/api/v3/runs/run-1/complete")) {
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
                }

                return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
            };

            try {
                const viewerReporter = new LiveDocViewerReporter({
                    server: "http://localhost:3100",
                    project: "vitest",
                    environment: "local",
                    silent: true
                });

                await viewerReporter.execute(results);
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        then(
            "all posted testcases validate against V3UpsertTestCaseRequestSchema and include expected tags and paths for root documents",
            () => {
                expect(posted.length).toBeGreaterThan(0);

                for (const p of posted) {
                    const parsed = V3UpsertTestCaseRequestSchema.safeParse({ testCase: p.testCase });
                    if (!parsed.success) {
                        throw new Error(`Invalid node payload: ${JSON.stringify(parsed.error.format(), null, 2)}`);
                    }
                }

                const roots = posted.map((p) => p.testCase);

                const featureDoc = roots.find((n) => n.style === "Feature" && n.title === "Tagged Feature");
                expect(featureDoc).toBeTruthy();
                expect(String(featureDoc.path)).toMatch(/(?:^|\/|\\)features\/(?:Tags\.Spec\.ts)$/);
                expect(featureDoc.tags).toEqual(["smoke", "fast"]);
                expect(featureDoc.description).toBe("Feature description");

                const specDoc = roots.find((n) => n.style === "Specification" && n.title === "Tagged Spec");
                expect(specDoc).toBeTruthy();
                expect(String(specDoc.path)).toMatch(/(?:^|\/|\\)specs\/(?:SpecTags\.Spec\.ts)$/);
                expect(specDoc.tags).toEqual(["spec-tag"]);
                expect(specDoc.description).toBe("Spec description");

                const suiteDoc = roots.find((n) => n.style === "Container" && n.title === "Pure Suite");
                expect(suiteDoc).toBeTruthy();
                expect(String(suiteDoc.path)).toMatch(/(?:^|\/|\\)suites\/(?:Pure\.Spec\.ts)$/);
            }
        );

        and(
            "the posted Container document includes the Test 'a plain vitest test' with status 'passed' and statistics total '1' passed '1' pending '0'",
            (ctx) => {
                const [testTitle, expectedStatus, expectedTotal, expectedPassed, expectedPending] = ctx.step.values;

                const roots = posted.map((p) => p.testCase);
                const suiteDoc = roots.find((n) => n.style === "Container" && n.title === "Pure Suite");
                expect(suiteDoc).toBeTruthy();

                const suiteTests = (suiteDoc as any).tests || [];
                const plainTest = suiteTests.find((t: any) => t.kind === "Test" && t.title === String(testTitle));
                expect(plainTest).toBeTruthy();
                expect(plainTest.execution?.status).toBe(String(expectedStatus));

                expect((suiteDoc as any).statistics?.total).toBe(expectedTotal);
                expect((suiteDoc as any).statistics?.passed).toBe(expectedPassed);
                expect((suiteDoc as any).statistics?.pending).toBe(expectedPending);
            }
        );

        and("the Scenario, ScenarioOutline, Rule, RuleOutline, and Step tests include expected tags and keyword", () => {
            const featureDoc = posted.map((p) => p.testCase).find((n) => n.style === "Feature" && n.title === "Tagged Feature");
            expect(featureDoc).toBeTruthy();

            const scenarioTest = featureDoc.tests.find((t: any) => t.kind === "Scenario" && t.title === "Tagged Scenario");
            expect(scenarioTest).toBeTruthy();
            expect(scenarioTest.tags).toEqual(["critical"]);
            expect(scenarioTest.description).toBe("Scenario description");

            const outlineTest = featureDoc.tests.find((t: any) => t.kind === "ScenarioOutline" && t.title === "Tagged Outline");
            expect(outlineTest).toBeTruthy();
            expect(outlineTest.tags).toEqual(["outline"]);
            expect(outlineTest.description).toBe("Outline description");

            const stepTest = scenarioTest.steps?.[0];
            expect(stepTest).toBeTruthy();
            expect(stepTest.keyword).toBe("given");
            expect(stepTest.title).toBe("a precondition");

            const specDoc = posted.map((p) => p.testCase).find((n) => n.style === "Specification" && n.title === "Tagged Spec");
            expect(specDoc).toBeTruthy();

            const ruleTest = specDoc.tests.find((t: any) => t.kind === "Rule" && t.title === "Tagged Rule");
            expect(ruleTest).toBeTruthy();
            expect(ruleTest.tags).toEqual(["rule-tag"]);
            expect(ruleTest.description).toBe("Rule description");

            const ruleOutlineTest = specDoc.tests.find((t: any) => t.kind === "RuleOutline" && t.title === "Tagged RuleOutline");
            expect(ruleOutlineTest).toBeTruthy();
            expect(ruleOutlineTest.tags).toEqual(["outline-tag"]);
            expect(ruleOutlineTest.description).toBe("Outline description");
            expect(Array.isArray(ruleOutlineTest.examples)).toBe(true);
            expect(ruleOutlineTest.examples?.[0]?.headers).toEqual(["x"]);
            expect(ruleOutlineTest.statistics?.total).toBe(2);
            expect(ruleOutlineTest.statistics?.passed).toBe(2);
            expect(ruleOutlineTest.exampleResults?.length).toBe(2);
        });
    });
});
