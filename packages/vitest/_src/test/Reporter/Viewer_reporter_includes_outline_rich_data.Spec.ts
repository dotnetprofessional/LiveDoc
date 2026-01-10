require('chai').should();

import { expect } from "vitest";
import { NodeSchema } from "@livedoc/schema";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";
import * as model from "../../app/model/index";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";

feature("Viewer reporter includes rich ScenarioOutline data", () => {
    scenario("Posting a ScenarioOutline includes tables and rich step fields", () => {
        let posted: Array<{ parentId?: string; node: any }> = [];

        let results: model.ExecutionResults;

        given(`an ExecutionResults with a Feature that contains a ScenarioOutline with two example tables, a template step with docString/dataTable/values/code, and one example bound to the first table row
        """
        {
            "feature": {
                "title": "Rich Outline Feature",
                "filename": "D:/repo/root/features/RichOutline.Spec.ts"
            },
            "outline": {
                "title": "scenarios can have multiple data tables",
                "description": "Outline description",
                "tags": ["outline-tag"],
                "tables": [
                    {
                        "name": "Australian Cows",
                        "description": "AU",
                        "dataTable": [
                            ["weight", "energy", "protein"],
                            ["450", "26500", "215"]
                        ]
                    },
                    {
                        "name": "New Zealand Cows",
                        "description": "NZ",
                        "dataTable": [
                            ["weight", "energy", "protein"],
                            ["1450", "46500", "1215"]
                        ]
                    }
                ],
                "templateStep": {
                    "type": "given",
                    "title": "the cow weighs <weight> kg",
                    "docStringRaw": "template docstring",
                    "dataTable": [["k", "v"], ["a", "b"]],
                    "values": [1, true],
                    "code": "// template code"
                },
                "example": {
                    "values": {
                        "weight": "450",
                        "energy": "26500",
                        "protein": "215"
                    },
                    "step": {
                        "type": "given",
                        "title": "the cow weighs <weight> kg",
                        "docStringRaw": "example docstring",
                        "dataTable": [["x", "y"], ["1", "2"]],
                        "values": [2, false],
                        "code": "// example code"
                    }
                }
            }
        }
        """
        `, (ctx) => {
            const spec = ctx.step.docStringAsEntity as any;

            results = new model.ExecutionResults();

            const sdkFeature = new model.Feature();
            sdkFeature.title = String(spec.feature.title);
            sdkFeature.filename = String(spec.feature.filename);
            sdkFeature.tags = [];

            const sdkOutline = new model.ScenarioOutline(sdkFeature);
            sdkOutline.title = String(spec.outline.title);
            sdkOutline.description = String(spec.outline.description);
            sdkOutline.tags = Array.isArray(spec.outline.tags) ? spec.outline.tags.map(String) : [];

            for (const t of spec.outline.tables as any[]) {
                const table = new model.Table();
                table.name = String(t.name);
                table.description = String(t.description ?? "");
                table.dataTable = t.dataTable;
                sdkOutline.tables.push(table);
            }

            const templateStep = new model.StepDefinition(sdkOutline, String(spec.outline.templateStep.title));
            templateStep.type = String(spec.outline.templateStep.type);
            templateStep.rawTitle = String(spec.outline.templateStep.title);
            templateStep.docStringRaw = String(spec.outline.templateStep.docStringRaw);
            templateStep.dataTable = spec.outline.templateStep.dataTable;
            templateStep.values = spec.outline.templateStep.values;
            templateStep.code = String(spec.outline.templateStep.code);
            templateStep.setStatus(model.SpecStatus.pass, 1);
            sdkOutline.addStep(templateStep);

            const sdkExample = new model.ScenarioExample(sdkFeature, sdkOutline);
            sdkExample.title = sdkOutline.title;
            sdkExample.description = "";
            sdkExample.tags = [];
            sdkExample.example = spec.outline.example.values;
            sdkExample.exampleRaw = spec.outline.example.values;

            const exampleStep = new model.StepDefinition(sdkExample, String(spec.outline.example.step.title));
            exampleStep.type = String(spec.outline.example.step.type);
            // Important: for executed steps, prefer title (bound) over rawTitle.
            exampleStep.rawTitle = "";
            exampleStep.docStringRaw = String(spec.outline.example.step.docStringRaw);
            // Simulate the bound docString we want the viewer to display when the step is executed.
            exampleStep.docString = "example docstring (bound)";
            exampleStep.dataTable = spec.outline.example.step.dataTable;
            exampleStep.values = spec.outline.example.step.values;
            exampleStep.code = String(spec.outline.example.step.code);
            exampleStep.setStatus(model.SpecStatus.pass, 1);
            sdkExample.addStep(exampleStep);

            sdkOutline.examples = [sdkExample];
            sdkFeature.addScenario(sdkOutline);

            results.addFeature(sdkFeature);
        });

        when("posting the execution results to the viewer server", async () => {
            const originalFetch = globalThis.fetch;
            posted = [];

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);

                if (urlString.includes("/api/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ runId: "run-1", websocketUrl: "" }),
                        text: async () => "",
                    } as any;
                }

                if (urlString.includes("/api/runs/run-1/nodes")) {
                    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
                    posted.push({ parentId: body?.parentId, node: body?.node });
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" } as any;
                }

                if (urlString.includes("/api/runs/run-1/complete")) {
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" } as any;
                }

                return { ok: true, status: 200, json: async () => ({}), text: async () => "" } as any;
            };

            try {
                const viewerReporter = new LiveDocViewerReporter({
                    server: "http://localhost:3100",
                    project: "vitest",
                    environment: "local",
                    silent: true,
                });

                await viewerReporter.execute(results);
            } finally {
                globalThis.fetch = originalFetch;
            }
        });

        then("all posted nodes validate against NodeSchema", () => {
            expect(posted.length).toBeGreaterThan(0);

            for (const p of posted) {
                const parsed = NodeSchema.safeParse(p.node);
                if (!parsed.success) {
                    throw new Error(`Invalid node payload: ${JSON.stringify(parsed.error.format(), null, 2)}`);
                }
            }
        });

        and("the posted ScenarioOutline includes '2' example tables named 'Australian Cows' and 'New Zealand Cows'", (ctx) => {
            const [expectedCount, expectedName1, expectedName2] = ctx.step.values;

            const outlineNode = posted.map((p) => p.node).find((n) => n?.kind === "ScenarioOutline" && n?.title === "scenarios can have multiple data tables");
            outlineNode.should.exist;

            expect(Array.isArray(outlineNode.tables)).toBe(true);
            expect(outlineNode.tables.length).toBe(Number(expectedCount));
            expect(outlineNode.tables.map((t: any) => t.name)).toEqual([String(expectedName1), String(expectedName2)]);
        });

        and("the ScenarioOutline tables include stable rowIds for table '0' row '1'", (ctx) => {
            const [tableIndex, rowIndex] = ctx.step.values;

            const outlineNode = posted.map((p) => p.node).find((n) => n?.kind === "ScenarioOutline" && n?.title === "scenarios can have multiple data tables");
            outlineNode.should.exist;

            const expectedRowIdPrefix = `${outlineNode.id}:table:${Number(tableIndex)}:row:${Number(rowIndex)}`;
            const firstRowId = outlineNode.tables?.[Number(tableIndex)]?.rows?.[Number(rowIndex) - 1]?.rowId;
            expect(firstRowId).toBe(expectedRowIdPrefix);
        });

        and(`the ScenarioOutline template step includes the rich fields
        """
        {
            "keyword": "given",
            "title": "the cow weighs <weight> kg",
            "docString": "template docstring",
            "dataTable": [["k", "v"], ["a", "b"]],
            "values": [1, true],
            "code": "// template code"
        }
        """
        `, (ctx) => {
            const expected = ctx.step.docStringAsEntity as any;

            const outlineNode = posted.map((p) => p.node).find((n) => n?.kind === "ScenarioOutline" && n?.title === "scenarios can have multiple data tables");
            outlineNode.should.exist;

            const templateStep = outlineNode.template?.children?.[0];
            templateStep.should.exist;

            expect(templateStep.keyword).toBe(expected.keyword);
            expect(templateStep.title).toBe(expected.title);
            expect(templateStep.docString).toBe(expected.docString);
            expect(templateStep.code).toBe(expected.code);

            expect(templateStep.dataTable?.headers).toEqual(expected.dataTable[0]);
            expect(templateStep.dataTable?.rows?.[0]?.values?.map((v: any) => v.value)).toEqual(expected.dataTable[1]);
            expect(templateStep.values?.map((v: any) => v.value)).toEqual(expected.values);
        });

        and(`the posted example Scenario node includes a binding.rowId that maps to the matching Examples table row
        """
        {
            "weight": "450",
            "energy": "26500",
            "protein": "215"
        }
        """
        `, (ctx) => {
            const expectedExample = ctx.step.docStringAsEntity as any;

            const outlineNode = posted.map((p) => p.node).find((n) => n?.kind === "ScenarioOutline" && n?.title === "scenarios can have multiple data tables");
            outlineNode.should.exist;

            const exampleNode = posted
                .filter((p) => p.parentId === outlineNode.id)
                .map((p) => p.node)
                .find((n) => n?.kind === "Scenario" && n?.binding?.variables?.length);
            exampleNode.should.exist;

            const expectedRowId = `${outlineNode.id}:table:0:row:1`;
            expect(exampleNode.binding.rowId).toBe(expectedRowId);

            const variables = Object.fromEntries(exampleNode.binding.variables.map((v: any) => [v.name, String(v.value?.value ?? "")]));
            expect(variables).toEqual({
                weight: String(expectedExample.weight),
                energy: String(expectedExample.energy),
                protein: String(expectedExample.protein)
            });
        });

        and(`the posted example step includes the rich fields
        """
        {
            "keyword": "given",
            "docString": "example docstring (bound)",
            "dataTable": [["x", "y"], ["1", "2"]],
            "values": [2, false],
            "code": "// example code"
        }
        """
        `, (ctx) => {
            const expected = ctx.step.docStringAsEntity as any;

            const outlineNode = posted.map((p) => p.node).find((n) => n?.kind === "ScenarioOutline" && n?.title === "scenarios can have multiple data tables");
            outlineNode.should.exist;

            const exampleNode = posted
                .filter((p) => p.parentId === outlineNode.id)
                .map((p) => p.node)
                .find((n) => n?.kind === "Scenario" && n?.binding?.variables?.length);
            exampleNode.should.exist;

            const stepNode = posted.find((p) => p.parentId === exampleNode.id && p.node?.kind === "Step")?.node;
            stepNode.should.exist;

            expect(stepNode.keyword).toBe(expected.keyword);
            expect(stepNode.docString).toBe(expected.docString);
            expect(stepNode.code).toBe(expected.code);

            expect(stepNode.dataTable?.headers).toEqual(expected.dataTable[0]);
            expect(stepNode.dataTable?.rows?.[0]?.values?.map((v: any) => v.value)).toEqual(expected.dataTable[1]);
            expect(stepNode.values?.map((v: any) => v.value)).toEqual(expected.values);
        });

        and(`template steps prefer the templated docStringRaw even if executed steps have a bound docString
        """
        {
            "templateDocString": "template docstring",
            "executedDocString": "example docstring (bound)"
        }
        """
        `, (ctx) => {
            const expected = ctx.step.docStringAsEntity as any;

            const outlineNode = posted.map((p) => p.node).find((n) => n?.kind === "ScenarioOutline" && n?.title === "scenarios can have multiple data tables");
            outlineNode.should.exist;

            const templateStep = outlineNode.template?.children?.[0];
            templateStep.should.exist;
            expect(templateStep.docString).toBe(expected.templateDocString);

            const exampleNode = posted
                .filter((p) => p.parentId === outlineNode.id)
                .map((p) => p.node)
                .find((n) => n?.kind === "Scenario" && n?.binding?.variables?.length);
            exampleNode.should.exist;

            const executedStep = posted.find((p) => p.parentId === exampleNode.id && p.node?.kind === "Step")?.node;
            executedStep.should.exist;
            expect(executedStep.docString).toBe(expected.executedDocString);
        });
    });
});
