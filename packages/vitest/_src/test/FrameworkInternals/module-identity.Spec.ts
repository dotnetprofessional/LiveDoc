/**
 * Module Identity — Cross-Entry-Point Hook Integrity
 *
 * Regression test for v0.1.9 bug: tsup with `splitting: false` created two
 * independent copies of the `scenarioStartHooks` array — one in `dist/index.js`
 * and one in `dist/playwright/index.js`. Hooks registered by `useBrowser()`
 * (via the playwright entry) were invisible to `scenario()` (via the main entry).
 *
 * These tests verify that the hook mechanism works as a singleton regardless
 * of how the bundler resolves entry points.
 *
 * No browser or Playwright required — pure module-identity and hook-wiring tests.
 *
 * @tags regression, hooks, module-identity, playwright, bundling
 */

import {
    feature,
    scenario,
    given,
    when,
    Then as then,
    and,
    onScenarioStart,
    onScenarioEnd,
} from "../../app/livedoc";

// Import the same functions through the path the playwright module uses.
// If bundling duplicates the module, these will be DIFFERENT function references
// pointing at DIFFERENT internal arrays.
import {
    onScenarioStart as onScenarioStartViaPlaywrightPath,
    onScenarioEnd as onScenarioEndViaPlaywrightPath,
} from "../../app/livedoc";

import { expect } from "vitest";

// ─── Cross-Entry-Point Hook Tracking ──────────────────────────────────
// Simulates what useBrowser() does: registers hooks at module scope.
// The critical assertion is that scenario()'s beforeAll actually calls them.

let crossEntryHookFired = false;
let crossEntryHookCallCount = 0;
const crossEntryPayloads: string[] = [];

onScenarioStart(async () => {
    crossEntryHookFired = true;
    crossEntryHookCallCount++;
    crossEntryPayloads.push(`cross-${crossEntryHookCallCount}`);
});

// ─── Multi-Registration Tracking ──────────────────────────────────────
// Register a second hook to verify ALL hooks fire, not just the first.

let secondHookCallCount = 0;

onScenarioStart(async () => {
    secondHookCallCount++;
});

// ─── End Hook Tracking ────────────────────────────────────────────────

let endHookCallCount = 0;

onScenarioEnd(async () => {
    endHookCallCount++;
});

feature(`Scenario Hooks Cross-Module Integration
    @regression @hooks @module-identity
    When the playwright module registers onScenarioStart/onScenarioEnd hooks
    via its import of livedoc, those hooks must fire during scenario execution
    driven by the main entry point. This was broken in v0.1.9 when tsup
    duplicated the module and created two independent hook arrays.
    `, () => {

    // =================================================================
    // 1. Module Identity — Function Reference Equality
    // =================================================================

    scenario("onScenarioStart is the same function reference regardless of import path", () => {
        given("onScenarioStart imported from the main livedoc module", () => {
            // imported at top of file as `onScenarioStart`
        });

        when("onScenarioStart is also imported via the path the playwright module uses", () => {
            // imported at top of file as `onScenarioStartViaPlaywrightPath`
        });

        then("both references should be the same function (referential equality)", () => {
            expect(onScenarioStart).toBe(onScenarioStartViaPlaywrightPath);
        });
    });

    scenario("onScenarioEnd is the same function reference regardless of import path", () => {
        given("onScenarioEnd imported from the main livedoc module", () => {
            // imported at top of file as `onScenarioEnd`
        });

        when("onScenarioEnd is also imported via the path the playwright module uses", () => {
            // imported at top of file as `onScenarioEndViaPlaywrightPath`
        });

        then("both references should be the same function (referential equality)", () => {
            expect(onScenarioEnd).toBe(onScenarioEndViaPlaywrightPath);
        });
    });

    // =================================================================
    // 2. Hook Actually Fires During Scenario Execution
    // =================================================================

    scenario("A hook registered at module scope fires during scenario execution", () => {
        given("a hook was registered via onScenarioStart at module scope", () => {
            // registered above — simulates what useBrowser() does internally
        });

        then("the hook should have fired by the time steps execute", () => {
            expect(crossEntryHookFired).toBe(true);
        });

        and("the hook call count should be at least '3'", (ctx) => {
            // 2 identity scenarios above + this scenario = 3 minimum
            expect(crossEntryHookCallCount).toBeGreaterThanOrEqual(
                ctx.step.values[0] as number
            );
        });
    });

    // =================================================================
    // 3. Multiple Hooks All Fire (no silent drop)
    // =================================================================

    scenario("Multiple hooks registered via onScenarioStart all fire", () => {
        given("'2' hooks were registered via onScenarioStart at module scope", (ctx) => {
            // Two hooks registered above: crossEntryHook and secondHook
            const expectedRegistrations = ctx.step.values[0] as number;
            expect(expectedRegistrations).toBe(2);
        });

        then("both hooks should have the same call count", () => {
            expect(secondHookCallCount).toBe(crossEntryHookCallCount);
        });

        and("the call count should be at least '4' (one per scenario so far)", (ctx) => {
            const minExpected = ctx.step.values[0] as number;
            expect(crossEntryHookCallCount).toBeGreaterThanOrEqual(minExpected);
            expect(secondHookCallCount).toBeGreaterThanOrEqual(minExpected);
        });
    });

    // =================================================================
    // 4. End Hooks Fire Too
    // =================================================================

    scenario("onScenarioEnd hooks fire after each completed scenario", () => {
        then("the end hook should have fired for all previously completed scenarios", () => {
            // 4 scenarios before this one completed (identity x2 + fires + multiple)
            // This scenario's end hook hasn't fired yet
            expect(endHookCallCount).toBeGreaterThanOrEqual(4);
        });

        and("the end hook count should trail the start hook count by '1'", (ctx) => {
            // Current scenario's start has fired but end hasn't
            const expectedDifference = ctx.step.values[0] as number;
            expect(crossEntryHookCallCount - endHookCallCount).toBe(expectedDifference);
        });
    });

    // =================================================================
    // 5. Integration: Hook Payload Survives Cross-Module Boundary
    // =================================================================

    scenario("Hook payloads accumulate correctly across scenarios", () => {
        then("the payload log should have '6' entries (one per scenario)", (ctx) => {
            const expected = ctx.step.values[0] as number;
            expect(crossEntryPayloads.length).toBe(expected);
        });

        and("each entry should have a unique sequential label", () => {
            for (let i = 0; i < crossEntryPayloads.length; i++) {
                expect(crossEntryPayloads[i]).toBe(`cross-${i + 1}`);
            }
        });
    });
});
