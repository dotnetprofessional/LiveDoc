# Decision: Fix Playwright Module Duplication via Self-Referencing Imports

**Author:** Wash (Framework Dev)  
**Date:** 2026-07-25  
**Status:** Implemented  
**Affects:** `packages/vitest` — tsup config, playwright entry point

## Context

With `splitting: false` in tsup, each entry point bundles its own copy of all shared code. The playwright entry point (`dist/playwright/index.js`) was importing `onScenarioStart`/`onScenarioEnd` from `../livedoc`, causing tsup to inline the entire livedoc module. This created **two independent copies** of the `scenarioStartHooks`/`scenarioEndHooks` arrays at runtime — one in the main bundle and one in the playwright bundle.

When `useBrowser({ freshContextPerScenario: true })` registered hooks via `onScenarioStart()`, they went into the playwright copy's array. When `scenario()` ran, it read from the main copy's array (empty). Hooks never fired, and no page was ever created.

This was a regression in v0.1.9 because `beforeAll` now skips page creation when `freshContext=true`, relying entirely on the (broken) hooks.

## Decision

**Use self-referencing package imports** (Option C from the analysis):

1. Changed `playwright/index.ts` to import from `@swedevtools/livedoc-vitest` instead of `../livedoc`
2. Added `@swedevtools/livedoc-vitest` to `external` in `tsup.config.ts`

This ensures the playwright bundle emits a real `import`/`require` of the main package at runtime rather than inlining it. Both ESM and CJS consumers resolve through the package.json `exports` map to the correct format.

## Why Not Other Options

- **Option A (splitting: true)**: Only works for ESM in tsup; CJS would still duplicate.
- **Option B (mark relative paths as external)**: Fragile and tsup doesn't natively support it well.
- **Option C (self-referencing)**: Works for both ESM and CJS, leverages Node.js self-referencing (supported since Node 12.7+), and is the standard pattern for multi-entry-point packages.

## Verification

- Playwright ESM bundle: 0 occurrences of `scenarioStartHooks` (was ~4 before fix)
- Playwright CJS bundle: 0 occurrences of `scenarioStartHooks`
- Main ESM/CJS bundles: 4 occurrences each (unchanged)
- Playwright bundle size dropped from ~320KB to ~2.9KB
- All existing tests pass (exit code 0)
