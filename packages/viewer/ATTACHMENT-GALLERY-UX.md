# Scenario-Level Attachment Gallery — UX Design Brainstorm

> **Author:** Kaylee (Frontend)  
> **Date:** 2025-07-25  
> **Status:** Design Exploration  
> **Stakeholder:** Garry (PM / Project Owner)

---

## The Core Insight

A BDD scenario with Playwright screenshots tells a **visual story** — the user journey as the test experienced it. Today, a PM has to click into each step individually to see one frame of that story. That's like watching a movie one frame at a time by opening separate files. The scenario gallery turns those isolated snapshots into a **narrative filmstrip** — a single, continuous visual flow.

The metaphor is a **cinematic director's reel**: each screenshot is a frame in a sequence, each step title is a scene card, and the scenario title is the film's name.

---

## 1. Scenario-Level Gallery Icon — Placement & Behavior

### Recommended: Header-Integrated Gallery Button

**Where:** In the `ScenarioBlock` header row, between the status badge and the scenario title — or right-aligned next to the StatusBadge. This mirrors how the step-level icon sits in the StepItem title row.

```
┌─────────────────────────────────────────────────────┐
│ ✅  Scenario: User completes checkout    [📸 12] ▶  │
│                                                     │
│  Given  the user has items in cart                   │
│  When   the user clicks checkout           📷       │
│  Then   the confirmation page is shown     📷 3     │
└─────────────────────────────────────────────────────┘
```

**Icon Design:**
- **Primary choice: `Images` (Lucide)** — the multi-image/gallery grid icon. Visually distinct from the single-frame `Camera` on steps.
- **Fallback: `GalleryHorizontalEnd`** — filmstrip-style icon, connotes sequence/slideshow.
- When all attachments are images/screenshots: `Images` icon
- When mixed types: `FolderOpen` or `Archive` icon
- **Count badge** always shown: `12` in a small pill badge beside the icon — critical for discoverability. A PM seeing "12 📸" immediately knows there's visual content to review.

**Visual Differentiation from Step Icons:**
- Step icons: small (3.5px), muted, inline with text — `text-muted-foreground/50`
- Scenario icon: slightly larger (4-4.5px), uses `text-primary/70` with hover → `text-primary` — signals it's a higher-level action
- Subtle background pill on hover: `bg-primary/5 rounded-full px-2 py-0.5` — gives it "button" affordance without cluttering the header

**Behavior:**
- Click opens the Scenario Gallery (a variant of AttachmentViewer)
- Tooltip on hover: *"View all 12 attachments across this scenario"*
- **No icon shown** when scenario has 0 attachments (clean, no dead icons)

### Alternative A: Action Bar Dropdown

A small `⋯` menu in the scenario header that includes "📸 View Gallery (12)" alongside other future actions (permalink, export, etc.). More extensible, but buries the gallery behind an extra click — bad for the "wow" moment.

### Alternative B: Hover-Reveal Overlay

A subtle semi-transparent strip of thumbnails that fades in along the bottom of the scenario block when the user hovers over the scenario header. Very cinematic, very "wow" — but may conflict with step interactions and has accessibility concerns (hover-only = no keyboard/touch support).

---

## 2. Gallery Navigation UX

### Recommended: Step-Grouped Film Strip with Flat Navigation

