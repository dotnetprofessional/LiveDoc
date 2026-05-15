# Project Context

- **Owner:** Garry
- **Project:** LiveDoc — a living documentation framework that generates documentation from executable BDD specifications. Monorepo spanning TypeScript (Vitest) and .NET (xUnit).
- **Stack:** Vitest 4.0.16 (TypeScript tests), xUnit 2.9.0 (.NET tests), BDD/Gherkin DSL, Specification patterns
- **My Domain:** Test strategy across all packages — TypeScript (.Spec.ts files, BDD/Specification patterns) and .NET ([Feature]/[Scenario] attributes)
- **Testing Guidelines:** .github/instructions/livedoc-vitest.instructions.md — canonical reference for test authoring
- **Legacy Reference:** _archive/livedoc-mocha/ — feature parity validation source
- **Created:** 2026-03-22

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-05-13 — Test-to-Viewer Flow Validation.** Menu test command (`pnpm run test`) uses `livedoc.vitest.ts` config with `LiveDocSpecReporter` that auto-discovers LiveDoc server via `@swedevtools/livedoc-server#discoverServer()`. Discovery reads `%TEMP%\livedoc-server.json` (port file) created by `server.listen()`. If viewer was started before port-file logic was added, or if started manually without calling `.listen()`, the port file won't exist and tests won't publish to viewer. Solution: Ensure viewer is started via `./scripts/start-viewer.ps1` which properly initializes the embedded server. Alternative: Set `LIVEDOC_SERVER_URL=http://localhost:3100` env var to bypass discovery.

- **2026-03-22T05:06 — BDD Feature Conversion Complete.** Converted TypeScript attachment tests from specification/rule to feature/scenario/given/when/then BDD pattern. 73 tests pass. All values embedded in step titles with `ctx.step.values` extraction. File: `packages/vitest/_src/test/Attachments/step-attachments.Spec.ts`. Orchestration log: `.squad/orchestration-log/2026-03-22T0506-zoe.md`
- **2026-03-22T04:20 — Step Attachment API specs written.** Created `packages/vitest/_src/test/Attachments/step-attachments.Spec.ts` with 18 rules across 6 specifications covering `attach()`, `attachScreenshot()`, `attachJSON()`, StepDefinition↔StepContext shared reference, multi-attachment accumulation, and edge cases. All passing. Full orchestration log: `.squad/orchestration-log/2026-03-22T0420-zoe.md`
- StepDefinition's `getStepContext()` passes `this.attachments` by reference — key design pattern to test (shared-array wiring).
- `attachJSON` accepts `unknown`; strings pass through as-is, objects get `JSON.stringify(data, null, 2)`. Base64 encoding uses `globalThis.btoa` with `Buffer` fallback.
- `StepDefinition.toJSON()` intentionally returns `undefined` (not `[]`) for empty attachments — keeps serialized output clean.
- The module-scoped `_attachmentCounter` in StepContext means IDs are unique within a process run but depend on counter state. Tests should compare IDs for inequality rather than assert specific values.
- **2026-07-25 — Reporter Fallback Path Regression Tests (v2).** Refactored `Message_Sink_Fallback_Spec.cs` to use pure isolation — no singleton calls. Outline expansion tests construct `RuleOutlineTest` directly; counter test verifies FinalizeOutlineStats groups by RowId (multi-step rows count once). Also discovered Bug #2 fix (Skipped→Pending) was never applied to source; applied fix to `FinalizeOutlineStats` in `LiveDocTestRunReporter.cs`. Verified: 458 tests pass, JSON export `summary.total == sum(doc.statistics.total)` (446=446).
- `LiveDocTestRunReporter` is a singleton — NEVER call Buffer/RecordResult from tests, as phantom entries cause count discrepancy between `_totalCount` and document statistics. Use isolated model objects instead.
- `FinalizeOutlineStats` is `private static` — testable via `MethodInfo.Invoke` reflection. Pure function: takes `Statistics`, `List<ExampleResult>`, `ExecutionResult`.
- **2026-07-26 — Scenario Lifecycle Hook Tests.** Created `packages/vitest/_src/test/Playwright/scenario-hooks.Spec.ts` with 7 scenarios (19 steps) covering `onScenarioStart`/`onScenarioEnd` hooks: per-scenario invocation count, no per-step firing, scenarioOutline example-level firing, and hook ordering. All passing.
- **2026-07-26 — Fresh Context Per Scenario Integration Test.** Created `packages/vitest/_src/test/Playwright/fresh-context-per-scenario.Spec.ts` with 7 scenarios testing localStorage, cookie, and sessionStorage isolation between scenarios when `freshContextPerScenario: true`. Requires Playwright + running viewer on port 3100.
- `onScenarioStart`/`onScenarioEnd` hooks are module-level arrays (`scenarioStartHooks`, `scenarioEndHooks` in livedoc.ts). They accumulate globally — no clear/reset API exists. Tests must track their own counters via closures.
- Hooks fire in `beforeAll` of each scenario's `describe` block — by the time a `given` step runs, the start hook has already executed. Test assertions should account for this timing.
- **2026-07-27 — Module Identity Regression Tests (v0.1.9 bundling bug).** Created `packages/vitest/_src/test/Playwright/module-identity.Spec.ts` with 6 scenarios (16 steps) covering: function reference equality across import paths, hook-fires-during-scenario integration, multi-hook registration, end-hook parity, and payload accumulation. Guards against tsup `splitting: false` duplicating the `scenarioStartHooks` array across entry points. All 16 tests pass; 717 existing tests unaffected.
- **2026-05-13 — GettingStarted public-doc rewrite slice.** Migrated the weak Basic Calculator tutorial into `packages/vitest/_src/test/GettingStarted/FirstFeature.Spec.ts` and moved calculator arithmetic rule coverage from `Specification/specification-rules.Spec.ts` into `GettingStarted/FirstSpecification.Spec.ts`. The public starter examples now carry `@getting-started` and `@public-doc` tags, keep values in titles/tables, and pass targeted runs.

