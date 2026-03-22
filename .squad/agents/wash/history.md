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
