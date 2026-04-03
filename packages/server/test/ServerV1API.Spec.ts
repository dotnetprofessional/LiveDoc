import { feature, scenario, background, given, when, Then, and } from "@swedevtools/livedoc-vitest";
import { expect } from "vitest";
import { createServer, type LiveDocServer } from "../src/index.js";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

// ---------------------------------------------------------------------------
// Helpers — reusable payload builders
// ---------------------------------------------------------------------------

function makeStep(id: string, keyword: string, title: string, status = "passed", duration = 10) {
    return {
        id, kind: "Step", keyword, title,
        execution: { status, duration },
    };
}

function makeScenario(id: string, title: string, steps: any[], status = "passed", duration = 50) {
    return {
        id, kind: "Scenario", title, steps,
        execution: { status, duration },
    };
}

function makeRule(id: string, title: string, status = "passed", duration = 20) {
    return {
        id, kind: "Rule", title,
        execution: { status, duration },
    };
}

function makeScenarioOutline(
    id: string, title: string,
    steps: any[], examples: any[], exampleResults: any[],
    statistics: any
) {
    return {
        id, kind: "ScenarioOutline", title, steps, examples, exampleResults,
        statistics,
        execution: { status: "passed", duration: 100 },
    };
}

function makeRuleOutline(
    id: string, title: string,
    examples: any[], exampleResults: any[],
    statistics: any
) {
    return {
        id, kind: "RuleOutline", title, examples, exampleResults,
        statistics,
        execution: { status: "passed", duration: 80 },
    };
}

function makeTestCase(id: string, title: string, tests: any[], kind = "Feature") {
    const passed = tests.length;
    return {
        id, kind, title, path: `Tests/${title.replace(/\s/g, "_")}.cs`,
        tests,
        statistics: { total: passed, passed, failed: 0, pending: 0, skipped: 0 },
    };
}

// ---------------------------------------------------------------------------
// Feature: V1 Run Lifecycle
// ---------------------------------------------------------------------------

