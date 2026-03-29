# Squad Decisions

## Active Decisions

### Screenshot/Attachment API Design

**Author:** Wash  
**Date:** 2025-07-24  
**Status:** Implemented

**Decision:** Use shared-array reference pattern — StepContext's constructor accepts an optional `Attachment[]` reference (defaulting to `[]`). StepDefinition passes its own `attachments` array into `new StepContext(this.attachments)`. When users call `ctx.attach()` or `ctx.attachScreenshot()`, items push directly to the StepDefinition's array.

**ID generation:** Simple `att-{timestamp}-{counter}` scheme. No crypto dependency.

**Reporter wiring:** `stepExecution()` in V3 reporter reads `step.attachments` and includes them in `ExecutionResult.attachments` (only when non-empty). No server/schema changes needed — types already existed.

**Impact:**
- `packages/vitest/_src/app/model/StepContext.ts` — new `attach()`, `attachScreenshot()`, `attachments` getter
- `packages/vitest/_src/app/model/StepDefinition.ts` — new `attachments` field
- `packages/vitest/_src/app/reporter/LiveDocViewerReporterV3.ts` — attachments included in `ExecutionResult`

---

### ImageLightbox: Radix Primitives for Full-Viewport Layout

**Author:** Kaylee  
**Date:** 2026-07-24  
**Status:** Implemented

**Decision:** ImageLightbox uses `@radix-ui/react-dialog` primitives directly (not the shadcn Dialog wrapper) because:
1. Needs full-viewport overlay layout — not the centered card that shadcn's DialogContent provides
2. Framer Motion animations require `asChild` + `forceMount`, which conflicts with shadcn wrapper's built-in close button and CSS animations
3. shadcn Dialog still available in `ui/dialog.tsx` for standard modal use cases

**Impact:**
- Two dialog patterns coexist: shadcn Dialog for standard modals, raw Radix for the lightbox
- Future lightbox-style components (video player, code preview) should follow the ImageLightbox pattern

---

### Attachment API on LiveDocTestBase (Not Just FeatureTest)

**Author:** Simon  
**Date:** 2025-07-18  
**Status:** Implemented

**Decision:** Placed attachment API (`Attach`, `AttachScreenshot`, `AttachFile`) on `LiveDocTestBase` (the shared base class) rather than `FeatureTest` alone. Both `FeatureTest` and `SpecificationTest` now inherit these methods.

**Rationale:**
- Avoids code duplication — SpecificationTest users also need attachments during Rule tests
- Attachments are not step-specific in concept — valid in any test type
- The underlying `LiveDocContext.AddAttachment()` mechanism is test-type-agnostic

**Impact:**
- `dotnet/xunit/SweDevTools.LiveDoc.xUnit/LiveDocTestBase.cs` — new public methods
- `dotnet/xunit/SweDevTools.LiveDoc.xUnit/Execution/LiveDocContext.cs` — attachment collection and transfer logic
- `dotnet/xunit/SweDevTools.LiveDoc.xUnit/Reporter/Models/ReporterModels.cs` — new `Attachment` class, updated `ExecutionResult`

---

### AttachmentViewer: Multi-MIME Rendering with Raw Radix Primitives

**Author:** Kaylee  
**Date:** 2026-03-22  
**Status:** Implemented

**Decision:** Refactored `ImageLightbox` into a general-purpose `AttachmentViewer` component that renders content based on MIME type. Continues to use raw `@radix-ui/react-dialog` primitives (not the shadcn wrapper) — same rationale as the original lightbox decision.

**MIME dispatch strategy:**
| Category | MIME Patterns | Rendering |
|---|---|---|
| `image` | `image/*` | Existing Framer Motion animated `<img>` |
| `json` | `application/json`, `application/ld+json` | Syntax-highlighted `<pre>` with custom tokenizer, copy button, error handling |
| `text` | `text/*` | Monospace `<pre>` with scroll, copy button, size estimate |
| `binary` | Everything else | Metadata card with copy-base64 and download buttons |

**Key decisions:**
1. **No external syntax highlighting library** — built a lightweight regex-based JSON tokenizer (~40 lines). Keeps bundle small, matches the app's dark overlay theme with semantic colors (sky for keys, emerald for strings, amber for numbers, violet for booleans, rose for null).
2. **Base64 decoding uses `atob` + `TextDecoder`** — handles UTF-8 correctly, works in all modern browsers.
3. **`ImageLightbox.tsx` kept as re-export** for backward compatibility. Any future consumers can import from either path.
4. **StepList icon is context-aware** — Camera icon when all attachments are images/screenshots, Paperclip for mixed or non-image sets.

