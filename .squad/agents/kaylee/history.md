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
- **AttachmentViewer**: Refactored ImageLightbox → AttachmentViewer at `components/AttachmentViewer.tsx`. Now a general-purpose MIME-type-aware viewer: images (Framer Motion animated img), JSON (syntax-highlighted with custom tokenizer + copy button), text/* (monospace pre + copy), binary fallback (metadata card + download). ImageLightbox.tsx kept as backward-compat re-export. StepList now shows all attachments (not just images) with context-aware icon: Camera when all are images/screenshots, Paperclip otherwise. Base64 decoding uses atob + TextDecoder for proper UTF-8.
- **AttachmentViewer Redesign (Cinematic Lightbox)**: Major UI overhaul of AttachmentViewer. Now features: (1) **Header bar** with gradient fade — shows title, MIME badge, counter (2/5), and close button; (2) **Film strip** — horizontal thumbnail strip at bottom with image previews for images and icon+label for JSON/text/binary, active item highlighted with sky-400 ring + glow, auto-scrolls active into view; (3) **Direction-aware slide animations** — content slides left/right based on navigation direction using Framer Motion custom variants; (4) **Polished nav arrows** — rounded glassmorphic buttons with backdrop blur, scale-on-hover; (5) **Backdrop click dismiss** preserved on content area and top-level container. Architecture: decomposed into HeaderBar, NavArrow, FilmStrip, ThumbnailIcon sub-components. All sub-renderers now accept `direction` prop for custom animation variants. Layout uses flex-col with absolute header overlay, centered content area, and bottom-anchored film strip.

### Team Updates (2026-03-22)

**Wash's Attachment API**: StepContext now has `attach()` / `attachScreenshot()` methods plus `attachments` getter. Uses shared-array reference pattern — no post-execution copy. Reporter automatically includes attachments in ExecutionResult. ID generation via simple `att-{timestamp}-{counter}` scheme.

**Simon's .NET Attachment API**: FeatureTest and SpecificationTest both inherit `Attach()`, `AttachScreenshot()`, `AttachFile()` from LiveDocTestBase. Attachments collected per-step, transferred to `StepExecution.Attachments` on completion. Reporter models use JSON property names that match TypeScript schema.

### Team Updates (2026-03-22 — Multi-MIME Expansion)

**Wash's attachJSON (TypeScript)**: StepContext now offers `attachJSON(data: unknown, title?: string)` convenience method. Accepts objects/arrays/strings, pretty-prints with 2-space indent, dual-env base64 encoding (btoa + Buffer). Delegates to `attach()` with `mimeType: 'application/json'`, `kind: 'file'`.

**Simon's AttachJson (.NET)**: LiveDocTestBase now offers `AttachJson(object data, string? title = null)` convenience method. Accepts objects or pre-formatted JSON strings, uses System.Text.Json with WriteIndented, delegates to `Attach()` with matching MIME type and kind.

- **Scenario Gallery UX Design**: Completed deep-dive UX brainstorm for a scenario-level attachment gallery. Key design decisions: (1) Gallery icon in ScenarioBlock header with count badge using `Images` Lucide icon; (2) Step-grouped film strip with flat navigation and step dividers; (3) Step context bar showing current step keyword/title/status above content; (4) Unified entry — step-level and scenario-level icons open the same gallery at different positions; (5) Auto-play mode with step-boundary pauses for PM reviews; (6) Component architecture extends AttachmentViewer with `scenarioContext` prop and new `GalleryItem` type extending `AttachmentItem`. Design doc at `packages/viewer/ATTACHMENT-GALLERY-UX.md`.

### Scenario Gallery Implementation (2026-03-22)

**Gallery Utility (`utils/gallery.ts`)**: Created centralized gallery utilities with `GalleryItem` type (extends `AttachmentItem` with `stepIndex`, `stepKeyword`, `stepTitle`, `stepStatus`), `StepGroup` type for step-grouped navigation, `collectScenarioAttachments()` to aggregate attachments from all steps with step context, `groupByStep()` for organizing items, and navigation helpers `findGroupAtIndex()` and `jumpToAdjacentGroup()`. This architecture keeps gallery logic reusable and separate from UI components.

**Enhanced AttachmentViewer**: Added optional step context fields (`stepTitle`, `stepKeyword`, `stepStatus`, `stepIndex`) to `AttachmentItem` for backward compatibility. Implemented `StepContextBar` sub-component showing step number, keyword (colorized), title, and status icon. Added step-boundary crossing detection with cross-fade transitions (`stepCrossFadeVariants` with 400ms dim effect). Enhanced keyboard navigation: `[`/`]` for prev/next step, `Space` for auto-play toggle, `Home`/`End` for first/last. Built auto-play slideshow with 3s base interval + 1s step-boundary pause, progress bar, and "end of gallery" stop (no infinite loop). Enhanced `FilmStrip` with step dividers showing keyword labels and active group highlighting. All renderers (Image, JSON, Text, Binary) now accept `crossingStepBoundary` prop for scene transitions.

**ScenarioBlock Gallery Icon**: Added gallery button in scenario header showing total attachment count across all steps. Icon adapts: `Images` when all are images/screenshots, `Paperclip` for mixed content. Tooltip explains "View all N attachments across this scenario". Button opens gallery at the first attachment of the first failed step (smart default). Gallery only shown when `totalAttachments > 0`.

**Unified Entry from StepList**: Step-level attachment icons now open the scenario gallery at that step's position (not just that step's attachments). StepList receives `galleryItems` prop and calculates `initialIndexInGallery` for each step. This creates a seamless navigation experience — users can explore beyond a single step into the full scenario context without switching between different lightboxes.

### Scenario Gallery Implementation (2026-03-22)

**Gallery Utility (`utils/gallery.ts`)**: Created centralized gallery utilities with `GalleryItem` type (extends `AttachmentItem` with `stepIndex`, `stepKeyword`, `stepTitle`, `stepStatus`), `StepGroup` type for step-grouped navigation, `collectScenarioAttachments()` to aggregate attachments from all steps with step context, `groupByStep()` for organizing items, and navigation helpers `findGroupAtIndex()` and `jumpToAdjacentGroup()`. This architecture keeps gallery logic reusable and separate from UI components.

**Enhanced AttachmentViewer**: Added optional step context fields (`stepTitle`, `stepKeyword`, `stepStatus`, `stepIndex`) to `AttachmentItem` for backward compatibility. Implemented `StepContextBar` sub-component showing step number, keyword (colorized), title, and status icon. Added step-boundary crossing detection with cross-fade transitions (`stepCrossFadeVariants` with 400ms dim effect). Enhanced keyboard navigation: `[`/`]` for prev/next step, `Space` for auto-play toggle, `Home`/`End` for first/last. Built auto-play slideshow with 3s base interval + 1s step-boundary pause, progress bar, and "end of gallery" stop (no infinite loop). Enhanced `FilmStrip` with step dividers showing keyword labels and active group highlighting. All renderers (Image, JSON, Text, Binary) now accept `crossingStepBoundary` prop for scene transitions.

**ScenarioBlock Gallery Icon**: Added gallery button in scenario header showing total attachment count across all steps. Icon adapts: `Images` when all are images/screenshots, `Paperclip` for mixed content. Tooltip explains "View all N attachments across this scenario". Button opens gallery at the first attachment of the first failed step (smart default). Gallery only shown when `totalAttachments > 0`.

**Unified Entry from StepList**: Step-level attachment icons now open the scenario gallery at that step's position (not just that step's attachments). StepList receives `galleryItems` prop and calculates `initialIndexInGallery` for each step. This creates a seamless navigation experience — users can explore beyond a single step into the full scenario context without switching between different lightboxes.

**Cinematic Aesthetic**: Followed frontend-design skill guidance for a "director's reel" metaphor. Dark overlay (`bg-black/85 backdrop-blur-sm`), frosted glass step context bar (`bg-white/[0.03] backdrop-blur-md`), staggered gallery open animations (overlay → content scale 0.98→1.0 → context bar slide → filmstrip rise), step-boundary cross-fades with brief dim (`brightness(0.7)→1`), auto-play progress bar with linear fill. Professional, not flashy — designed for PMs and devs reviewing test runs.

### Search & Navigation Fixes (2025-07-18)

**Tag filter empty-folder UX (Bug 1)**: When a tag filter (e.g. `@attachments`) produces 0 results in the current GroupView folder, the viewer now computes global matches from `run.itemById` via `globalResultInfo` memo and renders up to 5 clickable result cards inline — each with status badge, kind label, and title. Replaces the old `globalMatchCount` approach that only offered a "go to root" link. Falls back to "No matching results." when there are truly zero global matches.

**Step navigation context (Bug 2)**: NodeView had no render path for `kind === 'step'` — clicking a Step search result showed only the Feature header + Background, with no Scenario or Steps visible. Fix adds a `parentScenario` memo that walks `containerTestCase.tests[].steps` to find the owning Scenario/Rule, then renders it via ScenarioBlock. Also modified the `children` derivation so that when viewing a Step, `children` resolves to `containerTestCase.tests` — enabling ChildrenList to show sibling Scenarios for navigation context. Background-step duplication is prevented by checking `parentScenario.id !== background?.id`.

### Scenario Navigation Fixes (2026-04-12)

**Breadcrumb empty-state bug**: Fixed ContainerHeader breadcrumb logic that was returning `null` when `crumbs.length === 0` after slicing for non-container pages, causing an empty breadcrumb to display (just "🏠 >" with nothing after). Now shows proper fallback (home icon only) when no navigable crumbs remain, ensuring breadcrumb nav is always visible.

**Scenario/Rule rendering conditions**: Removed overly strict parent-container checks (`feature &&` and `isSpecificationContainer &&`) from Scenario, Rule, ScenarioOutline, and RuleOutline rendering blocks in NodeView. These conditions were preventing proper rendering when navigating directly to these nodes or when the parent container lookup failed. Now all test node types render reliably based solely on their own `kind` field, making navigation more robust across different entry points (search results, direct links, etc.).

**Background scenario handling (critical fix)**: Fixed multiple issues caused by backgrounds having `kind: 'Scenario'` in the data, which made them indistinguishable from real scenarios:
1. Added background tree traversal to `containerTestCase` lookup's `containsId()` function — now properly finds the parent container when viewing background steps or scenarios
2. Changed background resolution to use `containerTestCase` instead of `feature` — works for all container types (Feature, Specification, Suite), not just Features
3. Added `isViewingBackground` detection to prevent double-rendering when navigating directly to a background ID (backgrounds have `kind: 'Scenario'` but should only render in the dedicated Background section, not as a regular Scenario)
4. Removed duplicate RuleOutline rendering block that was leftover from previous refactors

These changes ensure files with backgrounds render correctly — the coordinator identified that lastrun.json (3 docs with backgrounds) was broken while history files (0 docs with backgrounds) worked fine. Root cause was backgrounds being indexed in `itemById` with `kind: 'Scenario'`, interfering with parent/child navigation and causing breadcrumb/title rendering failures.

