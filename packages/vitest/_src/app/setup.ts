/**
 * Setup file for LiveDoc Vitest integration.
 * This file registers the global LiveDoc keywords (feature, scenario, given, when, then, etc.)
 * 
 * When using globals mode, all step keywords are available in lowercase including 'then'.
 * This avoids the ESM thenable issue that affects direct imports.
 * 
 * To use, add this to your vitest.config.ts:
 * 
 * ```typescript
 * import { defineConfig } from 'vitest/config';
 * 
 * export default defineConfig({
 *   test: {
 *     globals: true,
 *     setupFiles: ['@swedevtools/livedoc-vitest/setup'],
 *   },
 * });
 * ```
 */

import {
    feature,
    scenario,
    scenarioOutline,
    background,
    given,
    when,
    Then,
    and,
    but,
} from "./livedoc";

// Register global functions for use in tests without explicit imports
// NOTE: 'then' is registered as lowercase here because globalThis is not
// subject to ESM thenable detection (only module namespace objects are).
(globalThis as any).feature = feature;
(globalThis as any).scenario = scenario;
(globalThis as any).scenarioOutline = scenarioOutline;
(globalThis as any).background = background;
(globalThis as any).given = given;
(globalThis as any).when = when;
(globalThis as any).then = Then;  // Lowercase global, avoids ESM issue
(globalThis as any).and = and;
(globalThis as any).but = but;
