require('chai').should();

import { expect } from "vitest";
import { V3UpsertTestCaseRequestSchema } from "@livedoc/schema";
import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";
import * as model from "../../app/model/index";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";

feature("Viewer reporter includes rich ScenarioOutline data", () => {
    scenario("Posting a ScenarioOutline includes tables and rich step fields", () => {
        let postedTestCases: any[] = [];

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
            postedTestCases = [];

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);

                if (urlString.includes("/api/v3/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ protocolVersion: "3.0", runId: "run-1", websocketUrl: "" }),
                        text: async () => "",
                    } as any;
                }

                if (urlString.includes("/api/v3/runs/run-1/testcases")) {
                    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
                    if (body?.testCase) postedTestCases.push(body.testCase);
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" } as any;
                }

                if (urlString.includes("/api/v3/runs/run-1/complete")) {
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

        then("all posted testcases validate against V3UpsertTestCaseRequestSchema", () => {
            expect(postedTestCases.length).toBeGreaterThan(0);

            for (const tc of postedTestCases) {
                const parsed = V3UpsertTestCaseRequestSchema.safeParse({ testCase: tc });
                if (!parsed.success) {
                    throw new Error(`Invalid testcase payload: ${JSON.stringify(parsed.error.format(), null, 2)}`);
                }
            }
        });

        and("the posted ScenarioOutline includes '2' example tables named 'Australian Cows' and 'New Zealand Cows'", (ctx) => {
            const [expectedCount, expectedName1, expectedName2] = ctx.step.values;

            const featureDoc = postedTestCases.find((tc) => tc?.style === "Feature" && tc?.title === "Rich Outline Feature");
            featureDoc.should.exist;

            const outlineTest = featureDoc.tests.find((t: any) => t?.kind === "ScenarioOutline" && t?.title === "scenarios can have multiple data tables");
            outlineTest.should.exist;

            expect(Array.isArray(outlineTest.examples)).toBe(true);
            expect(outlineTest.examples.length).toBe(Number(expectedCount));
            expect(outlineTest.examples.map((t: any) => t.name)).toEqual([String(expectedName1), String(expectedName2)]);
        });

        and("the ScenarioOutline example rows include a numeric rowId for table '0' row '0'", (ctx) => {
            const [tableIndex, rowIndex0] = ctx.step.values;

            const featureDoc = postedTestCases.find((tc) => tc?.style === "Feature" && tc?.title === "Rich Outline Feature");
            featureDoc.should.exist;

            const outlineTest = featureDoc.tests.find((t: any) => t?.kind === "ScenarioOutline" && t?.title === "scenarios can have multiple data tables");
            outlineTest.should.exist;

            const table = outlineTest.examples?.[Number(tableIndex)];
            table.should.exist;

            expect(typeof table.rows?.[Number(rowIndex0)]?.rowId).toBe("number");
        });

        and(`the ScenarioOutline template step includes docString and dataTables
        """
        {
            "keyword": "given",
            "title": "the cow weighs <weight> kg",
            "docString": "template docstring",
            "dataTable": [["k", "v"], ["a", "b"]],
            "values": [1, true]
        }
        """
        `, (ctx) => {
            const expected = ctx.step.docStringAsEntity as any;

            const featureDoc = postedTestCases.find((tc) => tc?.style === "Feature" && tc?.title === "Rich Outline Feature");
            featureDoc.should.exist;

            const outlineTest = featureDoc.tests.find((t: any) => t?.kind === "ScenarioOutline" && t?.title === "scenarios can have multiple data tables");
            outlineTest.should.exist;

            const templateStep = outlineTest.steps?.[0];
            templateStep.should.exist;

            expect(templateStep.keyword).toBe(expected.keyword);
            expect(templateStep.title).toBe(expected.title);
            expect(templateStep.description).toBe(`"""\n${expected.docString}\n"""`);

            const stepDataTable = (templateStep.dataTables || []).find((t: any) => !t.name);
            stepDataTable.should.exist;
            expect(stepDataTable.headers).toEqual(expected.dataTable[0]);
            expect(stepDataTable.rows?.[0]?.values?.map((v: any) => v.value)).toEqual(expected.dataTable[1]);

            const stepValuesTable = (templateStep.dataTables || []).find((t: any) => t.name === "values");
            stepValuesTable.should.exist;
            expect(stepValuesTable.rows?.[0]?.values?.map((v: any) => v.value)).toEqual(expected.values);
        });
    });

    scenario("ScenarioOutline template steps use example-step docString when template step docString is missing", () => {
        let postedTestCases: any[] = [];

        let results: model.ExecutionResults;

        given(`an ExecutionResults with a ScenarioOutline whose template step has no docString but example step has docString 'example docstring'
        """
        {
            "feature": {
                "title": "Outline DocString Backfill Feature",
                "filename": "D:/repo/root/features/OutlineDocStringBackfill.Spec.ts"
            },
            "outline": {
                "title": "outline template docstring should be backfilled",
                "tables": [
                    {
                        "dataTable": [
                            ["a"],
                            ["1"]
                        ]
                    }
                ],
                "templateStep": {
                    "type": "given",
                    "title": "the following feature"
                },
                "exampleStep": {
                    "type": "given",
                    "title": "the following feature",
                    "docStringRaw": "example docstring"
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
            sdkOutline.description = "";
            sdkOutline.tags = [];

            const table = new model.Table();
            table.name = "";
            table.description = "";
            table.dataTable = spec.outline.tables[0].dataTable;
            sdkOutline.tables.push(table);

            const templateStep = new model.StepDefinition(sdkOutline, String(spec.outline.templateStep.title));
            templateStep.type = String(spec.outline.templateStep.type);
            templateStep.rawTitle = String(spec.outline.templateStep.title);
            templateStep.docStringRaw = "";
            templateStep.docString = "";
            templateStep.setStatus(model.SpecStatus.pending, 0);
            sdkOutline.addStep(templateStep);

            const sdkExample = new model.ScenarioExample(sdkFeature, sdkOutline);
            sdkExample.title = sdkOutline.title;
            sdkExample.description = "";
            sdkExample.tags = [];
            sdkExample.sequence = 1;
            sdkExample.example = { a: "1" };
            sdkExample.exampleRaw = { a: "1" };

            const exampleStep = new model.StepDefinition(sdkExample, String(spec.outline.exampleStep.title));
            exampleStep.type = String(spec.outline.exampleStep.type);
            exampleStep.rawTitle = String(spec.outline.exampleStep.title);
            exampleStep.docStringRaw = String(spec.outline.exampleStep.docStringRaw);
            exampleStep.docString = "";
            exampleStep.setStatus(model.SpecStatus.pass, 1);
            sdkExample.addStep(exampleStep);

            sdkOutline.examples = [sdkExample];
            sdkFeature.addScenario(sdkOutline);
            results.addFeature(sdkFeature);
        });

        when("posting the execution results to the viewer server", async () => {
            const originalFetch = globalThis.fetch;
            postedTestCases = [];

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);

                if (urlString.includes("/api/v3/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ protocolVersion: "3.0", runId: "run-2", websocketUrl: "" }),
                        text: async () => "",
                    } as any;
                }

                if (urlString.includes("/api/v3/runs/run-2/testcases")) {
                    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
                    if (body?.testCase) postedTestCases.push(body.testCase);
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" } as any;
                }

                if (urlString.includes("/api/v3/runs/run-2/complete")) {
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

        then("the posted ScenarioOutline template step includes description 'example docstring' and remains pending", () => {
            const featureDoc = postedTestCases.find((tc) => tc?.style === "Feature" && tc?.title === "Outline DocString Backfill Feature");
            featureDoc.should.exist;

            const outlineTest = featureDoc.tests.find((t: any) => t?.kind === "ScenarioOutline" && t?.title === "outline template docstring should be backfilled");
            outlineTest.should.exist;

            const templateStep = outlineTest.steps?.[0];
            templateStep.should.exist;

            expect(templateStep.title).toBe("the following feature");
            expect(templateStep.description).toBe(`"""\nexample docstring\n"""`);
            expect(templateStep.execution?.status).toBe("pending");
        });
    });
});
