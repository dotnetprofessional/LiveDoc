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
