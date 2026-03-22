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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