The key tension: **grouped by step** (contextual, structured) vs. **flat list** (simple, fast). The answer is **both**: group visually, navigate flatly.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│  Gallery: User completes checkout           3/12  [✕]   │
│  ──────────────────────────────────────────────────────   │
│  Step 2 of 5: When the user clicks checkout     ✅       │
│                                                          │
│              ┌─────────────────────┐                     │
│    ◀         │                     │         ▶           │
│              │    [Screenshot]     │                     │
│              │                     │                     │
│              └─────────────────────┘                     │
│                                                          │
│  ┌──┬──┬──┐  ┌──┬[==]┬──┐  ┌──┬──┬──┬──┬──┐  ┌──┐      │
│  │  │  │  │  │  │ ▪▪ │  │  │  │  │  │  │  │  │  │      │
│  └──┴──┴──┘  └──┴────┴──┘  └──┴──┴──┴──┴──┘  └──┘      │
│  Given...    When...        Then...            And...     │
│  Step 1      Step 2         Step 3             Step 4    │
└──────────────────────────────────────────────────────────┘
```

**Film Strip Design (evolution of existing FilmStrip):**
- Thumbnails are arranged left-to-right in chronological order
- **Step dividers**: thin vertical line + step label between groups — `border-l border-white/10` with a tiny rotated label
- **Active group highlight**: the step group containing the current attachment gets a subtle `bg-white/[0.03]` background
- Arrow keys navigate flatly (left/right through ALL attachments, crossing step boundaries seamlessly)
- Click any thumbnail to jump directly

**Step Context Bar (above the content area):**
- Shows the current step's keyword + title: *"When the user clicks checkout"*
- Step status icon (✅/❌) — so the PM sees pass/fail alongside the screenshot
- Step number: *"Step 2 of 5"* — orientation in the scenario
- **Animated transition** when crossing a step boundary: the context bar slides/fades to the new step title, creating a "scene change" feel

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next attachment |
| `Home` / `End` | First / Last attachment |
| `[` / `]` | Previous / Next **step group** (jump to first attachment of adjacent step) |
| `Space` | Toggle auto-play |
| `Escape` | Close gallery |
| `F` or `F11` | Toggle fullscreen (browser) |

### Alternative: Sidebar Timeline

A vertical timeline on the left showing step titles with thumbnail previews, scrollable. Content area takes the right 75%. More "storyboard" than "filmstrip." Works well for >20 screenshots but uses more horizontal space.

---

## 3. Slideshow / Auto-Play Mode

### Recommended: Play Button in Header Bar

**Entry point:** A `Play` (▶) icon button in the gallery header bar, next to the counter. Clicking starts auto-advance.

**Auto-Play Behavior:**
- Default interval: **3 seconds** per image (ideal for PM reviews)
- Speed adjustment: gear icon opens a small popover with speed presets: `1s` / `2s` / `3s` / `5s`
- **Pause on hover**: moving the mouse pauses auto-play (shows play/pause toggle)
- **Step boundary pause**: when crossing from one step's attachments to the next, hold for an extra 1s and animate the step context bar — creates a natural "scene break"
- **Loop or stop**: reaches the end → subtle "Replay?" prompt rather than infinite loop
- **Progress bar**: thin horizontal bar at the very bottom of the content area, showing segment progress (like YouTube). Fills left-to-right per attachment, then resets for the next.

**Visual Treatment:**
- During auto-play, the film strip auto-scrolls to keep the active thumbnail centered
- Nav arrows fade to 30% opacity during auto-play (still clickable, but visually deferred)
- Step context transitions use a cinematic **fade-through-black** (opacity 1 → 0 → 1) when crossing step boundaries — makes it feel like chapters

**Controls Overlay (appears on hover during auto-play):**

```
          ⏸  ⏪  ⏩     Speed: [3s ▾]
```

### Alternative: No auto-play, just keyboard-driven rapid navigation

Some users may prefer manual control. The `Space` shortcut could simply advance to the next attachment (tap-tap-tap rhythm), without a continuous auto-play timer. Lighter implementation, but less "wow."

---

## 4. Visual Storytelling

This is the heart of the feature. The gallery isn't just a media viewer — it's a **test execution narrative**.

### Step Title Overlay on Screenshots

When viewing an image attachment, overlay the step title at the bottom of the screenshot in a frosted-glass bar:

```
┌──────────────────────────────────┐
│                                  │
│          [Screenshot]            │
│                                  │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░  ✅ When the user clicks      ░ │
│ ░     checkout                  ░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────┘
```

**Design:**
- `bg-black/50 backdrop-blur-md` — glassmorphic, doesn't obscure the screenshot
- Step keyword colorized (Given=blue, When=amber, Then=green) — matches StepList colors
- Status icon (✅/❌) inline
- **Toggleable**: user can press `T` to hide/show title overlay (some screenshots need full visibility)

### Progress Timeline

A thin horizontal progress indicator at the top of the gallery, showing the user's position in the story:

```
  ●───────●────●──────────●───────●────●
 Given    When  Then      And     Then
 (3)      (2)   (5)       (1)     (1)