feature(`V1 API — Run Lifecycle
    @integration @api @v1
    Validates the core run lifecycle: start, upsert test cases with tests, complete, and retrieve.
    This is the exact flow the xUnit reporter uses.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-v1-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({ port: 0, host: "localhost", dataDir: testDataDir });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;
        });

        ctx.afterBackground(async () => {
            if (server) await server.stop();
            try { await fs.rm(testDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
        });
    });

    // ------------------------------------------------------------------
    scenario("Starting a V1 run returns a runId and protocol version", () => {
        let response: Response;
        let data: any;

        when("starting a V1 run for project 'MyProject' environment 'local' framework 'xunit'", async () => {
            response = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "MyProject", environment: "local", framework: "xunit" }),
            });
            data = await response.json();
        });

        Then("the response status should be '201'", (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });

        and("the protocolVersion should be '1.0'", () => {
            expect(data.protocolVersion).toBe("1.0");
        });

        and("a runId should be returned", () => {
            expect(data.runId).toBeDefined();
            expect(typeof data.runId).toBe("string");
        });
    });

    // ------------------------------------------------------------------
    scenario("Upserting a test case with Scenario tests preserves the tests array", () => {
        let runId: string;
        let upsertResponse: Response;
        let run: any;

        given("a V1 run has been started", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "TestProject", environment: "local", framework: "xunit" }),
            });
            runId = (await res.json()).runId;
        });

        when("upserting a test case containing '2' Scenario tests with steps", async (ctx) => {
            const testCase = makeTestCase("tc-1", "User Login", [
                makeScenario("sc-1", "Valid credentials", [
                    makeStep("sc-1:step0", "given", "a registered user"),
                    makeStep("sc-1:step1", "when", "they enter valid credentials"),
                    makeStep("sc-1:step2", "then", "they are logged in"),
                ]),
                makeScenario("sc-2", "Invalid credentials", [
                    makeStep("sc-2:step0", "given", "a registered user"),
                    makeStep("sc-2:step1", "when", "they enter wrong password"),
                    makeStep("sc-2:step2", "then", "an error is shown", "failed", 30),
                ], "failed", 60),
            ]);

            upsertResponse = await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase }),
            });
        });

        Then("the upsert response status should be '200'", (ctx) => {
            expect(upsertResponse.status).toBe(ctx.step.values[0]);
        });

        and("retrieving the run should show '1' document with '2' tests", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            expect(run.documents).toHaveLength(ctx.step.values[0]);
            expect(run.documents[0].tests).toHaveLength(ctx.step.values[1]);
        });

        and("the first test should be a Scenario named 'Valid credentials' with '3' steps", (ctx) => {
            const test = run.documents[0].tests[0];
            expect(test.kind).toBe("Scenario");
            expect(test.title).toBe(ctx.step.values[0]);
            expect(test.steps).toHaveLength(ctx.step.values[1]);
        });

        and("each step should have a keyword and execution status", () => {
            const steps = run.documents[0].tests[0].steps;
            expect(steps[0].keyword).toBe("given");
            expect(steps[0].execution.status).toBe("passed");
            expect(steps[2].keyword).toBe("then");
        });
    });

    // ------------------------------------------------------------------
    scenario("Completing a V1 run sets final status and duration", () => {
        let runId: string;
        let run: any;

        given("a V1 run exists with test data", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "CompletionTest", environment: "ci", framework: "xunit" }),
            });
            runId = (await res.json()).runId;

            await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testCase: makeTestCase("tc-c1", "Feature A", [
                        makeRule("r-1", "Rule one"),
                    ], "Specification"),
                }),
            });
        });

        when("completing the run with status 'passed' and duration '5000'", async (ctx) => {
            await fetch(`${baseUrl}/api/v1/runs/${runId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "passed",
                    duration: ctx.step.values[1],
                    summary: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
                }),
            });
        });

        Then("the run status should be 'passed'", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            expect(run.status).toBe(ctx.step.values[0]);
        });

        and("the run duration should be '5000'", (ctx) => {
            expect(run.duration).toBe(ctx.step.values[0]);
        });

        and("the documents should still contain '1' test", (ctx) => {
            expect(run.documents[0].tests).toHaveLength(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Run listing returns all V1 runs", () => {
        let data: any;

        given("'2' V1 runs have been started", async (ctx) => {
            for (let i = 0; i < ctx.step.values[0]; i++) {
                await fetch(`${baseUrl}/api/v1/runs/start`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ project: `ListProject${i}`, environment: "local", framework: "xunit" }),
                });
            }
        });

        when("listing all V1 runs", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs`);
            data = await res.json();
        });

        Then("at least '2' runs should be returned", (ctx) => {
            expect(data.length).toBeGreaterThanOrEqual(ctx.step.values[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: V1 Batch Upsert
// ---------------------------------------------------------------------------

feature(`V1 API — Batch Upsert with Completion
    @integration @api @v1
    The xUnit reporter sends all test cases in a single batch request, optionally completing the run in the same call.
    This tests the exact payload shape the reporter produces.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-v1-batch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({ port: 0, host: "localhost", dataDir: testDataDir });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;
        });

        ctx.afterBackground(async () => {
            if (server) await server.stop();
            try { await fs.rm(testDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
        });
    });

    // ------------------------------------------------------------------
    scenario("Batch upsert with '3' test cases preserves all tests", () => {
        let runId: string;
        let batchResponse: Response;
        let run: any;

        given("a V1 run has been started for project 'BatchProject'", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "BatchProject", environment: "local", framework: "xunit" }),
            });
            runId = (await res.json()).runId;
        });

        when("batch upserting '3' test cases each with '1' Scenario test", async () => {
            const testCases = [
                makeTestCase("tc-b1", "Feature A", [makeScenario("sc-b1", "Scenario A1", [
                    makeStep("sc-b1:s0", "given", "setup"), makeStep("sc-b1:s1", "then", "verify"),
                ])]),
                makeTestCase("tc-b2", "Feature B", [makeScenario("sc-b2", "Scenario B1", [
                    makeStep("sc-b2:s0", "when", "action"),
                ])]),
                makeTestCase("tc-b3", "Feature C", [makeScenario("sc-b3", "Scenario C1", [
                    makeStep("sc-b3:s0", "given", "data"), makeStep("sc-b3:s1", "then", "check"),
                ])]),
            ];

            batchResponse = await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCases }),
            });
        });

        Then("the batch response status should be '200'", (ctx) => {
            expect(batchResponse.status).toBe(ctx.step.values[0]);
        });

        and("the run should contain '3' documents each with populated tests", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            expect(run.documents).toHaveLength(ctx.step.values[0]);
            for (const doc of run.documents) {
                expect(doc.tests.length).toBeGreaterThan(0);
                expect(doc.tests[0].kind).toBe("Scenario");
            }
        });
    });

    // ------------------------------------------------------------------
    scenario("Batch upsert with completion atomically stores tests and completes the run", () => {
        let runId: string;
        let batchResponse: Response;
        let batchData: any;
        let run: any;

        given("a V1 run has been started", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "AtomicBatch", environment: "ci", framework: "xunit" }),
            });
            runId = (await res.json()).runId;
        });

        when("batch upserting '2' test cases AND completing the run in one request", async () => {
            const testCases = [
                makeTestCase("tc-a1", "Auth Feature", [
                    makeScenario("sc-a1", "Login", [
                        makeStep("sc-a1:s0", "given", "a user"),
                        makeStep("sc-a1:s1", "when", "logging in"),
                        makeStep("sc-a1:s2", "then", "success"),
                    ]),
                ]),
                makeTestCase("tc-a2", "Profile Feature", [
                    makeScenario("sc-a2", "View Profile", [
                        makeStep("sc-a2:s0", "given", "logged in user"),
                        makeStep("sc-a2:s1", "then", "profile is shown"),
                    ]),
                ]),
            ];

            batchResponse = await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testCases,
                    complete: {
                        status: "passed",
                        duration: 12000,
                        summary: { total: 2, passed: 2, failed: 0, pending: 0, skipped: 0 },
                    },
                }),
            });
            batchData = await batchResponse.json();
        });

        Then("the batch response should indicate success with count '2'", (ctx) => {
            expect(batchResponse.status).toBe(200);
            expect(batchData.count).toBe(ctx.step.values[0]);
        });

        and("the run should be completed with status 'passed'", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            expect(run.status).toBe(ctx.step.values[0]);
        });

        and("both documents should have their tests intact", () => {
            expect(run.documents).toHaveLength(2);
            expect(run.documents[0].tests).toHaveLength(1);
            expect(run.documents[0].tests[0].steps.length).toBeGreaterThan(0);
            expect(run.documents[1].tests).toHaveLength(1);
            expect(run.documents[1].tests[0].steps.length).toBeGreaterThan(0);
        });

        and("the run duration should be '12000'", (ctx) => {
            expect(run.duration).toBe(ctx.step.values[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: V1 Test Types
// ---------------------------------------------------------------------------

feature(`V1 API — All Test Types
    @integration @api @v1
    Validates that every test kind (Scenario, ScenarioOutline, Rule, RuleOutline) is accepted and persisted correctly.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;
    let runId: string;

    background("Running server with active run", (ctx) => {
        given("a LiveDoc server is running with an active V1 run", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-v1-types-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({ port: 0, host: "localhost", dataDir: testDataDir });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;

            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "TypeTests", environment: "local", framework: "xunit" }),
            });
            runId = (await res.json()).runId;
        });

        ctx.afterBackground(async () => {
            if (server) await server.stop();
            try { await fs.rm(testDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
        });
    });

    // ------------------------------------------------------------------
    scenario("A test case with a ScenarioOutline including examples and results", () => {
        let run: any;

        when("upserting a test case with a ScenarioOutline with '2' example rows", async () => {
            const outline = makeScenarioOutline(
                "so-1", "Login with various credentials",
                [makeStep("so-1:s0", "given", "a user with <email>"), makeStep("so-1:s1", "then", "result is <expected>")],
                [{
                    headers: ["email", "expected"],
                    rows: [
                        { rowId: 0, values: [{ value: "a@b.com", type: "string" }, { value: true, type: "boolean" }] },
                        { rowId: 1, values: [{ value: "invalid", type: "string" }, { value: false, type: "boolean" }] },
                    ],
                }],
                [
                    { testId: "so-1:row0", result: { rowId: 0, status: "passed", duration: 20 } },
                    { testId: "so-1:row1", result: { rowId: 1, status: "failed", duration: 15, error: { message: "Expected true" } } },
                ],
                { total: 2, passed: 1, failed: 1, pending: 0, skipped: 0 },
            );

            const testCase = makeTestCase("tc-so", "Auth Scenarios", [outline]);
            testCase.statistics = { total: 2, passed: 1, failed: 1, pending: 0, skipped: 0 };

            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase }),
            });
            expect(res.status).toBe(200);
        });

        Then("the stored outline should have kind 'ScenarioOutline'", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            const outline = run.documents[0].tests[0];
            expect(outline.kind).toBe(ctx.step.values[0]);
        });

        and("the outline should have '2' example results", (ctx) => {
            const outline = run.documents[0].tests[0];
            expect(outline.exampleResults).toHaveLength(ctx.step.values[0]);
        });

        and("the outline should have '2' template steps", (ctx) => {
            const outline = run.documents[0].tests[0];
            expect(outline.steps).toHaveLength(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("A test case with Rule and RuleOutline tests (Specification style)", () => {
        let run: any;

        when("upserting a Specification with '1' Rule and '1' RuleOutline", async () => {
            const ruleTest = makeRule("r-1", "Adding positive numbers increases value");

            const ruleOutline = makeRuleOutline(
                "ro-1", "Multiplying numbers",
                [{
                    headers: ["a", "b", "expected"],
                    rows: [
                        { rowId: 0, values: [{ value: 2, type: "number" }, { value: 3, type: "number" }, { value: 6, type: "number" }] },
                        { rowId: 1, values: [{ value: 5, type: "number" }, { value: 0, type: "number" }, { value: 0, type: "number" }] },
                    ],
                }],
                [
                    { testId: "ro-1:row0", result: { rowId: 0, status: "passed", duration: 5 } },
                    { testId: "ro-1:row1", result: { rowId: 1, status: "passed", duration: 3 } },
                ],
                { total: 2, passed: 2, failed: 0, pending: 0, skipped: 0 },
            );

            const testCase = makeTestCase("tc-spec", "Calculator Rules", [ruleTest, ruleOutline], "Specification");
            testCase.statistics = { total: 3, passed: 3, failed: 0, pending: 0, skipped: 0 };

            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase }),
            });
            expect(res.status).toBe(200);
        });

        Then("the document should have '2' tests", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            const doc = run.documents.find((d: any) => d.id === "tc-spec");
            expect(doc.tests).toHaveLength(ctx.step.values[0]);
        });

        and("the first test should be a Rule", () => {
            const doc = run.documents.find((d: any) => d.id === "tc-spec");
            expect(doc.tests[0].kind).toBe("Rule");
        });

        and("the second test should be a RuleOutline with '2' example results", (ctx) => {
            const doc = run.documents.find((d: any) => d.id === "tc-spec");
            expect(doc.tests[1].kind).toBe("RuleOutline");
            expect(doc.tests[1].exampleResults).toHaveLength(ctx.step.values[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: V1 Patch Execution & Outline Results
// ---------------------------------------------------------------------------

feature(`V1 API — Execution Patching and Outline Results
    @integration @api @v1
    Tests individual test execution updates and outline example result upserts.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;
    let runId: string;

    background("Running server with test data", (ctx) => {
        given("a V1 run with a Scenario and a ScenarioOutline exists", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-v1-patch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({ port: 0, host: "localhost", dataDir: testDataDir });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;

            const startRes = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "PatchTests", environment: "local", framework: "xunit" }),
            });
            runId = (await startRes.json()).runId;

            const outline = makeScenarioOutline(
                "so-patch", "Outline for patching",
                [makeStep("so-patch:s0", "given", "data")],
                [{ headers: ["x"], rows: [{ rowId: 0, values: [{ value: 1, type: "number" }] }] }],
                [],
                { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            );

            const testCase = makeTestCase("tc-patch", "Patch Feature", [
                makeScenario("sc-patch", "Scenario for patching", [
                    makeStep("sc-patch:s0", "given", "initial state"),
                ], "running", 0),
                outline,
                makeRule("rule-patch", "Rule for patching", "running", 10),
            ]);

            await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase }),
            });
        });

        ctx.afterBackground(async () => {
            if (server) await server.stop();
            try { await fs.rm(testDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
        });
    });

    // ------------------------------------------------------------------
    scenario("Patching a test execution updates status and duration", () => {
        let patchResponse: Response;
        let run: any;

        when("patching test 'rule-patch' with status 'passed' and duration '150'", async () => {
            patchResponse = await fetch(`${baseUrl}/api/v1/runs/${runId}/tests/rule-patch/execution`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "passed", duration: 150 }),
            });
        });

        Then("the patch response status should be '200'", (ctx) => {
            expect(patchResponse.status).toBe(ctx.step.values[0]);
        });

        and("the test execution should show status 'passed' and duration '150'", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            const rule = run.documents[0].tests.find((t: any) => t.id === "rule-patch");
            expect(rule.execution.status).toBe("passed");
            expect(rule.execution.duration).toBe(150);
        });
    });

    // ------------------------------------------------------------------
    scenario("Patching a test execution with an error includes error details", () => {
        let run: any;

        when("patching test 'rule-patch' with status 'failed' and an error message", async () => {
            await fetch(`${baseUrl}/api/v1/runs/${runId}/tests/rule-patch/execution`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "failed",
                    duration: 200,
                    error: { message: "Expected true but got false", stack: "at Test.run()" },
                }),
            });
        });

        Then("the test should have an error with message 'Expected true but got false'", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            const rule = run.documents[0].tests.find((t: any) => t.id === "rule-patch");
            expect(rule.execution.error).toBeDefined();
            expect(rule.execution.error.message).toBe(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Upserting example results to an outline", () => {
        let upsertResponse: Response;
        let run: any;

        when("upserting '1' example result to outline 'so-patch'", async () => {
            upsertResponse = await fetch(`${baseUrl}/api/v1/runs/${runId}/outlines/so-patch/example-results`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    results: [
                        { testId: "so-patch:row0", result: { rowId: 0, status: "passed", duration: 25 } },
                    ],
                }),
            });
        });

        Then("the upsert response status should be '200'", (ctx) => {
            expect(upsertResponse.status).toBe(ctx.step.values[0]);
        });

        and("the outline should have '1' example result", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            const outline = run.documents[0].tests.find((t: any) => t.id === "so-patch");
            expect(outline.exampleResults).toHaveLength(ctx.step.values[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: V1 Test Case Merge Behavior
// ---------------------------------------------------------------------------

feature(`V1 API — Test Case Merge Behavior
    @integration @api @v1
    When a test case is upserted multiple times, the server must correctly merge or replace data.
    Arrays (like tests) are replaced entirely. This tests the exact pattern the xUnit reporter uses
    when it sends a real-time update (partial) followed by a batch (full).
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;
    let runId: string;

    background("Running server with active run", (ctx) => {
        given("a V1 run has been started", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-v1-merge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({ port: 0, host: "localhost", dataDir: testDataDir });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;

            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "MergeTests", environment: "local", framework: "xunit" }),
            });
            runId = (await res.json()).runId;
        });

        ctx.afterBackground(async () => {
            if (server) await server.stop();
            try { await fs.rm(testDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
        });
    });

    // ------------------------------------------------------------------
    scenario("Upserting a test case with empty tests then with populated tests replaces correctly", () => {
        let run: any;

        given("a test case is upserted with '0' tests (real-time placeholder)", async (ctx) => {
            const emptyTestCase = makeTestCase("tc-merge", "Merge Feature", []);
            emptyTestCase.statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };

            await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase: emptyTestCase }),
            });
        });

        when("the same test case is upserted again with '2' tests (batch flush)", async (ctx) => {
            const fullTestCase = makeTestCase("tc-merge", "Merge Feature", [
                makeScenario("sc-m1", "Test A", [makeStep("sc-m1:s0", "given", "setup")]),
                makeScenario("sc-m2", "Test B", [makeStep("sc-m2:s0", "when", "action")]),
            ]);

            await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase: fullTestCase }),
            });
        });

        Then("the test case should have '2' tests (batch data wins)", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            const doc = run.documents.find((d: any) => d.id === "tc-merge");
            expect(doc.tests).toHaveLength(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Upserting a test case with populated tests then with empty tests loses data", () => {
        let run: any;

        given("a test case is upserted with '1' test", async (ctx) => {
            const testCase = makeTestCase("tc-overwrite", "Overwrite Feature", [
                makeScenario("sc-ow1", "Original Test", [makeStep("sc-ow1:s0", "then", "check")]),
            ]);

            await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase }),
            });
        });

        when("the same test case is upserted with '0' tests (stale real-time publish)", async (ctx) => {
            const emptyTestCase = makeTestCase("tc-overwrite", "Overwrite Feature", []);
            emptyTestCase.statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };

            await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ testCase: emptyTestCase }),
            });
        });

        Then("the test case should have '0' tests (array was replaced)", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
            run = await res.json();
            const doc = run.documents.find((d: any) => d.id === "tc-overwrite");
            expect(doc.tests).toHaveLength(ctx.step.values[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: V1 Schema Validation
// ---------------------------------------------------------------------------

feature(`V1 API — Schema Validation
    @integration @api @v1
    The server rejects malformed payloads with '400' status codes.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-v1-validation-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({ port: 0, host: "localhost", dataDir: testDataDir });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;
        });

        ctx.afterBackground(async () => {
            if (server) await server.stop();
            try { await fs.rm(testDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
        });
    });

    // ------------------------------------------------------------------
    scenario("Starting a run without required fields returns '400'", () => {
        let response: Response;

        when("posting an empty object to /api/v1/runs/start", async () => {
            response = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
        });

        Then("the response status should be '400'", (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Upserting a test case with invalid test kind returns '400'", () => {
        let runId: string;
        let response: Response;

        given("a V1 run exists", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "ValidationProject", environment: "local", framework: "xunit" }),
            });
            runId = (await res.json()).runId;
        });

        when("upserting a test case with a test missing required execution field", async () => {
            response = await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testCase: {
                        id: "tc-bad", kind: "Feature", title: "Bad",
                        tests: [{ id: "t-bad", kind: "Rule", title: "Missing execution" }],
                        statistics: { total: 1, passed: 0, failed: 0, pending: 0, skipped: 0 },
                    },
                }),
            });
        });

        Then("the response status should be '400'", (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Patching execution with unknown fields on strict schema returns '400'", () => {
        let runId: string;
        let response: Response;

        given("a V1 run exists with a test", async () => {
            const res = await fetch(`${baseUrl}/api/v1/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "StrictProject", environment: "local", framework: "xunit" }),
            });
            runId = (await res.json()).runId;

            await fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testCase: makeTestCase("tc-strict", "Strict Feature", [
                        makeRule("r-strict", "Strict rule"),
                    ]),
                }),
            });
        });

        when("patching execution with an unknown field 'extraField'", async () => {
            response = await fetch(`${baseUrl}/api/v1/runs/${runId}/tests/r-strict/execution`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "passed", duration: 10, extraField: "not allowed" }),
            });
        });

        Then("the response status should be '400'", (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Operating on a non-existent run returns '404'", () => {
        let response: Response;

        when("upserting a test case to a non-existent run", async () => {
            response = await fetch(`${baseUrl}/api/v1/runs/non-existent/testcases`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    testCase: makeTestCase("tc-x", "X", [makeRule("r-x", "X")]),
                }),
            });
        });

        Then("the response status should be '404'", (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });
    });
});
