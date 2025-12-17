# @livedoc/vitest — Documentation Execution Plan

> Goal: ship a comprehensive, developer-friendly markdown doc set for `@livedoc/vitest`, stored in `packages/vitest/docs/` and linked from `packages/vitest/README.md`.
>
> Notes
> - The Mocha implementation is deprecated but remains available for reference at `_archive/livedoc-mocha`.
> - The recommended authoring API is **lowercase** `given/when/then/and/but`.
>   - **Imports mode:** use `Then` export aliased as `then` to avoid the ESM "thenable" issue.
>   - **Globals mode:** enable `globals` and `setupFiles: ['@livedoc/vitest/setup']` so a lowercase global `then` is available.

---

## Phase 0 — Decisions & alignment ✅

- [x] Canonical authoring style is lowercase keywords.
- [x] Provide **two setup paths**:
  - [x] Imports mode (alias `Then as then`)
  - [x] Globals mode (Vitest config + setup file)
- [x] Docs live under `packages/vitest/docs/`.
- [x] Mocha docs are deprecated; link to `_archive/livedoc-mocha`.
- [x] Provide an **AI-friendly setup guide** (high-detail, config-oriented) for correct reporter configuration.
- [x] Ensure docs cover both BDD (`feature/scenario/...`) and Specification (`specification/rule/...`) patterns.
- [x] Filtering docs must include **Vitest configuration** details.
- [x] Include an **Architecture** section for contributors.

---

## Deliverables

### Documentation pages ✅

- [x] `packages/vitest/docs/index.md` — doc hub / navigation
- [x] `packages/vitest/docs/getting-started.md` — 5-minute quick start
- [x] `packages/vitest/docs/setup-imports.md` — explicit imports setup (alias `Then as then`)
- [x] `packages/vitest/docs/setup-globals.md` — globals setup (`globals` + `@livedoc/vitest/setup`)
- [x] `packages/vitest/docs/ai-setup-guide.md` — AI-targeted config + reporter options
- [x] `packages/vitest/docs/authoring-bdd.md` — feature/scenario/background/scenarioOutline + steps
- [x] `packages/vitest/docs/authoring-specification.md` — specification/rule/ruleOutline
- [x] `packages/vitest/docs/data-extraction.md` — `ctx.step.values`, tables, doc strings
- [x] `packages/vitest/docs/tags-and-filtering.md` — tags, include/exclude, Vitest config
- [x] `packages/vitest/docs/reporting.md` — reporters, outputs, VS Code caveats
- [x] `packages/vitest/docs/troubleshooting.md` — common pitfalls (thenable, reporter conflicts, etc.)
- [x] `packages/vitest/docs/architecture.md` — internals overview (how it works)
- [x] `packages/vitest/docs/contributing.md` — package-level contributor guide

### README updates ✅

- [x] Update `packages/vitest/README.md`:
  - [x] Replace outdated examples (`Given/When/Then`) with the canonical lowercase style.
  - [x] Add "Docs" section linking to all pages above.
  - [x] Add "Mocha (deprecated)" note with link to `_archive/livedoc-mocha`.

---

## Acceptance criteria

- [x] A new OSS user can:
  - [x] install `@livedoc/vitest`
  - [x] choose setup mode (imports or globals)
  - [x] run `vitest` and see LiveDoc output
  - [x] understand how tags/filtering works and configure it
- [x] All snippets match the **actual** exported API:
  - [x] Imports mode shows `import { feature, scenario, given, when, Then as then, and, but } from '@livedoc/vitest'`
  - [x] Globals mode shows `setupFiles: ['@livedoc/vitest/setup']` and `globals: true`
- [x] Reporter configuration docs match shipped reporter options and known VS Code constraints.
- [x] Docs cover both BDD and Specification patterns.
- [x] At least one page exists that is **AI-oriented** (verbose, explicit config matrices and copy/paste blocks).
- [x] Architecture page exists and is linked from README.

---

## Work breakdown

### Step 1 — Source audit ✅

- [x] Confirm public exports and correct usage patterns (`Then` export, setup file globals)
- [x] Confirm filtering configuration points (where filters are set, env vars, config examples)
- [x] Confirm reporter option surface area (detailLevel flags, outputs, post-reporters)

### Step 2 — Add docs skeleton ✅

- [x] Create `docs/index.md` and the page placeholders listed above
- [x] Write "Getting Started" + both setup modes first

### Step 3 — Authoring guides ✅

- [x] BDD authoring guide
- [x] Specification/rule authoring guide
- [x] Data extraction guide

### Step 4 — Reporting + filtering ✅

- [x] Reporting guide (including VS Code extension caveats)
- [x] Tags/filtering guide with the required Vitest configuration examples

### Step 5 — Contributor docs ✅

- [x] Architecture overview
- [x] Contributing guide

### Step 6 — Link sanity ✅

- [x] Update README with docs section and deprecation notice
- [x] Ensure docs cross-link correctly
- [x] Ensure deprecated Mocha link mentioned in docs

---

## Resolved questions

- [x] Tag filters are configured via `livedoc.options.filters` — recommended in a setup file
- [x] Public reporter options documented: `detailLevel`, `output`, `postReporters`, `colors`