```

- Each dot represents a step with attachments
- Dot size reflects attachment count (larger dot = more attachments)
- Active segment is highlighted in `sky-400`
- Passed steps: green segments. Failed steps: red segments.
- Clickable — jump to the first attachment of any step

### Pass/Fail Visual Treatment

- **Passed steps**: Screenshot border-bottom has a thin `bg-pass` (green) glow — `shadow-[0_4px_20px_rgba(34,197,94,0.15)]`
- **Failed steps**: Red glow — `shadow-[0_4px_20px_rgba(239,68,68,0.2)]` + the error message briefly shown in the step context bar
- **Pending steps**: Amber pulse — subtle `animate-pulse` on the step context bar
- This gives the PM an instant visual sense of where things went wrong without reading anything

### Transition Design Between Screenshots

- **Same step**: Quick slide (current `slideVariants` — 80px, 280ms)
- **Crossing step boundary**: **Cross-fade** with a brief 100ms black gap — like a film scene transition. The step context bar animates simultaneously.
- **Auto-play crossing step boundary**: Slightly longer transition (400ms) with the step title briefly shown centered before the next screenshot loads — a "chapter card" moment

---

## 5. Interaction Patterns

### Gallery ↔ Step-Level Viewer Interaction

**Entering from step icon:**
- When a user clicks a step-level attachment icon (Camera/Paperclip), it should open the **same** gallery viewer but with `initialIndex` set to that step's first attachment and a visual cue indicating "You're viewing Step 3's attachments"
- A new prop on AttachmentViewer: `scenarioContext?: { steps: StepTest[], currentStepIndex: number }` — enables the gallery to know about step groupings
- The user can then navigate beyond that step's attachments into the full scenario gallery — the film strip shows all attachments, and the step dividers make it clear they've moved to a different step
- **This unifies the two entry points** — there's really one gallery, entered either at scenario level (start at beginning) or step level (start at that step)

### Pinch-to-Zoom on Screenshots

- On image attachments, support **scroll-wheel zoom** (desktop) and **pinch-to-zoom** (touch)
- Double-click to toggle between fit-to-view and 100% zoom
- When zoomed in, click-and-drag to pan
- Implementation: CSS `transform: scale()` + `translate()` with pointer event handlers
- Zoom state resets when navigating to next attachment

### Fullscreen Mode

- `F` key or a small `Maximize2` icon in the header bar
- Uses the browser `requestFullscreen()` API
- In fullscreen, the header bar auto-hides after 2s of no mouse movement (reappears on hover)
- Film strip remains visible but more compact (thumbnails shrink to 10×10)
- Perfect for presentations / screen-sharing

### Share / Export

**Phase 2 feature** (not MVP, but worth designing for):
- "Export as PDF" — generates a PDF with one screenshot per page, step title as header
- "Copy shareable link" — deep link to this scenario's gallery view (requires URL routing)
- "Download all" — zip all attachments with step-labeled filenames

---

## 6. Feature-Level Gallery

### Recommendation: Yes, but opt-in and clearly distinct

A Feature may have 5 scenarios × 10 screenshots = 50+ attachments. A flat gallery of 50 screenshots would be overwhelming. But with the right structure, it becomes a **test suite visual summary**.

**Feature Gallery Design:**
- Opens from a gallery icon in the Feature header (same pattern as scenario)
- **Two-level grouping**: Scenario → Step
- Film strip shows scenario dividers (more prominent than step dividers — different color, scenario title label)
- **Chapter navigation**: scenario titles in the progress timeline, clickable
- Default: start with the **first failed scenario** if any failures exist (PM workflow: "show me what broke")

**When it's useful:**
- Regression review: PM wants to see all screenshots across all scenarios for a feature
- Demo preparation: walking through a feature's full flow with stakeholders
- Bug investigation: comparing screenshots across related scenarios

**When it's too much:**
- Very large features (100+ attachments) → offer a "filter by scenario" dropdown in the gallery header
- Lazy-load thumbnails; only decode base64 for visible images

---

## 7. Edge Cases

### Scenarios with 0 Attachments
- No gallery icon shown. Simple. No dead affordances.

### Mixed Attachment Types (Screenshots + JSON + Files)
- All attachment types are included in the gallery — the existing AttachmentViewer sub-renderers (ImageRenderer, JsonRenderer, TextRenderer, BinaryFallback) already handle this.
- Film strip uses the ThumbnailIcon component — images get preview thumbnails, JSON/text/binary get icon+label thumbnails (already implemented).
- The step context bar helps: *"Step 3: Then the API returns the user profile"* + JSON viewer makes sense together.

### Scenario Outlines with Examples

This is the most complex edge case. Options:

**Option A (Recommended): Gallery per example row**
- When viewing an OutlineNodeView and clicking a specific example row, the gallery shows attachments for **that row's execution only**
- The gallery icon appears per-row in the examples table (small camera icon in the row)
- This matches the existing interaction model: click row → see that row's results

**Option B: Merged gallery across all example rows**
- A single gallery icon at the outline level showing ALL attachments across ALL rows
- Step context shows: *"Step 2, Row 3: When the user logs in as 'admin'"*
- Good for comparing screenshots across rows (e.g., "does the login page look different for admin vs. user?")
- Could be overwhelming for large outlines (20 rows × 5 screenshots = 100 attachments)

**Recommendation:** Start with **Option A** (per-row), add **Option B** as an advanced toggle later.

### Very Large Galleries (50+ Screenshots)

**Performance strategy:**
- **Lazy decode**: Only base64-decode the current image + 2 adjacent (preload buffer). Film strip thumbnails are small and can use a lower-quality decode.
- **Virtualized film strip**: For 50+ thumbnails, virtualize the horizontal scroll (only render visible thumbnails + buffer). Use `IntersectionObserver` or a lightweight virtualizer.
- **Skeleton loading**: Show a shimmer placeholder while decoding base64 → image
- **Memory management**: Release decoded image URLs (`URL.revokeObjectURL`) when moving away from an image (keep a window of ±3)

---

## 8. Delight Factors — The "Wow" Moment

### First Open: Cinematic Entry

When the gallery first opens, don't just pop in — **choreograph it**:

1. Overlay fades in (200ms)
2. First screenshot scales up from 0.85 → 1.0 with a subtle spring (300ms)
3. Step context bar slides down from above (150ms delay)
4. Film strip rises up from below (200ms delay)
5. A brief shimmer/glow on the first thumbnail in the strip

This staggered reveal creates a "curtain rising" moment. Total time: ~500ms. Feels intentional, not sluggish.

### Step Boundary "Scene Change"

The moment the user navigates from one step's last attachment to the next step's first attachment:
- A brief **ripple effect** radiates from the center
- The step context bar smoothly transitions with a color accent matching the new step keyword
- The progress timeline dot "lights up" with a subtle scale-bounce

### "Replay" Ending

When auto-play reaches the last attachment:
- The screenshot gently scales down to 0.95
- The step title overlay shows: *"✅ Scenario passed — 12 screenshots reviewed"*
- A "Replay" button fades in at center, styled as a glassmorphic circle with a ↻ icon
- This makes the PM feel like they've **completed** something, not just run out of slides

### Keyboard Shortcut Discovery

On first gallery open (per session), show a subtle toast at bottom-right:
> *"Pro tip: Use ← → to navigate, Space to auto-play"*

Fades out after 4s. Only shown once.

### Smart Default Index

When opening a **failed** scenario's gallery, default to the first attachment of the **failed step** — the PM almost certainly wants to see what went wrong, not re-watch the happy path.

---

## Recommended Approach — Summary

### MVP (Phase 1)
1. **Scenario gallery icon** in ScenarioBlock header with count badge
2. **Reuse AttachmentViewer** with new props: `scenarioContext` for step groupings
3. **Step-grouped film strip** with step labels/dividers
4. **Step context bar** above the content area
5. **Unified entry**: step icon opens same gallery at that step's position
6. **Keyboard navigation** including `[`/`]` for step-jumping

### Phase 2
7. **Auto-play mode** with speed control and step-boundary pauses
8. **Progress timeline** with pass/fail coloring
9. **Step title overlay** on screenshots (toggleable)
10. **Feature-level gallery** with scenario grouping

### Phase 3
11. **Outline per-row gallery** + merged toggle
12. **Export to PDF**
13. **Fullscreen mode**
14. **Pinch-to-zoom**

---

## Rough Interaction Flow

```
USER clicks [📸 12] icon on Scenario header
  → Gallery opens (cinematic entry animation)
  → Shows first attachment with step context: "Step 1: Given the user is on the home page"
  → Film strip at bottom shows all 12 thumbnails, grouped by step

