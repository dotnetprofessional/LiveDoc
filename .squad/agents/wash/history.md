# Project Context

- **Owner:** Garry
- **Project:** LiveDoc — a living documentation framework that generates documentation from executable BDD specifications. Monorepo spanning TypeScript (Vitest) and .NET (xUnit).
- **Stack:** TypeScript 5.9.3, Vitest 4.0.16, tsup 8.5.1 (ESM/CJS/UMD), Hono 4.11.1, WebSocket (ws 8.18.3), Zod 3.24.3, chalk, cli-table3, diff, fs-extra
- **My Domain:** packages/vitest/ (Gherkin parser, BDD DSL, reporter), packages/server/ (Hono HTTP + WebSocket), packages/schema/ (Zod canonical types)
- **Legacy Reference:** _archive/livedoc-mocha/_src/app — authoritative for expected behavior when unclear
- **Created:** 2026-03-22

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **StepContext ↔ StepDefinition shared-array pattern**: StepContext receives a reference to StepDefinition's `attachments` array via constructor. When users call `ctx.attach()` inside a step, it pushes directly to the StepDefinition's array — no post-step copy needed. This same pattern could be reused for any future step-level collection APIs.
- **Attachment type lives in `@swedevtools/livedoc-schema` (reporter-v3.ts)**: The canonical `Attachment` interface is in the schema package, re-exported via index. Both `ExecutionResult.attachments` and the Zod wire schema (`V3AttachmentSchema`) already exist — the plumbing from server to viewer was already done before the SDK-side API existed.
- **Pre-existing test failure**: `beautiful-tea-shipping-costs.Spec.ts` fails independently — not related to framework changes. 1 failed / 629 passed baseline as of this change.

### Team Updates (2026-03-22)

**Kaylee's ImageLightbox**: Viewer now displays step attachments via camera icon + full-viewport lightbox. Accepts images with `base64` or `uri` sources. Filter `kind === 'image' || kind === 'screenshot'` on `step.execution?.attachments`. ImageLightbox uses Radix Dialog primitives directly (custom layout + Framer Motion) — shadcn Dialog available separately for standard modals.

**Simon's .NET Attachment API**: FeatureTest and SpecificationTest both inherit `Attach()`, `AttachScreenshot()`, `AttachFile()` from LiveDocTestBase. Attachments collected per-step, transferred to `StepExecution.Attachments` on completion. Reporter models in `ReporterModels.cs`; JSON property names align with TypeScript schema.

### Team Updates (2026-03-22 — Multi-MIME Expansion)

**Kaylee's AttachmentViewer (TypeScript)**: ImageLightbox refactored into general-purpose AttachmentViewer supporting image, JSON (syntax-highlighted with custom tokenizer), text/* (monospace), and binary (metadata + download). ImageLightbox.tsx kept as backward-compat re-export. StepList icon is context-aware (Camera for images, Paperclip for mixed/non-image).

**Simon's AttachJson (.NET)**: LiveDocTestBase now offers `AttachJson(object data, string? title = null)`. Accepts objects or pre-formatted JSON strings, uses System.Text.Json with WriteIndented, delegates to `Attach()` with `mimeType: "application/json"`, `kind: "file"`.

### Reporter Consolidation (2026-07-25)

- **LiveDocServerReporter deleted**: All ~688 lines of duplicated model-building code removed. `LiveDocSpecReporter` now owns both console output AND auto-discovery/publishing.
- **Auto-discovery in `onInit()`**: `LiveDocSpecReporter.onInit()` is now `async`. Discovery priority: env vars (`LIVEDOC_SERVER_URL`/`LIVEDOC_PUBLISH_SERVER`) → dynamic import of `discoverServer()` from `@swedevtools/livedoc-server`. When discovered and `publish` not explicitly configured, sets `livedoc.options.publish.enabled = true` + `.server` so `onTestRunEnd()` picks it up naturally.
- **Extracted `buildExecutionResults()`**: Refactored inline model-building from `onTestRunEnd()` into a private `buildExecutionResults()` method. Accepts `testModule.task || testModule` for backward compatibility with both test mock shapes.
- **Backward compat re-export**: `index.ts` exports `LiveDocSpecReporter` as deprecated `LiveDocServerReporter` alias.
- **Test mock data**: Reporter tests now include proper `meta.livedoc` metadata on mock tasks (kind: "step"/"rule") to satisfy `LiveDocSpecReporter`'s strict validation.

