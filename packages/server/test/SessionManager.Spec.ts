import { feature, scenario, background, given, when, Then, and } from "@swedevtools/livedoc-vitest";
import { expect, vi } from "vitest";
import { SessionManager } from "../src/session-manager.js";
import type { TestRunV1, Statistics, Status, TestCase } from "@swedevtools/livedoc-schema";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyStats(): Statistics {
    return { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
}

function makeStats(overrides: Partial<Statistics> = {}): Statistics {
    return { ...emptyStats(), ...overrides };
}

function makeRun(overrides: Partial<TestRunV1> = {}): TestRunV1 {
    return {
        protocolVersion: "1.0",
        runId: overrides.runId ?? "run-1",
        project: overrides.project ?? "TestProject",
        environment: overrides.environment ?? "dev",
        framework: overrides.framework ?? "vitest",
        timestamp: overrides.timestamp ?? new Date().toISOString(),
        duration: overrides.duration ?? 1000,
        status: overrides.status ?? "passed",
        summary: overrides.summary ?? emptyStats(),
        documents: overrides.documents ?? [],
    };
}

function makeDoc(id: string, title: string): TestCase {
    return {
        id,
        kind: "Feature",
        title,
        tests: [],
        statistics: emptyStats(),
    } as TestCase;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

feature(`SessionManager Session Assignment
    @unit @session
    The SessionManager groups test runs into sessions using a rolling
    10-second gap rule. Runs for the same project/environment join an
    existing unsealed session; otherwise a new session is created.
    `, () => {
    let mgr: SessionManager;
    let testDataDir: string;

    background("Fresh SessionManager for each scenario", (ctx) => {
        given("a new SessionManager with temporary storage", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            mgr = new SessionManager(testDataDir);
            await mgr.initialize();
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // ignore cleanup errors
            }
        });
    });

    scenario("First run for a project creates a new session", () => {
        let sessionId: string;

        when("a run 'run-1' is assigned to project 'Alpha' environment 'dev'", () => {
            sessionId = mgr.assignSession("Alpha", "dev", "run-1", new Date().toISOString());
        });

        Then("a session id should be returned", () => {
            expect(sessionId).toBeDefined();
            expect(typeof sessionId).toBe("string");
            expect(sessionId.length).toBeGreaterThan(0);
        });

        and("the session should be retrievable", () => {
            const session = mgr.getSession(sessionId);
            expect(session).toBeDefined();
        });

        and("the session status should be 'running'", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("Second run for same project/env joins the existing session", () => {
        let sessionId1: string;
        let sessionId2: string;

        given("a run 'run-1' is already assigned to project 'Alpha' environment 'dev'", () => {
            sessionId1 = mgr.assignSession("Alpha", "dev", "run-1", new Date().toISOString());
        });

        when("a run 'run-2' is assigned to the same project and environment", () => {
            sessionId2 = mgr.assignSession("Alpha", "dev", "run-2", new Date().toISOString());
        });

        Then("both runs should share the same session id", () => {
            expect(sessionId2).toBe(sessionId1);
        });
    });

    scenario("Different project creates a separate session", () => {
        let sessionIdA: string;
        let sessionIdB: string;

        given("a run is assigned to project 'Alpha' environment 'dev'", () => {
            sessionIdA = mgr.assignSession("Alpha", "dev", "run-a", new Date().toISOString());
        });

        when("a run is assigned to project 'Beta' environment 'dev'", () => {
            sessionIdB = mgr.assignSession("Beta", "dev", "run-b", new Date().toISOString());
        });

        Then("the session ids should be different", () => {
            expect(sessionIdB).not.toBe(sessionIdA);
        });
    });

    scenario("Different environment creates a separate session", () => {
        let sessionIdDev: string;
        let sessionIdProd: string;

        given("a run is assigned to project 'Alpha' environment 'dev'", () => {
            sessionIdDev = mgr.assignSession("Alpha", "dev", "run-dev", new Date().toISOString());
        });

        when("a run is assigned to project 'Alpha' environment 'prod'", () => {
            sessionIdProd = mgr.assignSession("Alpha", "prod", "run-prod", new Date().toISOString());
        });

        Then("the session ids should be different", () => {
            expect(sessionIdProd).not.toBe(sessionIdDev);
        });
    });

    scenario("Run arriving after session is sealed creates a new session", () => {
        let sessionId1: string;
        let sessionId2: string;

        given("a run 'run-1' is assigned and completed for project 'Alpha' environment 'dev'", () => {
            vi.useFakeTimers();
            sessionId1 = mgr.assignSession("Alpha", "dev", "run-1", new Date().toISOString());
            const run = makeRun({ runId: "run-1", project: "Alpha", environment: "dev", status: "passed" });
            mgr.onRunCompleted(sessionId1, run, [run]);
        });

        when("the grace period of '10000' ms expires and a new run is assigned", (ctx) => {
            vi.advanceTimersByTime(ctx.step.values[0] + 1);
            sessionId2 = mgr.assignSession("Alpha", "dev", "run-2", new Date().toISOString());
            vi.useRealTimers();
        });

        Then("a new session should be created", () => {
            expect(sessionId2).not.toBe(sessionId1);
        });
    });
});

feature(`SessionManager Run Completion and Aggregation
    @unit @session
    When runs complete, the SessionManager recomputes session aggregates
    including status, summary statistics, timestamp, and duration.
    `, () => {
    let mgr: SessionManager;
    let testDataDir: string;

    background("Fresh SessionManager", (ctx) => {
        given("a new SessionManager with temporary storage", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            mgr = new SessionManager(testDataDir);
            await mgr.initialize();
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        });
    });

    scenario("Completing a single run updates session aggregate", () => {
        let sessionId: string;

        given("a run 'run-1' is assigned to project 'App' environment 'test'", () => {
            sessionId = mgr.assignSession("App", "test", "run-1", "2024-01-01T00:00:00.000Z");
        });

        when("the run completes with status 'passed' and '5' total, '4' passed, '1' failed", () => {
            const run = makeRun({
                runId: "run-1",
                project: "App",
                environment: "test",
                status: "passed",
                timestamp: "2024-01-01T00:00:00.000Z",
                duration: 2000,
                summary: makeStats({ total: 5, passed: 4, failed: 1 }),
            });
            mgr.onRunCompleted(sessionId, run, [run]);
        });

        Then("the session summary total should be '5'", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.summary.total).toBe(ctx.step.values[0]);
        });

        and("the session summary passed should be '4'", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.summary.passed).toBe(ctx.step.values[0]);
        });

        and("the session summary failed should be '1'", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.summary.failed).toBe(ctx.step.values[0]);
        });
    });

    scenario("Session status is the worst of all run statuses", () => {
        let sessionId: string;

        given("two runs are assigned to the same session", () => {
            sessionId = mgr.assignSession("App", "test", "run-1", new Date().toISOString());
            mgr.assignSession("App", "test", "run-2", new Date().toISOString());
        });

        when("run-1 completes with status 'passed' and run-2 with status 'failed'", () => {
            const run1 = makeRun({ runId: "run-1", project: "App", environment: "test", status: "passed", summary: makeStats({ total: 2, passed: 2 }) });
            const run2 = makeRun({ runId: "run-2", project: "App", environment: "test", status: "failed", summary: makeStats({ total: 3, failed: 3 }) });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session status should be 'failed'", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("Session summary is the sum of all run summaries", () => {
        let sessionId: string;

        given("two runs are assigned to the same session", () => {
            sessionId = mgr.assignSession("App", "test", "run-1", new Date().toISOString());
            mgr.assignSession("App", "test", "run-2", new Date().toISOString());
        });

        when("run-1 has '3' passed and run-2 has '2' passed", () => {
            const run1 = makeRun({ runId: "run-1", project: "App", environment: "test", status: "passed", summary: makeStats({ total: 3, passed: 3 }) });
            const run2 = makeRun({ runId: "run-2", project: "App", environment: "test", status: "passed", summary: makeStats({ total: 2, passed: 2 }) });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session summary total should be '5'", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.summary.total).toBe(ctx.step.values[0]);
        });

        and("the session summary passed should be '5'", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.summary.passed).toBe(ctx.step.values[0]);
        });
    });

    scenario("Session timestamp is the earliest run timestamp", () => {
        let sessionId: string;

        given("two runs assigned to the same session", () => {
            sessionId = mgr.assignSession("App", "test", "run-1", "2024-01-01T00:00:05.000Z");
            mgr.assignSession("App", "test", "run-2", "2024-01-01T00:00:10.000Z");
        });

        when("both runs complete with different timestamps", () => {
            const run1 = makeRun({ runId: "run-1", project: "App", environment: "test", status: "passed", timestamp: "2024-01-01T00:00:05.000Z", duration: 1000 });
            const run2 = makeRun({ runId: "run-2", project: "App", environment: "test", status: "passed", timestamp: "2024-01-01T00:00:10.000Z", duration: 500 });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session timestamp should be the earliest run time", () => {
            const session = mgr.getSession(sessionId);
            expect(session?.timestamp).toBe("2024-01-01T00:00:05.000Z");
        });
    });

    scenario("Session duration is wall-clock from earliest start to latest end", () => {
        let sessionId: string;

        given("two runs assigned to the same session", () => {
            sessionId = mgr.assignSession("App", "test", "run-1", "2024-01-01T00:00:00.000Z");
            mgr.assignSession("App", "test", "run-2", "2024-01-01T00:00:00.000Z");
        });

        when("run-1 starts at T+0 duration '3000' ms and run-2 starts at T+1s duration '5000' ms", () => {
            const run1 = makeRun({ runId: "run-1", project: "App", environment: "test", status: "passed", timestamp: "2024-01-01T00:00:00.000Z", duration: 3000 });
            const run2 = makeRun({ runId: "run-2", project: "App", environment: "test", status: "passed", timestamp: "2024-01-01T00:00:01.000Z", duration: 5000 });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session duration should be '6000' ms (T+0 to T+6s)", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.duration).toBe(ctx.step.values[0]);
        });
    });
});

