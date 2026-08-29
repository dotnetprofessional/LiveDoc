/**
 * Scenario Lifecycle Hooks
 *
 * Verifies the onScenarioStart / onScenarioEnd hook mechanism that plugins
 * (e.g. Playwright freshContextPerScenario) rely on. These hooks fire once
 * per scenario — NOT once per step — solving the beforeEach granularity problem.
 *
 * No browser or Playwright required — pure hook-mechanism tests.
 *
 * @tags hooks, lifecycle, playwright
 */

import { feature, scenario, scenarioOutline, given, when, Then as then, and, onScenarioStart, onScenarioEnd } from "../../app/livedoc";
import { expect } from "vitest";

// ─── Hook Tracking ────────────────────────────────────────────────────
// Each hook invocation pushes a timestamped entry so we can verify count,
// ordering, and per-scenario isolation.

const startLog: string[] = [];
const endLog: string[] = [];
let hookError: Error | null = null;

onScenarioStart(async () => {
    startLog.push(`start-${startLog.length + 1}`);
});

onScenarioEnd(async () => {
    endLog.push(`end-${endLog.length + 1}`);
});

feature(`Scenario Lifecycle Hooks
    @hooks @lifecycle
    The onScenarioStart and onScenarioEnd hooks fire once per scenario
    (in beforeAll / afterAll of each scenario's describe block), not once
    per step. This is critical for plugins that need scenario-level setup
    and teardown — such as creating fresh browser contexts.
    `, () => {

    // =====================================================================
    // Hook Invocation Count
    // =====================================================================

    scenario("onScenarioStart fires once for the first scenario", () => {
        given("the hooks were registered at module scope", () => {
            // Hooks registered above — nothing to do
        });

        when("this scenario starts executing", () => {
            // The beforeAll for this scenario already ran the start hook
        });

        then("the start hook should have fired '1' time so far", (ctx) => {
            expect(startLog.length).toBe(ctx.step.values[0] as number);
        });

        and("the start log should contain 'start-1'", (ctx) => {
            expect(startLog).toContain(ctx.step.valuesRaw[0]);
        });
    });

    scenario("onScenarioStart fires again for a second scenario", () => {
        when("this second scenario starts executing", () => {
            // beforeAll fires the start hook again
        });

        then("the start hook should have fired '2' times total", (ctx) => {
            expect(startLog.length).toBe(ctx.step.values[0] as number);
        });

        and("the start log should contain 'start-2'", (ctx) => {
            expect(startLog).toContain(ctx.step.valuesRaw[0]);
        });
    });

    scenario("onScenarioEnd fires after each scenario completes", () => {
        then("the end hook should have fired '2' times from the previous scenarios", (ctx) => {
            // Both previous scenarios' afterAll hooks should have run by now
            expect(endLog.length).toBe(ctx.step.values[0] as number);
        });

        and("the end log should contain 'end-1' and 'end-2'", (ctx) => {
            expect(endLog).toContain(ctx.step.valuesRaw[0]);
            expect(endLog).toContain(ctx.step.valuesRaw[1]);
        });
    });

    // =====================================================================
    // Hooks Fire Per Scenario, Not Per Step
    // =====================================================================

    scenario("Hooks do not fire for individual steps within a scenario", () => {
        let startCountAtEntry: number;

        given("we record the start hook count at the beginning of this scenario", () => {
            // beforeAll already ran the hook before any step executes,
            // so startLog already includes this scenario's start hook.
            startCountAtEntry = startLog.length;
        });

        when("a second step executes within the same scenario", () => {
            // This is a second step — should NOT trigger another hook
        });

        and("a third step executes within the same scenario", () => {
            // Third step — still no additional hook
        });

        then("the start hook count should be '0' more than at entry (no per-step hooks)", (ctx) => {
            const additionalCalls = startLog.length - startCountAtEntry;
            expect(additionalCalls).toBe(ctx.step.values[0] as number);
        });
    });

    // =====================================================================
    // Scenario Outline — hooks fire per example
    // =====================================================================

    scenarioOutline(`Hooks fire once per scenario outline example
        Examples:
        | exampleLabel | expectedMinStarts |
        | first        | 5                 |
        | second       | 6                 |
        `, (ctx) => {

        when("example '<exampleLabel>' executes", () => {
            // The hook already fired in beforeAll for this example
        });

        then("the total start hook count should be at least '<expectedMinStarts>'", (ctx) => {
            // Each example is its own describe block with its own beforeAll,
            // so the start hook fires for each example row.
            expect(startLog.length).toBeGreaterThanOrEqual(ctx.example.expectedMinStarts as number);
        });
    });

    // =====================================================================
    // Hook Ordering
    // =====================================================================

    scenario("Start hooks fire before end hooks for each scenario", () => {
        then("every start entry should have a corresponding end entry from previous scenarios", () => {
            // At this point, all prior scenarios have completed.
            // The start count should always be >= end count
            // (current scenario's start has fired but its end hasn't yet).
            expect(startLog.length).toBeGreaterThanOrEqual(endLog.length);
        });

        and("the total end hook count should equal the number of completed scenarios", () => {
            // 4 regular scenarios completed + 2 outline examples = 6 completed before this one
            // This scenario's end hasn't fired yet.
            expect(endLog.length).toBe(6);
        });
    });
});
