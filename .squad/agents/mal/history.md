# Project Context

- **Owner:** Garry
- **Project:** LiveDoc — a living documentation framework that generates documentation from executable BDD specifications. Monorepo spanning TypeScript (Vitest) and .NET (xUnit).
- **Stack:** TypeScript 5.9.3, Vitest 4.0, React 19, Tailwind CSS 4, Radix UI, Zustand, Hono, Zod, C# 12/.NET 8, xUnit, Docusaurus 3, pnpm workspaces
- **Key Packages:** packages/vitest (core BDD DSL), packages/viewer (React dashboard), packages/server (Hono/WS), packages/schema (Zod types), packages/vscode (VS Code extension), dotnet/xunit (C# BDD framework), dotnet/tool (.NET CLI), docs/ (Docusaurus site)
- **Created:** 2026-03-22

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2025-07-25**: Analyzed scenario-level attachment gallery feasibility. Key finding: the schema (`Node.execution: ExecutionResult.attachments`) already supports attachments at every node level including Scenario — it's just never populated above step level. Client-side aggregation via `flatMap` over `steps[].execution.attachments` is the right approach for Phase 1 — zero backend/schema changes needed. AttachmentViewer already handles multi-attachment browsing with prev/next. Phase 1 is ~50-80 lines across 3 files (ScenarioBlock, AttachmentViewer, utility function). Scenario Outline support deferred to Phase 2 due to per-example-row aggregation complexity. **Implemented**: Kaylee completed full scenario-level gallery with 170-line utilities (GalleryItem, StepGroup, navigation helpers), enhanced AttachmentViewer with step context bar, auto-play, keyboard nav, film strip dividers, and integrated into ScenarioBlock + StepList for unified step-level entry. Architecture validated as backward-compatible; no breaking changes.