feature(`SessionManager Grace Period and Sealing
    @unit @session
    After all runs in a session complete, a 10-second grace timer starts.
    If the timer fires, the session is sealed. A new run arriving before
    the timer fires clears it and joins the session.
    `, () => {
    let mgr: SessionManager;
    let testDataDir: string;

    background("Fresh SessionManager with fake timers", (ctx) => {
        given("a new SessionManager with temporary storage and fake timers", async () => {
            vi.useFakeTimers();
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            mgr = new SessionManager(testDataDir);
            await mgr.initialize();
        });

        ctx.afterBackground(async () => {
            vi.useRealTimers();
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        });
    });

    scenario("Grace timer seals session after all runs complete", () => {
        let sessionId: string;
        let newSessionId: string;

        given("a run 'run-1' is assigned and completed for project 'Timer' environment 'test'", () => {
            sessionId = mgr.assignSession("Timer", "test", "run-1", new Date().toISOString());
            const run = makeRun({ runId: "run-1", project: "Timer", environment: "test", status: "passed" });
            mgr.onRunCompleted(sessionId, run, [run]);
        });

        when("'10001' ms elapse past the grace period", (ctx) => {
            vi.advanceTimersByTime(ctx.step.values[0]);
        });

        Then("the session should be sealed and a new run creates a new session", () => {
            newSessionId = mgr.assignSession("Timer", "test", "run-2", new Date().toISOString());
            expect(newSessionId).not.toBe(sessionId);
        });
    });

    scenario("New run arriving before grace timer fires joins the session", () => {
        let sessionId: string;
        let joinedSessionId: string;

        given("a run 'run-1' is assigned and completed for project 'Timer' environment 'test'", () => {
            sessionId = mgr.assignSession("Timer", "test", "run-1", new Date().toISOString());
            const run = makeRun({ runId: "run-1", project: "Timer", environment: "test", status: "passed" });
            mgr.onRunCompleted(sessionId, run, [run]);
        });

        when("'5000' ms elapse and a new run 'run-2' is assigned", (ctx) => {
            vi.advanceTimersByTime(ctx.step.values[0]);
            joinedSessionId = mgr.assignSession("Timer", "test", "run-2", new Date().toISOString());
        });

        Then("the new run should join the existing session", () => {
            expect(joinedSessionId).toBe(sessionId);
        });
    });

    scenario("Grace timer is reset when a new run joins and then completes", () => {
        let sessionId: string;
        let thirdSessionId: string;

        given("a run 'run-1' is assigned and completed for project 'Timer' environment 'test'", () => {
            sessionId = mgr.assignSession("Timer", "test", "run-1", new Date().toISOString());
            const run = makeRun({ runId: "run-1", project: "Timer", environment: "test", status: "passed" });
            mgr.onRunCompleted(sessionId, run, [run]);
        });

        and("'5000' ms elapse and 'run-2' joins and completes", () => {
            vi.advanceTimersByTime(5000);
            mgr.assignSession("Timer", "test", "run-2", new Date().toISOString());
            const run1 = makeRun({ runId: "run-1", project: "Timer", environment: "test", status: "passed" });
            const run2 = makeRun({ runId: "run-2", project: "Timer", environment: "test", status: "passed" });
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        when("another '10001' ms elapse", () => {
            vi.advanceTimersByTime(10001);
        });

        Then("the session should now be sealed and a new run creates a new session", () => {
            thirdSessionId = mgr.assignSession("Timer", "test", "run-3", new Date().toISOString());
            expect(thirdSessionId).not.toBe(sessionId);
        });
    });

    scenario("Session is not sealed while runs are still in progress", () => {
        let sessionId: string;
        let joinedSessionId: string;

        given("two runs are assigned to the same session", () => {
            sessionId = mgr.assignSession("Timer", "test", "run-1", new Date().toISOString());
            mgr.assignSession("Timer", "test", "run-2", new Date().toISOString());
        });

        when("only run-1 completes and '15000' ms elapse", () => {
            const run1 = makeRun({ runId: "run-1", project: "Timer", environment: "test", status: "passed" });
            const run2 = makeRun({ runId: "run-2", project: "Timer", environment: "test", status: "running" });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            vi.advanceTimersByTime(15000);
        });

        Then("a new run should still join the existing session", () => {
            joinedSessionId = mgr.assignSession("Timer", "test", "run-3", new Date().toISOString());
            expect(joinedSessionId).toBe(sessionId);
        });
    });
});

feature(`SessionManager Worst Status Computation
    @unit @session
    The session status reflects the worst status among all member runs
    with priority: failed > timedOut > cancelled > pending > running > passed > skipped.
    `, () => {
    let mgr: SessionManager;
    let testDataDir: string;

    background("Fresh SessionManager", (ctx) => {
        given("a new SessionManager with temporary storage", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            mgr = new SessionManager(testDataDir);
            await mgr.initialize();
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        });
    });

    scenario("Failed run dominates passed run", () => {
        let sessionId: string;

        given("two runs in the same session", () => {
            sessionId = mgr.assignSession("WS", "test", "run-1", new Date().toISOString());
            mgr.assignSession("WS", "test", "run-2", new Date().toISOString());
        });

        when("run-1 is 'passed' and run-2 is 'failed'", () => {
            const run1 = makeRun({ runId: "run-1", project: "WS", environment: "test", status: "passed" });
            const run2 = makeRun({ runId: "run-2", project: "WS", environment: "test", status: "failed", summary: makeStats({ total: 1, failed: 1 }) });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session status should be 'failed'", (ctx) => {
            expect(mgr.getSession(sessionId)?.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("TimedOut run dominates passed run", () => {
        let sessionId: string;

        given("two runs in the same session", () => {
            sessionId = mgr.assignSession("WS", "test", "run-1", new Date().toISOString());
            mgr.assignSession("WS", "test", "run-2", new Date().toISOString());
        });

        when("run-1 is 'passed' and run-2 is 'timedOut'", () => {
            const run1 = makeRun({ runId: "run-1", project: "WS", environment: "test", status: "passed" });
            const run2 = makeRun({ runId: "run-2", project: "WS", environment: "test", status: "timedOut" });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session status should be 'timedOut'", (ctx) => {
            expect(mgr.getSession(sessionId)?.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("All passed runs produce a passed session", () => {
        let sessionId: string;

        given("two runs in the same session", () => {
            sessionId = mgr.assignSession("WS", "test", "run-1", new Date().toISOString());
            mgr.assignSession("WS", "test", "run-2", new Date().toISOString());
        });

        when("both runs are 'passed'", () => {
            const run1 = makeRun({ runId: "run-1", project: "WS", environment: "test", status: "passed" });
            const run2 = makeRun({ runId: "run-2", project: "WS", environment: "test", status: "passed" });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session status should be 'passed'", (ctx) => {
            expect(mgr.getSession(sessionId)?.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("Skipped and passed produces passed session", () => {
        let sessionId: string;

        given("two runs in the same session", () => {
            sessionId = mgr.assignSession("WS", "test", "run-1", new Date().toISOString());
            mgr.assignSession("WS", "test", "run-2", new Date().toISOString());
        });

        when("run-1 is 'passed' and run-2 is 'skipped'", () => {
            const run1 = makeRun({ runId: "run-1", project: "WS", environment: "test", status: "passed" });
            const run2 = makeRun({ runId: "run-2", project: "WS", environment: "test", status: "skipped" });
            mgr.onRunCompleted(sessionId, run1, [run1, run2]);
            mgr.onRunCompleted(sessionId, run2, [run1, run2]);
        });

        Then("the session status should be 'passed'", (ctx) => {
            expect(mgr.getSession(sessionId)?.status).toBe(ctx.step.values[0]);
        });
    });
});

feature(`SessionManager Document Merging
    @unit @session
    The mergeDocuments method unions documents from all runs using
    last-writer-wins semantics based on run timestamp.
    `, () => {
    let mgr: SessionManager;
    let testDataDir: string;

    background("Fresh SessionManager", (ctx) => {
        given("a new SessionManager with temporary storage", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            mgr = new SessionManager(testDataDir);
            await mgr.initialize();
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        });
    });

    scenario("Documents from multiple runs are merged into the session", () => {
        let sessionId: string;

        given("a session with '2' runs that have different documents", () => {
            sessionId = mgr.assignSession("Merge", "test", "run-1", "2024-01-01T00:00:00.000Z");
            mgr.assignSession("Merge", "test", "run-2", "2024-01-01T00:00:01.000Z");
        });

        when("documents are merged from both runs", () => {
            const run1 = makeRun({
                runId: "run-1",
                project: "Merge",
                environment: "test",
                timestamp: "2024-01-01T00:00:00.000Z",
                documents: [makeDoc("doc-1", "Login Feature")],
            });
            const run2 = makeRun({
                runId: "run-2",
                project: "Merge",
                environment: "test",
                timestamp: "2024-01-01T00:00:01.000Z",
                documents: [makeDoc("doc-2", "Checkout Feature")],
            });
            const session = mgr.getSession(sessionId)!;
            mgr.mergeDocuments(session, [run1, run2]);
        });

        Then("the session should have '2' documents", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.documents).toHaveLength(ctx.step.values[0]);
        });
    });

    scenario("Last-writer-wins when same document appears in multiple runs", () => {
        let sessionId: string;

        given("a session with '2' runs that share the same document id", () => {
            sessionId = mgr.assignSession("Merge", "test", "run-1", "2024-01-01T00:00:00.000Z");
            mgr.assignSession("Merge", "test", "run-2", "2024-01-01T00:00:01.000Z");
        });

        when("both runs contain document 'doc-1' with different titles", () => {
            const run1 = makeRun({
                runId: "run-1",
                project: "Merge",
                environment: "test",
                timestamp: "2024-01-01T00:00:00.000Z",
                documents: [makeDoc("doc-1", "Old Title")],
            });
            const run2 = makeRun({
                runId: "run-2",
                project: "Merge",
                environment: "test",
                timestamp: "2024-01-01T00:00:01.000Z",
                documents: [makeDoc("doc-1", "New Title")],
            });
            const session = mgr.getSession(sessionId)!;
            mgr.mergeDocuments(session, [run1, run2]);
        });

        Then("the session should have '1' document", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.documents).toHaveLength(ctx.step.values[0]);
        });

        and("the document title should be 'New Title' from the later run", (ctx) => {
            const session = mgr.getSession(sessionId);
            expect(session?.documents[0].title).toBe(ctx.step.values[0]);
        });
    });
});

feature(`SessionManager Persistence
    @integration @session
    Sessions are persisted to lastsession.json and can be reloaded
    from disk when the SessionManager is re-initialized.
    `, () => {
    let testDataDir: string;

    background("Temporary storage directory", (ctx) => {
        given("a temporary data directory", () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        });
    });

    scenario("Session is saved to disk and reloaded on restart", () => {
        let originalSessionId: string;
        let reloadedSession: ReturnType<SessionManager["getSession"]>;

        given("a SessionManager with a completed run that is sealed", async () => {
            vi.useFakeTimers();
            const mgr = new SessionManager(testDataDir);
            await mgr.initialize();
            originalSessionId = mgr.assignSession("Persist", "prod", "run-1", "2024-06-01T12:00:00.000Z");
            const run = makeRun({
                runId: "run-1",
                project: "Persist",
                environment: "prod",
                status: "passed",
                timestamp: "2024-06-01T12:00:00.000Z",
                duration: 5000,
                summary: makeStats({ total: 10, passed: 10 }),
            });
            mgr.onRunCompleted(originalSessionId, run, [run]);
            vi.advanceTimersByTime(10001);
            vi.useRealTimers();
            // Give the async saveSession a moment
            await new Promise((resolve) => setTimeout(resolve, 200));
        });

        when("a new SessionManager loads from the same directory", async () => {
            const mgr2 = new SessionManager(testDataDir);
            await mgr2.initialize();
            reloadedSession = mgr2.getSession(originalSessionId);
        });

        Then("the reloaded session should exist", () => {
            expect(reloadedSession).toBeDefined();
        });

        and("the reloaded session project should be 'Persist'", (ctx) => {
            expect(reloadedSession?.project).toBe(ctx.step.values[0]);
        });

        and("the reloaded session summary passed should be '10'", (ctx) => {
            expect(reloadedSession?.summary.passed).toBe(ctx.step.values[0]);
        });
    });

    scenario("Reloaded session is treated as sealed", () => {
        let originalSessionId: string;
        let newSessionId: string;

        given("a SessionManager persisted a sealed session", async () => {
            vi.useFakeTimers();
            const mgr = new SessionManager(testDataDir);
            await mgr.initialize();
            originalSessionId = mgr.assignSession("Persist", "prod", "run-1", "2024-06-01T12:00:00.000Z");
            const run = makeRun({
                runId: "run-1",
                project: "Persist",
                environment: "prod",
                status: "passed",
                timestamp: "2024-06-01T12:00:00.000Z",
                duration: 1000,
                summary: makeStats({ total: 1, passed: 1 }),
            });
            mgr.onRunCompleted(originalSessionId, run, [run]);
            vi.advanceTimersByTime(10001);
            vi.useRealTimers();
            await new Promise((resolve) => setTimeout(resolve, 200));
        });

        when("a new SessionManager loads and a new run is assigned", async () => {
            const mgr2 = new SessionManager(testDataDir);
            await mgr2.initialize();
            newSessionId = mgr2.assignSession("Persist", "prod", "run-2", new Date().toISOString());
        });

        Then("the new run should get a different session id", () => {
            expect(newSessionId).not.toBe(originalSessionId);
        });
    });
});

feature(`SessionManager Querying
    @unit @session
    The SessionManager provides methods to query sessions by id,
    project/environment, and to look up which session a run belongs to.
    `, () => {
    let mgr: SessionManager;
    let testDataDir: string;

    background("Fresh SessionManager", (ctx) => {
        given("a new SessionManager with temporary storage", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            mgr = new SessionManager(testDataDir);
            await mgr.initialize();
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        });
    });

    scenario("getSession returns undefined for unknown session id", () => {
        let result: ReturnType<SessionManager["getSession"]>;

        when("querying for a non-existent session id 'unknown-id'", (ctx) => {
            result = mgr.getSession(ctx.step.values[0]);
        });

        Then("the result should be undefined", () => {
            expect(result).toBeUndefined();
        });
    });

    scenario("getSession returns the session for a known id", () => {
        let sessionId: string;
        let result: ReturnType<SessionManager["getSession"]>;

        given("a run is assigned to project 'Query' environment 'dev'", () => {
            sessionId = mgr.assignSession("Query", "dev", "run-1", new Date().toISOString());
        });

        when("querying for the session id", () => {
            result = mgr.getSession(sessionId);
        });

        Then("the session should be returned with project 'Query'", (ctx) => {
            expect(result).toBeDefined();
            expect(result?.project).toBe(ctx.step.values[0]);
        });
    });

    scenario("listSessions returns matching sessions sorted by timestamp descending", () => {
        let sessions: ReturnType<SessionManager["listSessions"]>;

        given("a sealed session and a new session for project 'List' environment 'dev'", () => {
            vi.useFakeTimers();
            const id1 = mgr.assignSession("List", "dev", "run-1", "2024-01-01T00:00:00.000Z");
            const run = makeRun({ runId: "run-1", project: "List", environment: "dev", status: "passed", timestamp: "2024-01-01T00:00:00.000Z" });
            mgr.onRunCompleted(id1, run, [run]);
            vi.advanceTimersByTime(10001);
            mgr.assignSession("List", "dev", "run-2", "2024-01-02T00:00:00.000Z");
            vi.useRealTimers();
        });

        when("listing sessions for project 'List' environment 'dev'", () => {
            sessions = mgr.listSessions("List", "dev");
        });

        Then("there should be '2' sessions", (ctx) => {
            expect(sessions).toHaveLength(ctx.step.values[0]);
        });

        and("the first session should have the later timestamp", () => {
            expect(new Date(sessions[0].timestamp).getTime()).toBeGreaterThanOrEqual(
                new Date(sessions[1].timestamp).getTime()
            );
        });
    });

    scenario("listSessions returns empty array for unknown project", () => {
        let sessions: ReturnType<SessionManager["listSessions"]>;

        when("listing sessions for project 'Unknown' environment 'dev'", () => {
            sessions = mgr.listSessions("Unknown", "dev");
        });

        Then("the result should be an empty array", () => {
            expect(sessions).toEqual([]);
        });
    });

    scenario("getLatestSession returns the most recent session", () => {
        let latest: ReturnType<SessionManager["getLatestSession"]>;

        given("a sealed session and a new session for project 'Latest' environment 'dev'", () => {
            vi.useFakeTimers();
            const id1 = mgr.assignSession("Latest", "dev", "run-1", "2024-01-01T00:00:00.000Z");
            const run = makeRun({ runId: "run-1", project: "Latest", environment: "dev", status: "passed", timestamp: "2024-01-01T00:00:00.000Z" });
            mgr.onRunCompleted(id1, run, [run]);
            vi.advanceTimersByTime(10001);
            mgr.assignSession("Latest", "dev", "run-2", "2024-01-02T00:00:00.000Z");
            vi.useRealTimers();
        });

        when("querying for the latest session", () => {
            latest = mgr.getLatestSession("Latest", "dev");
        });

        Then("the latest session should exist", () => {
            expect(latest).toBeDefined();
        });
    });

    scenario("getLatestSession returns undefined for unknown project", () => {
        let latest: ReturnType<SessionManager["getLatestSession"]>;

        when("querying latest session for project 'Nothing' environment 'dev'", () => {
            latest = mgr.getLatestSession("Nothing", "dev");
        });

        Then("the result should be undefined", () => {
            expect(latest).toBeUndefined();
        });
    });

    scenario("getSessionIdForRun finds the session containing a run", () => {
        let sessionId: string;
        let foundId: string | undefined;

        given("a run 'run-lookup' is assigned to a session", () => {
            sessionId = mgr.assignSession("Lookup", "dev", "run-lookup", new Date().toISOString());
        });

        when("looking up the session for run 'run-lookup'", (ctx) => {
            foundId = mgr.getSessionIdForRun(ctx.step.values[0]);
        });

        Then("the returned session id should match", () => {
            expect(foundId).toBe(sessionId);
        });
    });

    scenario("getSessionIdForRun returns undefined for unknown run", () => {
        let foundId: string | undefined;

        when("looking up the session for run 'unknown-run'", (ctx) => {
            foundId = mgr.getSessionIdForRun(ctx.step.values[0]);
        });

        Then("the result should be undefined", () => {
            expect(foundId).toBeUndefined();
        });
    });
});
