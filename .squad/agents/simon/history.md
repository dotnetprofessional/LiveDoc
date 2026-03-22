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

### Team Updates (2026-03-22)

**Wash's Attachment API**: StepContext now has `attach()` / `attachScreenshot()` methods plus `attachments` getter. Uses shared-array reference pattern — no post-execution copy. Reporter automatically includes attachments in ExecutionResult. ID generation via simple `att-{timestamp}-{counter}` scheme.

**Kaylee's ImageLightbox**: Viewer displays step attachments via camera icon + full-viewport lightbox. Filter `kind === 'image' || kind === 'screenshot'` on `step.execution?.attachments`. ImageLightbox uses Radix Dialog primitives directly (custom layout + Framer Motion); shadcn Dialog available separately for standard modals.

### Team Updates (2026-03-22 — Multi-MIME Expansion)

**Wash's attachJSON (TypeScript)**: StepContext now offers `attachJSON(data: unknown, title?: string)` convenience method. Accepts objects/arrays/strings, pretty-prints with 2-space indent, dual-env base64 encoding (btoa + Buffer). Delegates to `attach()` with `mimeType: 'application/json'`, `kind: 'file'`.

**Kaylee's AttachmentViewer (TypeScript)**: ImageLightbox refactored into general-purpose AttachmentViewer supporting image, JSON (syntax-highlighted with custom tokenizer), text/* (monospace), and binary (metadata + download). ImageLightbox.tsx kept as backward-compat re-export. StepList icon context-aware (Camera for images, Paperclip for mixed/non-image).
