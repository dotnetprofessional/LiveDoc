# Project Context

- **Owner:** Garry
- **Project:** LiveDoc — a living documentation framework that generates documentation from executable BDD specifications. Monorepo spanning TypeScript (Vitest) and .NET (xUnit).
- **Stack:** React 19.2.3, Tailwind CSS 4.1, Radix UI (collapsible, dialog, dropdown, progress, scroll-area, tabs, tooltip), Zustand 5.0, Framer Motion 12, Vite 6.4, Lucide React icons, React Markdown, clsx, tailwind-merge, class-variance-authority
- **My Domain:** packages/viewer/ — real-time BDD test dashboard with WebSocket updates, multi-view UI, test history, project management
- **Created:** 2026-03-22

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **shadcn Dialog pattern**: Created `ui/dialog.tsx` wrapping `@radix-ui/react-dialog` following the same forwardRef + cn() pattern as button.tsx and tabs.tsx. Standard exports: Dialog, DialogContent, DialogOverlay, DialogTitle, DialogClose, DialogPortal, DialogHeader, DialogFooter, DialogDescription.
- **ImageLightbox**: Built at `components/ImageLightbox.tsx` — uses Radix Dialog primitives directly (not the shadcn wrapper) because the lightbox needs custom full-viewport overlay layout with Framer Motion animations. Accepts `images[]` with base64/uri sources, supports multi-image nav (arrows + keyboard), counter badge, and accessible title.
- **Attachment type**: `Attachment` from `@swedevtools/livedoc-schema` has `kind: 'image' | 'screenshot' | 'file'`, with `base64?` and `uri?` for data sources. Filter on `kind === 'image' || kind === 'screenshot'` for image attachments. Available on `step.execution?.attachments`.
- **StepItem screenshot icon**: Camera icon (Lucide) placed in the title row between title text and duration badge. Shows count badge when > 1 image. Opens ImageLightbox on click.

### Team Updates (2026-03-22)

**Wash's Attachment API**: StepContext now has `attach()` / `attachScreenshot()` methods plus `attachments` getter. Uses shared-array reference pattern — no post-execution copy. Reporter automatically includes attachments in ExecutionResult. ID generation via simple `att-{timestamp}-{counter}` scheme.

**Simon's .NET Attachment API**: FeatureTest and SpecificationTest both inherit `Attach()`, `AttachScreenshot()`, `AttachFile()` from LiveDocTestBase. Attachments collected per-step, transferred to `StepExecution.Attachments` on completion. Reporter models use JSON property names that match TypeScript schema.
