import { feature, scenario, background, given, when, Then, and } from "@swedevtools/livedoc-vitest";
import { expect } from "vitest";
import { createServer, type LiveDocServer } from "../src/index.js";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

// ---------------------------------------------------------------------------
// Helpers — reusable payload builders (copied from ServerV1API.Spec.ts)
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

function makeTestCase(id: string, title: string, tests: any[], kind = "Feature") {
    const passed = tests.filter((t: any) => t.execution?.status === "passed").length;
    const failed = tests.filter((t: any) => t.execution?.status === "failed").length;
    const total = tests.length;
    return {
        id, kind, title, path: `Tests/${title.replace(/\s/g, "_")}.cs`,
        tests,
        statistics: { total, passed, failed, pending: 0, skipped: 0 },
    };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function startRun(baseUrl: string, project: string, environment: string, framework = "xunit"): Promise<{ runId: string; response: Response }> {
    const response = await fetch(`${baseUrl}/api/v1/runs/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, environment, framework }),
    });
    const data = await response.json();
    return { runId: data.runId, response };
}

async function completeRun(
    baseUrl: string,
    runId: string,
    status: string,
    duration: number,
    summary: { total: number; passed: number; failed: number; pending: number; skipped: number },
): Promise<Response> {
    return fetch(`${baseUrl}/api/v1/runs/${runId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, duration, summary }),
    });
}