- **2026-05-13 — Public-doc test taxonomy migration.** Moved Zoe-owned public Vitest specs into capability-first folders: `ShowcaseExamples`, `AttachingEvidence`, `FilteringAndTags`, `WritingFeatures`, and `WritingSpecifications`. Targeted migrated-spec run passes with `pnpm --filter @swedevtools/livedoc-vitest test:silent -- ...`.

### Multi-Model Review Panel: Module Identity Test Findings (2026-04-12)

- **Review Consensus**: REQUEST CHANGES (2/3 reviewers) — gpt54 and goldeneye block on test quality issues
- **Finding 1 (gpt54)**: Test identified as false positive — doesn't exercise packaged/bundled scenario (actual npm package or bundled dist/ files). Needs real packaged-artifact integration test to prove hook registration works when consuming from `@swedevtools/livedoc-vitest` package import.
- **Finding 2 (goldeneye)**: Cross-entry-point discovery — `setup.js` and `reporter/index.js` ALSO inline `scenarioStartHooks` (pre-existing architectural issue, not caused by this change). Current test only covers playwright entry point. Real test must exercise all entry points independently registering hooks.
- **Code fix correct** (all reviewers agree). Fix itself using self-referencing imports is sound.
- **Action assigned**: Wash to refactor test with packaged artifacts + comprehensive cross-entry-point coverage before merge

---

### Team Updates (2026-05-13 — Test Quality & Organization Assessment)

**Cross-Agent Findings:**
- **Mal** identified implementation-centric hierarchy; recommended capability-first taxonomy (GettingStarted, WritingFeatures, WritingSpecifications, ... ShowcaseExamples).
- **Wash** found strong regression coverage but not public-facing living docs; recommended curated public model + internal quarantine.
- **Your focus area:** Test files with critical value drift and weak living-doc structure. Coordinate with Mal on public showcase tier criteria.

**Next Priority:** Convert priority test files to embedded-value format per guidelines; add descriptions/tags; prepare for reorganization sprint led by Mal.

---

### Regression Test Design: lastrun.json Hydration Bug (2026-05-14)

**Context:** Valid xUnit RuleOutline lastrun files with sessionId not hydrating correctly on viewer startup. Corrupt/old-schema lastruns fail silently. Stale empty sessions mask valid runs.

**Bug Analysis:**
- Server reads `lastrun.json` during initialization (store-v1.ts:287-295)
- Silently catches parse/schema errors without diagnostics (line 293: `catch { // no lastrun }`)
- Hierarchy endpoint includes `latestSession` which can be empty/stale (store-v1.ts:526)
- Client viewer prioritizes session over run when both exist (useWebSocket.ts:118-125)

**Proposed Regression Tests:**

**File:** `packages/server/test/ServerV1API.Spec.ts` (append to existing test file)

