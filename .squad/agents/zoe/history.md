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

- **2026-03-22 — Step Attachment API specs written.** Created `packages/vitest/_src/test/Attachments/step-attachments.Spec.ts` with 18 rules across 6 specifications covering `attach()`, `attachScreenshot()`, `attachJSON()`, StepDefinition↔StepContext shared reference, multi-attachment accumulation, and edge cases. All passing. Full orchestration log: `.squad/orchestration-log/2026-03-22T0420-zoe.md`
- StepDefinition's `getStepContext()` passes `this.attachments` by reference — key design pattern to test (shared-array wiring).
- `attachJSON` accepts `unknown`; strings pass through as-is, objects get `JSON.stringify(data, null, 2)`. Base64 encoding uses `globalThis.btoa` with `Buffer` fallback.
- `StepDefinition.toJSON()` intentionally returns `undefined` (not `[]`) for empty attachments — keeps serialized output clean.
- The module-scoped `_attachmentCounter` in StepContext means IDs are unique within a process run but depend on counter state. Tests should compare IDs for inequality rather than assert specific values.