async function upsertTestCase(baseUrl: string, runId: string, testCase: any): Promise<Response> {
    return fetch(`${baseUrl}/api/v1/runs/${runId}/testcases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCase }),
    });
}

async function getRun(baseUrl: string, runId: string): Promise<any> {
    const res = await fetch(`${baseUrl}/api/v1/runs/${runId}`);
    return res.json();
}

// ---------------------------------------------------------------------------
// Feature: Session Creation via Run Lifecycle
// ---------------------------------------------------------------------------

feature(`Session API — Session Creation via Run Lifecycle
    @integration @api @session
    Validates that starting runs creates and reuses sessions based on project/environment grouping.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
    scenario("Starting a run assigns a sessionId to the run", () => {
        let runId: string;
        let run: any;

        when("starting a run for project 'SessionProject' environment 'local'", async () => {
            const result = await startRun(baseUrl, "SessionProject", "local");
            runId = result.runId;
        });

        Then("retrieving the run should include a sessionId", async () => {
            run = await getRun(baseUrl, runId);
            expect(run.sessionId).toBeDefined();
            expect(typeof run.sessionId).toBe("string");
        });
    });

    // ------------------------------------------------------------------
    scenario("Two runs for the same project and environment get the same sessionId", () => {
        let runId1: string;
        let runId2: string;
        let sessionId1: string;
        let sessionId2: string;

        given("a run is started for project 'SharedSession' environment 'ci'", async () => {
            const result = await startRun(baseUrl, "SharedSession", "ci");
            runId1 = result.runId;
        });

        and("a second run is started for project 'SharedSession' environment 'ci'", async () => {
            const result = await startRun(baseUrl, "SharedSession", "ci");
            runId2 = result.runId;
        });

        Then("both runs should share the same sessionId", async () => {
            const run1 = await getRun(baseUrl, runId1);
            const run2 = await getRun(baseUrl, runId2);
            sessionId1 = run1.sessionId;
            sessionId2 = run2.sessionId;
            expect(sessionId1).toBe(sessionId2);
        });
    });

    // ------------------------------------------------------------------
    scenario("Runs for different projects get different sessionIds", () => {
        let runIdA: string;
        let runIdB: string;

        given("a run is started for project 'ProjectAlpha' environment 'local'", async () => {
            const result = await startRun(baseUrl, "ProjectAlpha", "local");
            runIdA = result.runId;
        });

        and("a run is started for project 'ProjectBeta' environment 'local'", async () => {
            const result = await startRun(baseUrl, "ProjectBeta", "local");
            runIdB = result.runId;
        });

        Then("the runs should have different sessionIds", async () => {
            const runA = await getRun(baseUrl, runIdA);
            const runB = await getRun(baseUrl, runIdB);
            expect(runA.sessionId).not.toBe(runB.sessionId);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: Session Query Endpoints
// ---------------------------------------------------------------------------

feature(`Session API — Session Query Endpoints
    @integration @api @session
    Tests the GET endpoints for listing and retrieving sessions.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-query-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
    scenario("Listing sessions for a project and environment", () => {
        let runId: string;
        let sessionsResponse: Response;
        let sessionsData: any;

        given("a run has been started for project 'QueryProject' environment 'staging'", async () => {
            const result = await startRun(baseUrl, "QueryProject", "staging");
            runId = result.runId;
        });

        when("querying sessions for project 'QueryProject' environment 'staging'", async () => {
            sessionsResponse = await fetch(`${baseUrl}/api/v1/sessions?project=QueryProject&environment=staging`);
            sessionsData = await sessionsResponse.json();
        });

        Then("the response status should be '200'", (ctx) => {
            expect(sessionsResponse.status).toBe(ctx.step.values[0]);
        });

        and("at least '1' session should be returned", (ctx) => {
            expect(sessionsData.sessions.length).toBeGreaterThanOrEqual(ctx.step.values[0]);
        });

        and("the session should have a sessionId matching the run", async () => {
            const run = await getRun(baseUrl, runId);
            const sessionIds = sessionsData.sessions.map((s: any) => s.sessionId);
            expect(sessionIds).toContain(run.sessionId);
        });
    });

    // ------------------------------------------------------------------
    scenario("Retrieving a session by its sessionId", () => {
        let sessionId: string;
        let sessionResponse: Response;
        let sessionData: any;

        given("a run exists for project 'DetailProject' environment 'dev'", async () => {
            const result = await startRun(baseUrl, "DetailProject", "dev");
            const run = await getRun(baseUrl, result.runId);
            sessionId = run.sessionId;
        });

        when("fetching the session by its sessionId", async () => {
            sessionResponse = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}`);
            sessionData = await sessionResponse.json();
        });

        Then("the response status should be '200'", (ctx) => {
            expect(sessionResponse.status).toBe(ctx.step.values[0]);
        });

        and("the session project should be 'DetailProject'", (ctx) => {
            expect(sessionData.project).toBe(ctx.step.values[0]);
        });

        and("the session environment should be 'dev'", (ctx) => {
            expect(sessionData.environment).toBe(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Missing query params returns '400' error", () => {
        let response: Response;

        when("querying sessions without project or environment", async () => {
            response = await fetch(`${baseUrl}/api/v1/sessions`);
        });

        Then("the response status should be '400'", (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Unknown sessionId returns '404' error", () => {
        let response: Response;

        when("fetching a session with id 'nonexistent-id-12345'", async (ctx) => {
            response = await fetch(`${baseUrl}/api/v1/sessions/${ctx.step.values[0]}`);
        });

        Then("the response status should be '404'", (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: Session Aggregation End-to-End
// ---------------------------------------------------------------------------

feature(`Session API — Session Aggregation
    @integration @api @session
    Tests that completing multiple runs aggregates status, summary, and run info into the session.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-agg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
    scenario("Aggregating '2' completed runs into one session", () => {
        let runId1: string;
        let runId2: string;
        let sessionId: string;
        let session: any;

        given("a first run is started for project 'AggProject' environment 'ci'", async () => {
            const result = await startRun(baseUrl, "AggProject", "ci");
            runId1 = result.runId;
        });

        and("a second run is started for project 'AggProject' environment 'ci'", async () => {
            const result = await startRun(baseUrl, "AggProject", "ci");
            runId2 = result.runId;
        });

        and("the sessionId is captured from the first run", async () => {
            const run = await getRun(baseUrl, runId1);
            sessionId = run.sessionId;
        });

        when("completing run1 with status 'passed' and summary total '5' passed '5' failed '0'", async (ctx) => {
            await completeRun(baseUrl, runId1, "passed", 1000, {
                total: ctx.step.values[1],
                passed: ctx.step.values[2],
                failed: ctx.step.values[3],
                pending: 0,
                skipped: 0,
            });
        });

        and("completing run2 with status 'failed' and summary total '10' passed '7' failed '3'", async (ctx) => {
            await completeRun(baseUrl, runId2, "failed", 2000, {
                total: ctx.step.values[1],
                passed: ctx.step.values[2],
                failed: ctx.step.values[3],
                pending: 0,
                skipped: 0,
            });
        });

        Then("the session status should be 'failed'", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}`);
            session = await res.json();
            expect(session.status).toBe(ctx.step.values[0]);
        });

        and("the session summary total should be '15'", (ctx) => {
            expect(session.summary.total).toBe(ctx.step.values[0]);
        });

        and("the session summary passed should be '12'", (ctx) => {
            expect(session.summary.passed).toBe(ctx.step.values[0]);
        });

        and("the session summary failed should be '3'", (ctx) => {
            expect(session.summary.failed).toBe(ctx.step.values[0]);
        });

        and("the session should contain '2' runs", (ctx) => {
            expect(session.runs).toHaveLength(ctx.step.values[0]);
        });
    });

    // ------------------------------------------------------------------
    scenario("Session status reflects the worst run status", () => {
        let runId1: string;
        let runId2: string;
        let sessionId: string;
        let session: any;

        given("two runs are started for project 'StatusProject' environment 'ci'", async () => {
            const r1 = await startRun(baseUrl, "StatusProject", "ci");
            const r2 = await startRun(baseUrl, "StatusProject", "ci");
            runId1 = r1.runId;
            runId2 = r2.runId;
            const run = await getRun(baseUrl, runId1);
            sessionId = run.sessionId;
        });

        when("run1 completes with status 'passed'", async () => {
            await completeRun(baseUrl, runId1, "passed", 500, {
                total: 3, passed: 3, failed: 0, pending: 0, skipped: 0,
            });
        });

        and("run2 completes with status 'passed'", async () => {
            await completeRun(baseUrl, runId2, "passed", 700, {
                total: 4, passed: 4, failed: 0, pending: 0, skipped: 0,
            });
        });

        Then("the session status should be 'passed'", async (ctx) => {
            const res = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}`);
            session = await res.json();
            expect(session.status).toBe(ctx.step.values[0]);
        });

        and("the session summary total should be '7'", (ctx) => {
            expect(session.summary.total).toBe(ctx.step.values[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: Session with Documents (merged across runs)
// ---------------------------------------------------------------------------

feature(`Session API — Document Merging Across Runs
    @integration @api @session
    When multiple runs contribute test cases, the session should contain the union of documents.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-docs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
    scenario("Documents from '2' runs are merged into the session", () => {
        let runId1: string;
        let runId2: string;
        let sessionId: string;

        given("run1 is started for project 'DocMerge' environment 'local'", async () => {
            const result = await startRun(baseUrl, "DocMerge", "local");
            runId1 = result.runId;
        });

        and("run1 has a test case 'Feature A' with '1' rule test", async (ctx) => {
            const tc = makeTestCase("tc-a", ctx.step.values[0], [
                makeRule("r-a1", "Rule A1"),
            ]);
            await upsertTestCase(baseUrl, runId1, tc);
        });

        and("run2 is started for project 'DocMerge' environment 'local'", async () => {
            const result = await startRun(baseUrl, "DocMerge", "local");
            runId2 = result.runId;
            const run = await getRun(baseUrl, runId1);
            sessionId = run.sessionId;
        });

        and("run2 has a test case 'Feature B' with '1' scenario test", async (ctx) => {
            const tc = makeTestCase("tc-b", ctx.step.values[0], [
                makeScenario("sc-b1", "Scenario B1", [
                    makeStep("sc-b1:step0", "given", "something"),
                    makeStep("sc-b1:step1", "then", "something happens"),
                ]),
            ]);
            await upsertTestCase(baseUrl, runId2, tc);
        });

        when("both runs are completed", async () => {
            await completeRun(baseUrl, runId1, "passed", 500, {
                total: 1, passed: 1, failed: 0, pending: 0, skipped: 0,
            });
            await completeRun(baseUrl, runId2, "passed", 600, {
                total: 1, passed: 1, failed: 0, pending: 0, skipped: 0,
            });
        });

        Then("each individual run should retain its own documents", async () => {
            const run1 = await getRun(baseUrl, runId1);
            const run2 = await getRun(baseUrl, runId2);
            expect(run1.documents).toHaveLength(1);
            expect(run2.documents).toHaveLength(1);
            expect(run1.documents[0].title).toBe("Feature A");
            expect(run2.documents[0].title).toBe("Feature B");
        });

        and("the session should aggregate summaries from both runs", async () => {
            const res = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}`);
            const session = await res.json();
            expect(session.summary.total).toBe(2);
            expect(session.runs).toHaveLength(2);
        });
    });
});

// ---------------------------------------------------------------------------
// Feature: Session Sealing (Grace Period)
// ---------------------------------------------------------------------------

feature(`Session API — Session Sealing
    @integration @api @session
    After all runs complete, a grace period starts. Once sealed, a new run gets a new session.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-seal-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
    scenario("Two back-to-back runs share the same session before sealing", () => {
        let runId1: string;
        let runId2: string;
        let sessionId1: string;
        let sessionId2: string;

        given("run1 is started and completed for project 'SealTest' environment 'ci'", async () => {
            const result = await startRun(baseUrl, "SealTest", "ci");
            runId1 = result.runId;
            await completeRun(baseUrl, runId1, "passed", 300, {
                total: 2, passed: 2, failed: 0, pending: 0, skipped: 0,
            });
        });

        when("run2 is started immediately for project 'SealTest' environment 'ci'", async () => {
            const result = await startRun(baseUrl, "SealTest", "ci");
            runId2 = result.runId;
        });

        Then("both runs should belong to the same session", async () => {
            const run1 = await getRun(baseUrl, runId1);
            const run2 = await getRun(baseUrl, runId2);
            sessionId1 = run1.sessionId;
            sessionId2 = run2.sessionId;
            expect(sessionId1).toBe(sessionId2);
        });
    });
});
