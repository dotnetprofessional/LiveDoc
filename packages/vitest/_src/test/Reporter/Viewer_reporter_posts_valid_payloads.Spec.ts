require('chai').should();

import { expect } from "vitest";
import { NodeSchema } from "@livedoc/schema";
import LiveDocServerReporter from "../../app/reporter/LiveDocServerReporter";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";

feature("Viewer reporter posts valid payloads", () => {
    scenario("Posting results produces schema-valid nodes including tags and path", () => {
        let posted: Array<{ parentId?: string; node: any }> = [];
        let testModules: any[] = [];

        given(
            "a Vitest run with a Feature at 'D:/repo/root/features/Tags.Spec.ts' tagged @smoke fast with a Scenario tagged @critical, a ScenarioOutline tagged @outline, a Specification at 'D:/repo/root/specs/SpecTags.Spec.ts' tagged @spec-tag, and a Suite at 'D:/repo/root/suites/Pure.Spec.ts'",
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
                                    result: { state: "pass", duration: 1 }
                                }
                            ]
                        },
                        {
                            type: "suite",
                            name: "Scenario Outline: Tagged Outline\n@outline\nOutline description",
                            tasks: [
                                {
                                    type: "suite",
                                    name: "Example 1",
                                    tasks: [
                                        {
                                            type: "test",
                                            name: "when an action occurs",
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
                            result: { state: "pass", duration: 1 }
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

        when("building execution results via LiveDocServerReporter and posting via LiveDocViewerReporter", async () => {
            const serverReporter = new LiveDocServerReporter();
            const results = (serverReporter as any).buildExecutionResults(testModules);

            const originalFetch = globalThis.fetch;
            posted = [];

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);

                if (urlString.includes("/api/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ runId: "run-1", websocketUrl: "" }),
                        text: async () => ""
                    };
                }

                if (urlString.includes("/api/runs/run-1/nodes")) {
                    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
                    posted.push({ parentId: body?.parentId, node: body?.node });
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
                }

                if (urlString.includes("/api/runs/run-1/complete")) {
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
            "all posted nodes validate against NodeSchema and include expected tags and paths for root documents",
            () => {
                expect(posted.length).toBeGreaterThan(0);

                for (const p of posted) {
                    const parsed = NodeSchema.safeParse(p.node);
                    if (!parsed.success) {
                        throw new Error(`Invalid node payload: ${JSON.stringify(parsed.error.format(), null, 2)}`);
                    }
                }

                const roots = posted.filter((p) => !p.parentId).map((p) => p.node);

                const featureNode = roots.find((n) => n.kind === "Feature" && n.title === "Tagged Feature");
                expect(featureNode).toBeTruthy();
                expect(String(featureNode.path)).toMatch(/(?:^|\/|\\)features\/(?:Tags\.Spec\.ts)$/);
                expect(featureNode.tags).toEqual(["smoke", "fast"]);
                expect(featureNode.description).toBe("Feature description");

                const specNode = roots.find((n) => n.kind === "Specification" && n.title === "Tagged Spec");
                expect(specNode).toBeTruthy();
                expect(String(specNode.path)).toMatch(/(?:^|\/|\\)specs\/(?:SpecTags\.Spec\.ts)$/);
                expect(specNode.tags).toEqual(["spec-tag"]);
                expect(specNode.description).toBe("Spec description");

                const suiteNode = roots.find((n) => n.kind === "Suite" && n.title === "Pure Suite");
                expect(suiteNode).toBeTruthy();
                expect(String(suiteNode.path)).toMatch(/(?:^|\/|\\)suites\/(?:Pure\.Spec\.ts)$/);
            }
        );

        and("the Scenario, ScenarioOutline, Rule, and Step nodes include expected tags and keyword", () => {
            const featureRoot = posted.find((p) => !p.parentId && p.node.kind === "Feature" && p.node.title === "Tagged Feature")?.node;
            expect(featureRoot).toBeTruthy();

            const scenarioNode = posted.find((p) => p.parentId === featureRoot.id && p.node.kind === "Scenario" && p.node.title === "Tagged Scenario")?.node;
            expect(scenarioNode).toBeTruthy();
            expect(scenarioNode.tags).toEqual(["critical"]);
            expect(scenarioNode.description).toBe("Scenario description");

            const outlineNode = posted.find((p) => p.parentId === featureRoot.id && p.node.kind === "ScenarioOutline" && p.node.title === "Tagged Outline")?.node;
            expect(outlineNode).toBeTruthy();
            expect(outlineNode.tags).toEqual(["outline"]);
            expect(outlineNode.description).toBe("Outline description");

            const stepNode = posted.find((p) => p.parentId === scenarioNode.id && p.node.kind === "Step")?.node;
            expect(stepNode).toBeTruthy();
            expect(stepNode.keyword).toBe("given");
            expect(stepNode.title).toBe("a precondition");

            const specRoot = posted.find((p) => !p.parentId && p.node.kind === "Specification" && p.node.title === "Tagged Spec")?.node;
            expect(specRoot).toBeTruthy();

            const ruleNode = posted.find((p) => p.parentId === specRoot.id && p.node.kind === "Rule" && p.node.title === "Tagged Rule")?.node;
            expect(ruleNode).toBeTruthy();
            expect(ruleNode.tags).toEqual(["rule-tag"]);
            expect(ruleNode.description).toBe("Rule description");
        });
    });
});
