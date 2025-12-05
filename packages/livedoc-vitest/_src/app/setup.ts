/**
 * Setup file for LiveDoc Vitest integration.
 * This file registers the global LiveDoc keywords (feature, scenario, given, when, then, etc.)
 * 
 * To use, add this to your vitest.config.ts:
 * 
 * ```typescript
 * import { defineConfig } from 'vitest/config';
 * 
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['livedoc-vitest/setup'],
 *   },
 * });
 * ```
 */

import {
    feature,
    scenario,
    scenarioOutline,
    background,
    Given,
    When,
    Then,
    And,
    But,
} from "./livedoc";

// Register global functions for use in tests without explicit imports
globalThis.feature = feature;
globalThis.scenario = scenario;
globalThis.scenarioOutline = scenarioOutline;
globalThis.background = background;
globalThis.Given = Given;
globalThis.When = When;
globalThis.Then = Then;
globalThis.And = And;
globalThis.But = But;
