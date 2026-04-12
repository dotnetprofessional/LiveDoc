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

### Source Map Removal (2026-04-12)

- **Source maps disabled in all npm packages**: Set `sourcemap: false` in tsup configs for schema, server, and vitest. Savings: schema 61.8KB, server 514.8KB, vitest 4,301.9KB — total ~4.9MB removed (67% reduction across all three packages).
- **Source maps should stay off for published packages**: Consumers get IntelliSense from `.d.ts` files. React, Vue, Vitest, Zod all ship without source maps. Viewer (Vite) is unchanged since it's a bundled app, not an npm library.
- **Pre-existing server test failures**: 48 tests in packages/server fail due to temp directory issues (ENOENT on history files). These are pre-existing and unrelated to framework changes.