**Impact:**
- `packages/viewer/src/client/components/AttachmentViewer.tsx` — new primary component
- `packages/viewer/src/client/components/ImageLightbox.tsx` — reduced to re-export shim
- `packages/viewer/src/client/components/StepList.tsx` — updated filtering, icon logic, import

---

### attachJSON Convenience Method on StepContext

**Author:** Wash  
**Date:** 2026-03-22  
**Status:** Implemented

**Decision:** Added `attachJSON(data: unknown, title?: string)` to `StepContext` as a convenience method for JSON payloads.

**Behavior:**
- Accepts any value (objects, arrays, strings, primitives)
- Strings passed through as-is (user may have pre-formatted JSON)
- Pretty-prints objects with 2-space indent via `JSON.stringify`
- Base64-encodes using `globalThis.btoa` (browser) with `Buffer` fallback (Node.js)
- Delegates to `attach()` with `mimeType: 'application/json'` and `kind: 'file'`

**Rationale:**
- **Dual-environment encoding**: `btoa` + `encodeURIComponent/unescape` handles Unicode safely in browsers; `Buffer` handles it natively in Node. The pattern mirrors common cross-platform base64 recipes.
- **`kind: 'file'`**: JSON is data, not an image — consistent with the existing attachment taxonomy.
- **`unknown` over `object`**: Allows attaching arrays, primitives, or pre-serialized strings without type gymnastics.

**Impact:**
- `packages/vitest/_src/app/model/StepContext.ts` — new `attachJSON` method

---

### AttachJson Convenience Method on LiveDocTestBase

**Author:** Simon  
**Date:** 2026-03-22  
**Status:** Implemented

**Decision:** Added `AttachJson(object data, string? title = null)` to `LiveDocTestBase` as a convenience method for JSON payloads.

**Behavior:**
- Accepts any `object`; if it's already a `string`, uses it as-is (pre-formatted JSON)
- Serializes via `System.Text.Json.JsonSerializer` with `WriteIndented = true`
- Base64-encodes the UTF-8 bytes and delegates to `Attach()` with `mimeType: "application/json"`, `kind: "file"`

**Rationale:**
- **System.Text.Json** over Newtonsoft: aligns with the project's zero-external-dependency approach for the core library.
- **String passthrough**: lets users attach raw JSON strings from HTTP responses without double-serialization.
- **WriteIndented**: prioritizes readability in the living documentation output.

**Impact:**
- `dotnet/xunit/SweDevTools.LiveDoc.xUnit/LiveDocTestBase.cs` — new `AttachJson` method

---

### AttachmentViewer Cinematic Lightbox Redesign

**Author:** Kaylee  
**Date:** 2026-07-25  
**Status:** Implemented

**Decision:** Redesigned `AttachmentViewer` from a basic overlay viewer into a cinematic lightbox gallery with structured layout, film strip navigation, and direction-aware slide animations.

**Architecture changes:**
1. **Layout shifted from centered overlay to full-viewport flex column** — header bar overlays the top with a gradient fade, content area centers in the middle, film strip anchors at the bottom.
2. **Decomposed into sub-components** — `HeaderBar`, `NavArrow`, `FilmStrip`, `ThumbnailIcon` are internal components. Keeps the main `AttachmentViewer` focused on state management and layout.
3. **Direction-aware animations** — New `slideVariants` system tracks navigation direction (+1 forward, -1 backward). Content slides in from the correct side. All sub-renderers accept a `direction` prop and use Framer Motion's `custom` prop for variant resolution.
4. **Film strip thumbnails** — Image attachments render actual `<img>` thumbnails. JSON/text/binary show typed icons (FileJson, FileCode, FileText) with MIME label badges. Active thumbnail gets a sky-400 ring with box-shadow glow and auto-scrolls into view.
5. **Glassmorphic controls** — Nav arrows and film strip use `backdrop-blur-sm` + subtle `ring-1 ring-white/[0.08]` for a refined glass effect on the dark overlay.

**Props interface:** Unchanged — `AttachmentViewerProps` and `AttachmentItem` are identical to the previous version. No changes needed to StepList.tsx.

**Preserved behaviors:**
- Backdrop click dismiss (on content area and top-level container)
- ESC to close (handled by Radix Dialog)
- X button close (in header bar now)
- ArrowLeft/ArrowRight keyboard navigation
- All MIME-type renderers (image, JSON, text, binary)
- Raw Radix Dialog primitives (not shadcn wrapper)

**New helper:** `mimeLabel()` function extracts short human-readable labels from MIME types for badges and thumbnail labels.

**Impact:**
- `packages/viewer/src/client/components/AttachmentViewer.tsx` — full rewrite
- No other files modified

---

### Scenario-Level Attachment Gallery

