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

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