**Test 1: Valid xUnit RuleOutline lastrun hydrates on server startup**
- **Pattern:** BDD `scenario`
- **Setup:** Write valid xUnit RuleOutline payload (like lastrun.json artifact) to `{dataDir}/testhost/local/lastrun.json` before server.initialize()
- **Given:** "a valid xUnit RuleOutline lastrun.json with sessionId exists on disk"
- **When:** "the server initializes and loads persisted runs"
- **Then:** "the hierarchy should include the run with runId '<runId>' and sessionId '<sessionId>'" — extract runId/sessionId from artifact payload via `ctx.step.values`
- **Then:** "the run should have '1' document of kind 'Specification'" — verify RuleOutline structure intact
- **Then:** "the outline should have '4' example results" — verify exampleResults array length from artifact
- **Asserts:** `server.getRunStore().getRun(runId)` is defined, sessionId matches, documents[0].kind === "Specification", exampleResults.length === 4

**Test 2: Corrupted lastrun.json produces diagnostic on server startup**
- **Pattern:** BDD `scenario`
- **Setup:** Write malformed JSON (`{"protocolVersion": "1.0", "runId": "abc", `) to `{dataDir}/corrupt-project/local/lastrun.json` before server.initialize()
- **Given:** "a corrupted lastrun.json with invalid JSON syntax exists on disk"
- **When:** "the server initializes with a custom logger capturing warnings"
- **Then:** "the logger should receive a warning containing 'lastrun' and 'corrupt-project'" — verify diagnostic was emitted
- **Then:** "the hierarchy for project 'corrupt-project' should have '0' runs" — graceful degradation
- **Asserts:** Custom logger receives warning, `server.getRunStore().getRunsForProject('corrupt-project', 'local').length === 0`

**Test 3: Old-schema lastrun (missing required field) produces diagnostic**
- **Pattern:** BDD `scenario`
- **Setup:** Write old-schema payload missing `protocolVersion` to `{dataDir}/old-schema/local/lastrun.json`
- **Given:** "an old-schema lastrun.json missing 'protocolVersion' field exists on disk"
- **When:** "the server initializes with a custom logger"
- **Then:** "the logger should receive a warning about schema version mismatch"
- **Then:** "the run should not be loaded into memory" — prevent corrupt data from breaking viewer
- **Asserts:** Logger captures diagnostic, run not in store

**Test 4: Empty session does not hide valid latest run in hierarchy**
- **Pattern:** BDD `scenario`
- **Setup:** Create valid run via API, then create empty session with same project/env but no runs
- **Given:** "a valid run with runId '<runId>' exists for project 'TestProj' environment 'local'"
- **Given:** "an empty session exists for the same project and environment"
- **When:** "fetching the project hierarchy from /api/v1/hierarchy"
- **Then:** "the hierarchy should include both latestRun and latestSession" — both should coexist
- **Then:** "latestRun.runId should be '<runId>'" — valid run visible
- **Then:** "latestSession should not be 'null'" — session also visible
- **Asserts:** Verify hierarchy endpoint returns both fields populated; client can choose which to display

**Implementation Notes:**
- Use existing `ServerV1API.Spec.ts` test patterns (background setup, baseUrl, testDataDir cleanup)
- Extract all values from step titles via `ctx.step.values` per guidelines
- Custom logger: `const warnings: string[] = []; server = createServer({ logger: (msg) => warnings.push(msg) })`
- File system setup: Use `fs.writeFile` before `server.initialize()` to pre-populate lastrun files
- Total: 4 scenarios, ~16 steps — minimal coverage, maximum signal

### Team Updates (2026-05-15 — lastrun-viewer-diagnostics investigation)

**Zoe's regression test proposal:** Analyzed viewer hydration issues with xUnit lastrun data. Proposed 4 minimal BDD regression test scenarios for ServerV1API.Spec.ts: (1) Valid RuleOutline hydration, (2) Corrupted JSON diagnostic, (3) Old-schema diagnostic, (4) Empty session coexistence. All tests use BDD pattern with embedded values per LiveDoc guidelines. ~16 total steps. Guards against silent failures, startup UX regressions, and session/run priority conflicts. Decision documented: "lastrun.json Hydration Regression Tests". Status: Ready for implementation.

**Kaylee's diagnostics proposal:** Viewer diagnostics framework proposed for static data validation, enhanced empty state detection, dev-mode diagnostics panel, error boundaries, and protocol version checks. Awaiting architecture review.

**Simon's payload compatibility inspection:** xUnit lastrun conforms to Reporter v1 schema with two identified fragilities (sessionId field mismatch, enum serialization as type=object). No render blocker — requires server/viewer guardrails. Inspection complete, no code changes needed.