**Author:** Kaylee  
**Date:** 2026-03-22  
**Status:** Implemented  
**Phase:** Phase 1 (Scenario-level only)

**Decision:** Implemented a full-featured scenario-level attachment gallery that aggregates attachments from all steps in a scenario, providing a unified viewing experience with step-aware navigation, auto-play, and cinematic transitions.

**Architecture:**

**`utils/gallery.ts`** — Centralized gallery logic:
- `GalleryItem` extends `AttachmentItem` with step context (`stepIndex`, `stepKeyword`, `stepTitle`, `stepStatus`)
- `StepGroup` for step-grouped navigation with `startIndex` into flat array
- `collectScenarioAttachments()` — aggregates attachments from all steps with context
- `groupByStep()` — organizes items by step
- Navigation helpers: `findGroupAtIndex()`, `jumpToAdjacentGroup()`

**Component Enhancements:**

**AttachmentViewer:**
- **Backward compatible** — optional step context fields on `AttachmentItem`
- **StepContextBar** — frosted glass bar showing step N of M, keyword (colorized), title, status icon
- **Step-boundary transitions** — cross-fade with brightness dim (400ms) vs. standard slide (280ms)
- **Enhanced keyboard nav**: `[`/`]` for step jump, `Space` for auto-play toggle, `Home`/`End`
- **Auto-play slideshow** — 3s base interval + 1s step-boundary pause, linear progress bar, stops at end
- **Film strip dividers** — vertical separators with keyword labels, active group highlighting

**ScenarioBlock:**
- Gallery button in header (right side, near status badge)
- Icon adapts: `Images` for all-images, `Paperclip` for mixed
- Count badge shows total across all steps
- Smart default: opens at first attachment of first failed step
- Only shown when attachments exist

**StepList:**
- Receives `galleryItems` from parent ScenarioBlock
- Step icons open scenario gallery at that step's position (unified entry)
- Calculates `initialIndexInGallery` for each step
- Users can navigate beyond individual step into full scenario context

**Trade-offs:**
- Optional fields for backward compatibility
- Auto-play stops (not infinite loop) for intentional control
- 3s base + 1s step pause creates "chapter break" feel

**Impact:**
- `packages/viewer/src/client/utils/gallery.ts` — new utility module
- `packages/viewer/src/client/components/AttachmentViewer.tsx` — enhanced with gallery features
- `packages/viewer/src/client/components/ScenarioBlock.tsx` — added gallery button
- `packages/viewer/src/client/components/StepList.tsx` — unified entry point

---

### Reporter Consolidation: LiveDocServerReporter → LiveDocSpecReporter

**Author:** Wash  
**Date:** 2026-07-25  
**Status:** Implemented

**Decision:** Consolidated `LiveDocServerReporter` into `LiveDocSpecReporter`. The ~688-line `LiveDocServerReporter.ts` was deleted. Its only unique value — server auto-discovery — was moved into `LiveDocSpecReporter.onInit()`.

**Rationale:**
- ~800 lines of duplicated model-building code between the two reporters created a maintenance burden and divergence risk
- The two reporters were always used together in config files (one for console, one for publishing), which is unnecessary complexity for consumers
- A single reporter with auto-discovery is simpler to configure and reason about

**Key Design Choices:**
1. **Auto-discovery in `onInit()`** — sets `livedoc.options.publish.enabled/server` so `onTestRunEnd()` picks it up via the existing publish config path. No new state fields needed.
2. **`onInit` became async** — required for `discoverServer()`. Vitest's Reporter interface accepts async `onInit`.
3. **Backward-compatible re-export** — `index.ts` re-exports `LiveDocSpecReporter` as `LiveDocServerReporter` with `@deprecated` JSDoc. External consumers' imports won't break.
4. **Extracted `buildExecutionResults()`** — refactored inline model-building from `onTestRunEnd()` into a private method, improving testability and mirroring the old `LiveDocServerReporter` API surface (used by tests via `as any`).

**Impact:**
- `packages/vitest/_src/app/reporter/LiveDocSpecReporter.ts` — async `onInit`, extracted `buildExecutionResults`
- `packages/vitest/_src/app/reporter/LiveDocServerReporter.ts` — **deleted**
- `packages/vitest/_src/app/reporter/index.ts` — deprecated re-export
- `packages/vitest/livedoc.vitest.ts` — removed second reporter
- `packages/vitest/vitest.config.viewer.ts` — removed second reporter
- `packages/vitest/examples/local-consumer/vitest.config.ts` — simplified to single reporter
- `packages/vitest/_src/test/Reporter/server-reporter-parses-tags.Spec.ts` — uses `LiveDocSpecReporter`, mock data updated with `meta.livedoc`
- `packages/vitest/_src/test/Reporter/viewer-reporter-posts-valid-payloads.Spec.ts` — same

