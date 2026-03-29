# Project Context

- **Owner:** Garry
- **Project:** LiveDoc — a living documentation framework that generates documentation from executable BDD specifications. Monorepo spanning TypeScript (Vitest) and .NET (xUnit).
- **Stack:** C# 12, .NET 8.0, xUnit 2.9.0, System.CommandLine 2.0.0-beta4, Spectre.Console 0.49.1, MSBuild targets, NuGet packaging
- **My Domain:** dotnet/xunit/ (BDD framework with [Feature]/[Scenario] attributes, FeatureTest base class, LiveDocConsoleLogger, journey generator), dotnet/tool/ (.NET CLI tool with Spectre.Console)
- **NuGet Package:** SweDevTools.LiveDoc.xUnit (v0.1.7-beta1)
- **Created:** 2026-03-22

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **Attachment API pattern**: Attachments are collected per-step via `_currentStepAttachments` in `LiveDocContext`, then transferred to `StepExecution.Attachments` on step completion. The public API (`Attach`, `AttachScreenshot`, `AttachFile`) lives on `LiveDocTestBase` so both `FeatureTest` and `SpecificationTest` inherit it. The `Attachment` reporter model uses JSON property names matching the TypeScript schema (`id`, `kind`, `title`, `mimeType`, `uri`, `base64`).
- **Old vs new reporter models**: `REPORTER_MODEL_NET.cs` is a legacy model file. The active reporter models live in `Reporter/Models/ReporterModels.cs`. New model classes go there.

### Team Updates (2026-03-22T05:06 — BDD Feature Conversion)

**Zoe's TypeScript Feature Conversion**: Converted attachment tests to BDD pattern (feature/scenario). 73 tests pass. All test data in step titles, extracted via `ctx.step.values`. File: `packages/vitest/_src/test/Attachments/step-attachments.Spec.ts`. Orchestration log: `.squad/orchestration-log/2026-03-22T0506-zoe.md`

**Simon's .NET Feature Conversion**: Converted attachment tests to BDD pattern ([Feature]/[Scenario]). 19 tests pass. All values embedded in step titles, `GetAttachments()` helper fixed for step state reading. File: `dotnet/xunit/tests/Attachments/Attachment_Api_Spec.cs`. Orchestration log: `.squad/orchestration-log/2026-03-22T0506-simon.md`

### Team Updates (2026-03-22 — Attachment API Tests)

**Zoe's TypeScript Attachment Tests**: Complete spec coverage (18 rules) for `attach()`, `attachScreenshot()`, `attachJSON()`, shared-array reference pattern, ID uniqueness, multi-attachment accumulation, and edge cases. All passing. File: `packages/vitest/_src/test/Attachments/step-attachments.Spec.ts`. Orchestration log: `.squad/orchestration-log/2026-03-22T0420-zoe.md`

**Simon's .NET Attachment Tests**: Complete spec coverage (19 rules) for `Attach()`, `AttachScreenshot()`, `AttachFile()`, `AttachJson()`, multiple attachments, and edge cases. Reflection-based verification of internal state. All passing. File: `dotnet/xunit/tests/Attachments/Attachment_Api_Spec.cs`. Orchestration log: `.squad/orchestration-log/2026-03-22T0420-simon.md`

### Team Updates (2025-07-25)

**Wash's Attachment API**: StepContext now has `attach()` / `attachScreenshot()` methods plus `attachments` getter. Uses shared-array reference pattern — no post-execution copy. Reporter automatically includes attachments in ExecutionResult. ID generation via simple `att-{timestamp}-{counter}` scheme.

**Kaylee's ImageLightbox**: Viewer displays step attachments via camera icon + full-viewport lightbox. Filter `kind === 'image' || kind === 'screenshot'` on `step.execution?.attachments`. ImageLightbox uses Radix Dialog primitives directly (custom layout + Framer Motion); shadcn Dialog available separately for standard modals.

### Team Updates (2026-03-22 — Multi-MIME Expansion)

**Wash's attachJSON (TypeScript)**: StepContext now offers `attachJSON(data: unknown, title?: string)` convenience method. Accepts objects/arrays/strings, pretty-prints with 2-space indent, dual-env base64 encoding (btoa + Buffer). Delegates to `attach()` with `mimeType: 'application/json'`, `kind: 'file'`.

**Kaylee's AttachmentViewer (TypeScript)**: ImageLightbox refactored into general-purpose AttachmentViewer supporting image, JSON (syntax-highlighted with custom tokenizer), text/* (monospace), and binary (metadata + download). ImageLightbox.tsx kept as backward-compat re-export. StepList icon context-aware (Camera for images, Paperclip for mixed/non-image).

### Attachment API Spec Tests (2026-03-21)

- **Test verification pattern**: Attachment internals (`_currentStepAttachments` on `LiveDocContext`) are private and `_context` is `private protected` on `LiveDocTestBase`. No `InternalsVisibleTo` is configured. Verification in Specification tests uses reflection to peek at these fields. This is pragmatic for testing — the API surface is `protected`, but the collected state has no public accessor.
- **Spec test location**: `tests/Attachments/Attachment_Api_Spec.cs` — 19 rules covering `Attach()`, `AttachScreenshot()`, `AttachFile()`, `AttachJson()`, multiple attachments, and edge cases (null, empty, arrays).
- **AttachJson null handling**: `AttachJson(null!)` works because `null is string` evaluates to `false`, so it falls through to `JsonSerializer.Serialize(null)` which produces `"null"`. This is correct behavior.

### JSON File Export (2026-03-29)

- **Export architecture**: `LiveDocTestRunReporter.FlushCoreAsync()` was refactored to separate payload building from server publishing. The new `ExportTestRunJsonAsync()` runs alongside `PublishToServerAsync()` — both share the same built `List<TestCase>`. This avoids double-building and lets export work even when no server is configured.
- **Config via env var**: `LIVEDOC_EXPORT_PATH` env var drives export. Added to `LiveDocConfig` alongside existing `LIVEDOC_SERVER_URL`, `LIVEDOC_PROJECT`, `LIVEDOC_ENVIRONMENT`. The `LiveDocConfig` explicit constructor gained an optional `exportPath` parameter for testing.
- **IsEnabled broadened**: `LiveDocTestRunReporter.IsEnabled` now returns true if *either* server or export is configured. This is critical because `LiveDocContext` and `LiveDocTestFramework` gate data collection on this property — without it, export-only mode would produce empty files.
- **TestRunV3 model already existed**: `ReporterModels.cs` had a `TestRunV3` class with `protocolVersion`, `runId`, `project`, `environment`, `framework`, `timestamp`, `duration`, `status`, `summary`, `documents`. No model changes needed.
- **JSON options**: Export uses `WriteIndented = true` plus the same `camelCase` + `WhenWritingNull` options as `LiveDocReporter`. The `LowercaseEnumConverter<T>` on enum types takes precedence over the options-level `JsonStringEnumConverter`.
