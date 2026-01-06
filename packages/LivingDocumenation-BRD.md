# LiveDoc Viewer — BRD (Screen-by-screen)

**Document type:** Business Requirements Document (Viewer UX)  
**Applies to:** `@livedoc/viewer` (website + VS Code webview surface), backed by `@livedoc/server` + `@livedoc/schema`  
**Version:** 2.1  
**Last updated:** 2026-01-05  
**Status:** Living document

---

## Purpose

LiveDoc Viewer turns executable specifications and conventional tests into **living documentation** that is **business-friendly by default**, while still exposing enough evidence to debug failures.

This BRD is organized by screens so we can implement and validate each view incrementally.

Structure mocks: See [packages/viewer/docs/SCREEN_MOCKS.md](packages/viewer/docs/SCREEN_MOCKS.md).

Sync note: This BRD is the requirements source of truth; the screen mocks reflect the intended page structure and should be kept consistent with these requirements.

---

## Scope assumptions (current)

- The server supports **a single environment at a time**.
- The Viewer must still **identify the environment** clearly (e.g., `local`, `int`, `prod`) so multi-environment support can be added later without reworking the UI language.

---

## Supported patterns (three)

The Viewer must distinguish and render these patterns consistently across Navigation, Dashboard, and Detail views:

1. **BDD / Gherkin-style**
  - Typical structure: Feature → (Background?) → Scenario | ScenarioOutline → Steps
2. **Specification-style**
  - Typical structure: Specification → Rule → Example/Test
3. **Conventional test suites**
  - Typical structure: Suite/Describe → Test/It

**Rule:** The UI must be explicit about pattern and node kind (icon + label), without exposing schema-specific jargon.

**Rule:** Features do **not** contain Rules. Rules are a Specification concept.

---

## Global UX requirements (applies to every screen)

### Business-friendly by default

- The Viewer should default to readable, stakeholder-friendly output (no walls of stacks, no micro-timings dominating the page).
- Technical detail is allowed, but must be **progressively disclosed** (expanders), not a separate mode that could fragment conversation.

### Status semantics

- Statuses must be consistent: `passed`, `failed`, `pending`, `skipped` (and optionally `unknown`).
- Status must never be color-only; always include an icon and/or label.
- Parent nodes show roll-up status derived from children.

### Evidence context

- Every content view must clearly state:
  - environment
  - last verified timestamp
  - duration (when available)

### Tags (known tags)

- Tags are known/normalized and should render as pills.
- Any text filter that supports tags should provide `@tag` autocomplete.
  - Typing `@` opens tag suggestions.
  - Selecting a tag inserts a pill/token.

---

## Navigation (Left Nav)

### Purpose

Navigation is the discovery and drill-down surface. It must:

- show how tests are organized
- show health at a glance
- enable fast navigation to the right container

### Requirements

#### 1) Single environment identity

- The left nav must display the environment label (e.g., `local`, `int`, `prod`).
- The environment label must be visible even if the server only supports one environment today.

#### 2) Run-in-progress indicator

- If a run is in progress, show a clear indicator (e.g., Running + spinner) in the nav header area.
- During a run, counts and statuses should be treated as incremental (best-effort).

#### 3) Nested groups (depth + stop point)

- Navigation must support arbitrary depth of **containers** (group/folder/describe/suite containers).
- The nav must stop at the **container level**.
  - It must not show Given/When/Then steps.
  - It must not show ScenarioOutline example rows.
  - Leaf tests are accessed from the container page list (in the content area), not expanded in the nav.

#### 4) Pattern distinction

- Containers must be visually distinct:
  - Group containers
  - Feature containers
  - Specification containers
  - Suite containers

#### 5) Filter/search behavior

- The nav filter should support:
  - text match against titles
  - `@tag` token filtering

---

## Dashboard

### Purpose

The Dashboard is the run's front page. It answers:

- whats the overall state?
- how is the suite organized?
- where are problems concentrated?

### Requirements

#### 1) Run summary

- Display:
  - overall status
  - pass/fail/pending/skipped counts
  - total duration
  - environment label

#### 2) Organization / grouping health

- If tests are well organized, the Dashboard must surface the top-level groupings and their roll-up status.
  - Example groupings (domain-oriented):
    - Billing → Accounts Payable
    - Billing → Accounts Receivable
    - Ordering → Checkout
    - Ordering → Fulfillment
- This should make it obvious when a test suite is poorly organized (e.g., everything dumped into one bucket).

#### 3) Entry points

- Provide entry points (quick links) that take the user into the most useful next view:
  - open a top-level container
  - view only failing tests
  - jump to the most recent failure(s)

---

## Feature / Specification / Suite view (container pages)

### Purpose

These are container pages selected from the left nav. The container page lists all leaf tests within that container.

### Common requirements (all containers)

- Must show:
  - title + optional description
  - roll-up status
  - tags (pills)
  - evidence context (environment, last verified)

- Must show a **list of contained tests** (leaf items) with:
  - title
  - status
  - kind label (Scenario, ScenarioOutline, Rule, Test)
  - optional duration

- The list should support:
  - text filtering
  - `@tag` filtering

### Feature container specifics

- A Feature contains:
  - Scenarios
  - ScenarioOutlines
  - optional Background (context)
- A Feature does not contain Rules.

### Specification container specifics

- A Specification contains Rules.
- Selecting a Rule is a leaf-test experience (Rule behaves like a single test detail).

### Suite container specifics

- A Suite contains nested suites and tests.
- The container page should list only the leaf tests for the current container (and/or allow drilling into nested containers), but the nav remains container-only.

---

## Test Single (Scenario / Rule / Test)

### Purpose

This is the leaf test detail page: what it proves, what ran, and what failed.

### Requirements

- Must show:
  - title
  - status
  - tags
  - evidence context (environment, last verified)
  - duration (if available)

- Must include Background context (if applicable) in the same page.

- Must show the execution narrative:
  - Scenario: Given/When/Then step list
  - Rule (spec): the rule's narrative/steps/events (as provided)
  - Suite test: assertion/failure summary and any recorded steps/events

### Binding / dynamic values

- If bindings exist, the Viewer should show bound values directly (inline) so the test reads as a concrete story.
- An optional disclosure may show raw binding data for debugging, but it is not required for the basic (business-friendly) read.

### Errors

- When failed:
  - show a concise failure summary first
  - stack trace/details must be collapsed by default and expandable

---

## Test Outlines (Scenario Outline)

### Purpose

An Outline appears once in the container list, but represents multiple example executions.

### Requirements

#### 1) Single outline page

- Clicking an Outline opens one page that represents:
  - optional Background context
  - the outline's description
  - the outline template narrative

#### 2) Example table

- Render examples in a table:
  - headers from the example keys
  - one row per example
  - each row shows pass/fail status (and optional duration)

#### 3) Template ↔ bound value toggle

- The outline narrative starts as a template (placeholders).
- Selecting a row applies that row's values into the narrative.
- Selecting the same row again returns to template view.

#### 4) Row-scoped errors

- Failures/errors are scoped to the selected row:
  - if a row is selected, show only that row's failure details below the narrative
  - if no row is selected, do not show a long list of errors

---

## Out-of-scope (for this BRD revision)

- Comments/review workflow
- Requirement mapping to external systems (Jira/Azure DevOps)
- Export/print (PDF/HTML)
- Public website deep-links (URL routing)
