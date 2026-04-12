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