### Documentation Update for Reporter Consolidation (2026-07-25)

- **Docs updated for single-reporter model**: reporters.mdx, configuration.mdx, viewer-integration.mdx, and viewer getting-started.mdx all updated to reflect `LiveDocSpecReporter` as the only reporter needed. `LiveDocServerReporter` section marked deprecated with old-vs-new comparison.
- **livedoc-vitest SKILL.md updated**: Added reporter configuration section (step 8) documenting auto-discovery behavior, simplified config examples, publish options, and backward compatibility note.
- **Auto-discovery priority documented**: env vars → explicit `publish` config → `discoverServer()` fallback — consistent across all doc surfaces.

### JSON File Export (2026-03-29)

- **`buildTestRun()` on LiveDocViewerReporter**: Added a public method that assembles a complete `TestRunV3` from `ExecutionResults` without making HTTP calls. Reuses all existing private conversion methods (buildFeatureTestCase, buildSpecificationTestCase, buildSuiteTestCase, calculateSummary, calculateOverallStatus). Uses `crypto.randomUUID()` for runId generation.
- **`export` config option on LiveDocSpecReporter**: Constructor parses `options.export.output` into an `ExportConfig`. In `onTestRunEnd()`, after console output and server publishing, instantiates `LiveDocViewerReporter` with project/environment and calls `buildTestRun()`, then writes JSON with `writeFileSync`. Runs ALONGSIDE (not instead of) server publishing.
- **Project/environment derivation**: Uses `livedoc.options.publish.project/environment` if set, falls back to export-level config, then defaults (`'default'` project, CI env var detection for environment).
- **Output format**: Produces valid `TestRunV3` JSON with `protocolVersion: '3.0'`, compatible with `livedoc-viewer export -i <file>`.
- **Test baseline unchanged**: 1 pre-existing failure (beautiful-tea-shipping-costs.Spec.ts), all other tests pass.

### Bug 2 — close/cleanup timeout investigation (2026-07-25)

