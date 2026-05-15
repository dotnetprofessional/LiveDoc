/**
 * Bundled Output Integrity — Build Artifact Regression Tests
 *
 * Verifies that tsup's bundled dist files do NOT inline shared mutable state
 * (scenarioStartHooks, scenarioEndHooks) from livedoc.ts. When inlined, each
 * entry point gets its own independent copy of these arrays, breaking hook
 * registration across entry points (the v0.1.9 playwright bug).
 *
 * These tests read the actual dist/ files and assert on their content,
 * catching the real bundling regression that source-level tests cannot.
 *
 * @tags regression, bundling, build-artifact, playwright, setup, reporter
 */

import { specification, rule } from "../../app/livedoc";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "vitest";

// ─── Helpers ─────────────────────────────────────────────────────────

const distDir = resolve(__dirname, "../../../dist");

function readDist(relativePath: string): string {
    return readFileSync(resolve(distDir, relativePath), "utf-8");
}

// ─── Playwright Entry Point ──────────────────────────────────────────

specification(`Playwright bundle does not inline livedoc internals
    @regression @bundling @playwright
    The playwright entry point must import from the main package
    rather than inlining shared mutable state like hook arrays.
    `, () => {

    rule("dist/playwright/index.js contains an external import of '@swedevtools/livedoc-vitest'", () => {
        const content = readDist("playwright/index.js");
        expect(content).toContain("@swedevtools/livedoc-vitest");
    });

    rule("dist/playwright/index.js does not contain 'scenarioStartHooks'", () => {
        const content = readDist("playwright/index.js");
        expect(content).not.toContain("scenarioStartHooks");
    });

    rule("dist/playwright/index.cjs requires '@swedevtools/livedoc-vitest'", () => {
        const content = readDist("playwright/index.cjs");
        expect(content).toContain("@swedevtools/livedoc-vitest");
    });

    rule("dist/playwright/index.cjs does not contain 'scenarioStartHooks'", () => {
        const content = readDist("playwright/index.cjs");
        expect(content).not.toContain("scenarioStartHooks");
    });
});

// ─── Setup Entry Point ──────────────────────────────────────────────

specification(`Setup bundle does not inline livedoc internals
    @regression @bundling @setup
    The setup entry point must import from the main package
    so that globalThis-registered DSL functions share the same
    hook arrays as the main entry point.
    `, () => {

    rule("dist/setup.js contains an external import of '@swedevtools/livedoc-vitest'", () => {
        const content = readDist("setup.js");
        expect(content).toContain("@swedevtools/livedoc-vitest");
    });

    rule("dist/setup.js does not contain 'scenarioStartHooks'", () => {
        const content = readDist("setup.js");
        expect(content).not.toContain("scenarioStartHooks");
    });

    rule("dist/setup.cjs requires '@swedevtools/livedoc-vitest'", () => {
        const content = readDist("setup.cjs");
        expect(content).toContain("@swedevtools/livedoc-vitest");
    });

    rule("dist/setup.cjs does not contain 'scenarioStartHooks'", () => {
        const content = readDist("setup.cjs");
        expect(content).not.toContain("scenarioStartHooks");
    });
});

// ─── Reporter Entry Point ───────────────────────────────────────────

specification(`Reporter bundle does not inline livedoc internals
    @regression @bundling @reporter
    The reporter entry point must import from the main package
    so that reporter access to the livedoc singleton shares the
    same instance as the main entry point.
    `, () => {

    rule("dist/reporter/index.js contains an external import of '@swedevtools/livedoc-vitest'", () => {
        const content = readDist("reporter/index.js");
        expect(content).toContain("@swedevtools/livedoc-vitest");
    });

    rule("dist/reporter/index.js does not contain 'scenarioStartHooks'", () => {
        const content = readDist("reporter/index.js");
        expect(content).not.toContain("scenarioStartHooks");
    });

    rule("dist/reporter/index.cjs requires '@swedevtools/livedoc-vitest'", () => {
        const content = readDist("reporter/index.cjs");
        expect(content).toContain("@swedevtools/livedoc-vitest");
    });

    rule("dist/reporter/index.cjs does not contain 'scenarioStartHooks'", () => {
        const content = readDist("reporter/index.cjs");
        expect(content).not.toContain("scenarioStartHooks");
    });
});