---

### Documentation: Single-Reporter Messaging

**Author:** Wash  
**Date:** 2026-07-25  
**Status:** Implemented

**Decision:** All documentation now positions `LiveDocSpecReporter` as the single reporter needed for both console output and server auto-discovery. `LiveDocServerReporter` is documented as deprecated (backward-compatible re-export) but no longer promoted in examples or guides.

**Rationale:**
- Reduces cognitive load — users configure one reporter instead of two
- Auto-discovery is transparent; zero-config is the default happy path
- Explicit `publish` config and `LiveDocViewerReporter` post-reporter remain available as escape hatches for advanced use
- Old two-reporter configs still work via the deprecated re-export, so no breaking changes

**Impact:**
- `docs/docs/vitest/reference/reporters.mdx` — LiveDocSpecReporter section expanded with auto-discovery + publish options; LiveDocServerReporter marked deprecated
- `docs/docs/vitest/reference/configuration.mdx` — All examples use single reporter
- `docs/docs/vitest/guides/viewer-integration.mdx` — Simplified to single-reporter approach
- `docs/docs/viewer/learn/getting-started.mdx` — Auto-discovery primary, explicit config secondary
- `.github/skills/livedoc-vitest/SKILL.md` — New reporter configuration section (step 8)

---

### JSON File Export via LiveDocSpecReporter

**Author:** Wash  
**Date:** 2026-03-29  
**Status:** Implemented

**Decision:** Added a `buildTestRun()` method to `LiveDocViewerReporter` and an `export` config option to `LiveDocSpecReporter` that writes a `TestRunV3`-compatible JSON file directly after the test run — no server needed.

**Rationale:**
- CI/build servers may not have a LiveDoc server running
- The static HTML export (`livedoc-viewer export`) requires a `TestRunV3` JSON file as input
- All conversion logic already existed in `LiveDocViewerReporter` — needed a non-HTTP entry point

**Key Design Choices:**
1. **Reuse over extraction** — `buildTestRun()` is a public method on the existing `LiveDocViewerReporter` class, reusing all private conversion methods. No code was duplicated or extracted into a separate utility — the class already owns the conversion logic.
2. **Alongside, not instead of** — JSON export happens after `executionEnd()` (console output + server publishing). Both paths can run simultaneously.
3. **Project/environment cascade** — publish config → export-level config → sensible defaults (CI env var detection).
4. **`crypto.randomUUID()`** — used for runId generation. Available in Node.js 16.7+, suitable for this project's minimum Node version.

**Impact:**
- `packages/vitest/_src/app/reporter/LiveDocViewerReporterV3.ts` — new `buildTestRun()` public method
- `packages/vitest/_src/app/reporter/LiveDocSpecReporter.ts` — `ExportConfig` interface, constructor parsing, `exportTestRunJson()` method

---

### JSON File Export from xUnit Reporter

**Author:** Simon  
**Date:** 2026-03-29  
**Status:** Implemented

**Decision:** Added `LIVEDOC_EXPORT_PATH` environment variable support to the .NET xUnit reporter. When set, the reporter writes a `TestRunV3`-compatible JSON file directly after test run completion — no server needed.

**Key Design Choices:**
1. **Export runs alongside server publishing** — `FlushCoreAsync` was refactored to build payloads first, then fire export and server publish concurrently. Neither blocks the other; both are independent output channels.
2. **`IsEnabled` broadened to include export** — `LiveDocTestRunReporter.IsEnabled` now returns true when either server or export path is configured. This ensures `LiveDocContext` and `LiveDocTestFramework` collect data even in server-less CI environments.
3. **Env var over config file** — `LIVEDOC_EXPORT_PATH` follows the existing pattern (`LIVEDOC_SERVER_URL`, `LIVEDOC_PROJECT`, `LIVEDOC_ENVIRONMENT`). Environment variables are simplest for CI pipelines.
4. **Reused existing `TestRunV3` model** — No new model classes. The `TestRunV3` in `ReporterModels.cs` already has the exact shape the viewer export command expects.

**Impact:**
- `dotnet/xunit/src/Reporter/LiveDocConfig.cs` — new `ExportPathEnvVar` constant and `ExportPath` property
- `dotnet/xunit/src/Reporter/LiveDocTestRunReporter.cs` — refactored `FlushCoreAsync`, added `PublishToServerAsync`, `ExportTestRunJsonAsync`

**Usage:**
```bash
# CI pipeline: export JSON for static HTML generation
LIVEDOC_EXPORT_PATH=./test-results/livedoc-report.json dotnet test

# Then generate static HTML
livedoc-viewer export -i ./test-results/livedoc-report.json -o report.html
```

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