- **Root cause**: Node.js `fetch()` (undici) uses HTTP keep-alive by default. When the LiveDocViewerReporter makes HTTP requests to publish results (or discoverServer checks the health endpoint), the TCP connections linger in undici's connection pool after responses are consumed. These active sockets prevent the Node.js event loop from draining, so Vitest's `close()` resolves but the process won't exit naturally. Vitest's `exit()` method sets a `teardownTimeout` timer (default 10s, `.unref()`'d) that eventually fires, logs "close timed out after 10000ms", and calls `process.exit()`.
- **Fix applied**: Added `'Connection': 'close'` header to all `fetch()` calls in `LiveDocViewerReporterV1.post()` and `discoverServer()` in `@swedevtools/livedoc-server`. This tells undici to close the TCP socket after each response instead of returning it to the keep-alive pool.
- **Playwright cleanup is fine**: The simplified `afterAll → browser.close()` approach in `useBrowser()` is correct and sufficient. Playwright's browser.close() properly shuts down the browser subprocess and its DevTools WebSocket. The cached `playwrightModule` from `ensurePlaywright()` holds no persistent resources (no servers, no subprocesses).
- **Key architecture insight**: Vitest's `exit()` flow — `close()` method runs global teardown → closes Vite servers → closes pool → runs `_onClose` callbacks → returns. Then if the process doesn't exit naturally within `teardownTimeout` (10s), it force-exits. The `hanging-process` reporter can help diagnose what's keeping the event loop alive.
- **Key file paths**: Vitest close logic lives in `cli-api.*.js` chunk around line 13799 (in Vitest 4.1.0). The `teardownTimeout` config option controls the grace period.

### Playwright Module Identity & Cross-Entry-Point Testing (2026-04-12)

- **Multi-Model Review Panel Results (2/3 consensus REQUEST CHANGES)**:
  - ✅ **Approved by opus** (Claude 4.5) with non-blocking note on duplicate imports
  - 🔴 **REQUEST CHANGES from gpt54** (Code Quality Reviewer) — Test is false positive; doesn't exercise packaged/bundled scenario. Needs real npm package artifact test.
  - 🔴 **REQUEST CHANGES from goldeneye** (Rapid Challenger) — Found cross-entry-point issue affects `setup.js` and `reporter/index.js` too (pre-existing). Current test only covers playwright entry point.
  
- **Root Issues Identified**:
  1. Test doesn't exercise actual packaged/bundled scenario (gpt54)
  2. Other entry points (setup.js, reporter/index.js) also inline hooks — not covered (goldeneye)
  3. Missing comprehensive cross-entry-point integration test

- **Action Items**: Assigned to Wash to refactor test with packaged artifacts + comprehensive cross-entry-point coverage before merge.

### Multi-Entry Self-Referencing Import Fix — All Entry Points (2026-07-26)

- **Root cause extended**: The v0.1.9 fix only addressed `playwright/index.ts`. Two other entry points — `setup.ts` and `reporter/LiveDocSpecReporter.ts` — still imported from relative paths (`./livedoc` and `../livedoc`), causing tsup to inline the entire livedoc module including `scenarioStartHooks`/`scenarioEndHooks` arrays into `dist/setup.js` (79KB → 485B) and `dist/reporter/index.js` (314KB → 275KB).
- **Fix**: Applied same self-referencing import pattern to both: changed `import ... from "./livedoc"` to `import ... from "@swedevtools/livedoc-vitest"`. tsup's `external` config already includes `@swedevtools/livedoc-vitest`, so these become real import/require statements in the bundle.
- **Build artifact regression test**: Created `bundled-output-integrity.Spec.ts` — 12 rules that read `dist/` files with `fs.readFileSync` and assert: (a) external imports of `@swedevtools/livedoc-vitest` are present, and (b) `scenarioStartHooks` is NOT present. Covers all 3 secondary entry points (playwright, setup, reporter) in both ESM and CJS formats.
- **Key learning**: Source-level tests (like the existing `module-identity.Spec.ts`) cannot catch bundling regressions — they always resolve to the same TypeScript source module. Build-artifact tests that read `dist/` output are essential for validating tsup/bundler behavior.
- **Verification**: All 6 entry-point bundles show 0 occurrences of `scenarioStartHooks`. 44 test files pass, 729 tests pass.

---



### Playwright Module Duplication Fix (v0.1.10)

- **Root cause**: `splitting: false` in tsup caused each entry point to bundle its own copy of all shared code. The playwright entry point inlined the entire `livedoc.ts` module, creating independent `scenarioStartHooks`/`scenarioEndHooks` arrays that were invisible to the main `scenario()` function. This broke `freshContextPerScenario` completely — hooks registered by `useBrowser()` went into the wrong array.
- **Fix**: Changed playwright entry point to use self-referencing package imports (`import { onScenarioStart, onScenarioEnd } from '@swedevtools/livedoc-vitest'`) and added `@swedevtools/livedoc-vitest` to tsup's `external` array. Both ESM and CJS bundles now emit a real import/require of the main package, sharing the same module instance at runtime.
- **Key pattern for multi-entry packages**: When a package has multiple entry points built by tsup with `splitting: false`, any shared mutable state (arrays, singletons, registries) MUST be accessed through a single module instance. Self-referencing imports (package importing itself via its own name + exports map) is the robust solution for both ESM and CJS.
- **Verification**: playwright bundle dropped from ~320KB to ~2.9KB; `scenarioStartHooks` count in playwright bundle went from 4 to 0; all tests pass.

### Release v0.1.10 (2026-07-26)

- **Released**: `@swedevtools/livedoc-vitest@0.1.10` — bugfix release for playwright module duplication regression from v0.1.9.
- **Artifact size**: 250.9 KB (down from 1049.1 KB in v0.1.9) — source maps disabled and module deduplication confirmed.
- **Verification**: All 3 secondary entry points (playwright, setup, reporter) confirmed clean — zero `scenarioStartHooks` inlined, external `@swedevtools/livedoc-vitest` imports present in playwright bundle.
- **Also packed**: `livedoc-viewer@0.0.12` via `scripts/pack-viewer.ps1`.
- **Git tag**: `v0.1.10` created with annotated message.
- **Learning**: `releases/` is gitignored — binary artifacts are not committed. Only source changes (self-referencing imports + regression tests) go into git.

### Vitest SDK Audit Bug Fixes (2026-07-27)

- **sv-1 (CRITICAL) — calculateSummary() ignores suites, duration always 0**: `calculateSummary()` in `LiveDocViewerReporterV1.ts` only counted features and specifications but completely ignored suites. Duration was read from `results.executionTime` which is never populated. Fix: added recursive suite test counting to the summary, and aggregated individual test durations as fallback when `executionTime` is not set.
- **sv-2 (High) — specifications never serialized in dynamic execution**: `executeDynamicTestAsync()` in `livedoc.ts` serialized `features` and `suites` but omitted `specifications`. Fix: added `specifications: specificationRegistry.map(s => s.toJSON())` to the serialization output, added `reconstructSpecification()` method for deserialization (handles Rule, RuleOutline, RuleExample), and added the reconstruction loop alongside features and suites.
- **sv-3 (High) — module-global state reused across dynamic runs**: Module-level variables (`scenarioStartHooks`, `scenarioEndHooks`, `capturedThrownException`, `resultsFileWritten`, `specificationRegistry`, background maps, etc.) were never reset between dynamic test executions. Fix: created `resetDynamicState()` function that clears all 16 module-global mutable variables, called at the start of `executeDynamicTestAsync()`.
- **sv-6 (High) — default port disagreement**: Server defaults to 3100, but `PublishOptions.ts` used 3200 and `LiveDocViewerReporter` used 3000. Fix: aligned both to 3100. Also added `console.warn()` in silent mode so publish failures produce a visible warning instead of being completely swallowed.
- **Build verification**: ESM and CJS bundles build successfully. DTS error is pre-existing (self-referencing import TS7016) — not introduced by these changes.

## Learnings

- **`resetDynamicState()` pattern**: When a module has many mutable globals that must be reset between runs, centralize the reset into a single function rather than scattering partial resets. The function serves as documentation of all mutable state and prevents future additions from being forgotten.
- **DTS build error is pre-existing**: `pnpm run build` in `packages/vitest` fails at the DTS stage due to self-referencing imports (`@swedevtools/livedoc-vitest`) not having declaration files at build time. ESM/CJS bundles compile fine. This is a known issue — not a regression from any code changes.
- **`RuleExample` constructor requires 2 args**: `new RuleExample(parent: Specification, ruleOutline: RuleOutline)` — the parent specification AND the parent outline are both required, unlike `ScenarioExample` which only takes the parent feature.

### Goldeneye Rejection Fixes — Round 2 (2026-07-27)

- **sv-8 (deleteRun session cleanup)**: `store-v1.ts.deleteRun()` removed the run from the store but never told SessionManager. Session's `runIds`, `runs`, `documents`, and `summary` went stale. Fix: `deleteRun()` now calls `sessionManager.rebuildSessionFromRuns()` with remaining runs after deletion. `rebuildSessionFromRuns()` now also syncs `activeSession.runIds` and calls `mergeDocuments()` so the session is fully consistent in one call.
- **sv-9 (shutdown ordering)**: `server.stop()` flushed pending saves BEFORE closing inbound traffic, so new requests could race during flush. Also didn't clear SessionManager's seal/grace timers. Fix: reordered to close HTTP → close WebSocket → clear timers → flush. Added `clearTimers()` method to SessionManager.
- **sv-2 (dynamic specification support)**: The wrapped import for dynamic execution omitted `specification`, `rule`, and `ruleOutline` exports — specs couldn't run in dynamic mode. `reconstructSpecification()` lost outline tables and example payloads during deserialization. Fix: added all 3 exports to the import line; added `outline.tables` reconstruction (matching ScenarioOutline pattern) and `example.example`/`exampleRaw`/`sequence` fields to RuleExample reconstruction.
- **sv-3 (livedoc.options not reset)**: `resetDynamicState()` missed `livedoc.options` and `displayedViolations`. Filters/rules could leak across dynamic runs, and violation deduplication could suppress legitimate violations in subsequent runs. Fix: reset `livedoc.options` to fresh `new LiveDocOptions()` and clear `displayedViolations` object.