USER presses → arrow
  → Slides to next attachment (within same step: quick slide)
  → Film strip highlight moves

USER presses → arrow (last attachment of Step 1)
  → Crosses step boundary → "scene change" transition
  → Step context updates: "Step 2: When the user clicks login"
  → Progress timeline advances

USER presses ] (bracket)
  → Jumps to first attachment of next step

USER presses Space
  → Auto-play begins, 3s per image
  → Progress bar fills at bottom
  → Step boundary: extra 1s pause, title card flash

USER presses Space again
  → Auto-play pauses

USER clicks step-level 📷 icon on Step 3
  → Gallery opens at Step 3's first attachment
  → Full film strip visible — can navigate to other steps

USER presses Escape
  → Gallery closes with reverse animation
```

---

## Open Questions for the Team

1. **Should the scenario gallery icon be visible in the `ChildrenList` cards?** (i.e., before the user even navigates into a scenario, they can see "📸 8" on the card and click to open the gallery). This would require aggregating attachment counts up to the container level.

2. **Step-level icons: keep or remove once gallery exists?** Keeping both provides two entry points (good for discoverability). Removing step icons reduces clutter. Recommended: keep both, unify to the same viewer.

3. **Auto-play: should it show a progress bar per-image or per-scenario?** Per-image is more granular. Per-scenario is simpler. Could offer both via the progress timeline.

4. **Outline examples: should the examples table show a mini-gallery preview** (e.g., first screenshot as a tiny thumbnail in the table row)? This would make it immediately visual without clicking.

5. **Memory budget**: For scenarios with 50+ base64-encoded screenshots, what's the acceptable memory footprint? Should we implement server-side thumbnail generation, or is lazy client-side decode sufficient?

6. **Mobile / touch**: Is the viewer used on mobile? If so, we need swipe gestures for navigation and a bottom-sheet film strip instead of side arrows.

---

## Technical Notes

### Component Architecture

```
ScenarioBlock (existing)
├── adds: GalleryButton (new) — icon + count badge + click handler
└── ...

ScenarioGallery (new wrapper component)
├── collects all attachments from all steps in scenario
├── maps each attachment to its source step (index, title, keyword, status)
├── passes grouped data to AttachmentViewer via new scenarioContext prop
└── AttachmentViewer (enhanced)
    ├── StepContextBar (new sub-component)
    ├── HeaderBar (existing, enhanced with play controls)
    ├── ProgressTimeline (new sub-component)
    ├── FilmStrip (existing, enhanced with step dividers)
    ├── NavArrow (existing)
    └── Content renderers (existing, unchanged)
```

### Data Flow

```typescript
// Collect all attachments across steps with source context
interface GalleryItem extends AttachmentItem {
  stepIndex: number;
  stepKeyword: string;
  stepTitle: string;
  stepStatus: Status;
}

// Group for film strip rendering
interface StepGroup {
  stepIndex: number;
  keyword: string;
  title: string;
  status: Status;
  attachments: GalleryItem[];
  startIndex: number; // flat index of first attachment in this group
}
```

This extends the existing `AttachmentItem` interface without breaking it — existing step-level usage passes plain `AttachmentItem[]`, new scenario-level usage passes `GalleryItem[]`.

---

*This document is a design exploration. Implementation decisions should be validated with prototypes and user feedback.*
