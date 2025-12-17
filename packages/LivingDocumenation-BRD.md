
# LiveDoc — Unified Living Documentation BRD & Delivery Backlog

**Document type:** Business Requirements Document (BRD) + delivery backlog + progress tracker  
**Applies to:** `@livedoc/server`, `@livedoc/vitest`, `@livedoc/viewer` (website), `@livedoc/vscode` (VS Code extension)  
**Version:** 1.0  
**Last updated:** 2025-12-12  
**Status:** Living document

---

## 0. How to use this document

This file is the unified BRD for the **end-to-end Living Documentation system** (Server + Reporters + Viewer website + VS Code extension).

Use it to:

- Align **stakeholders + engineering** on what “Living Documentation” means in LiveDoc.
- Define **shared requirements** (must work the same everywhere).
- Define **component-specific requirements** (website vs extension).
- Track **progress** and **gaps** with clear statuses.

### Status key

- ✅ **Done**: implemented in the repo and functionally usable.
- ⚠️ **Partial**: implemented but missing important acceptance criteria or has known issues.
- 🔁 **Needs revision**: implemented, but conflicts with updated requirements in this BRD.
- ⏳ **Planned**: not implemented.

### Source-of-truth references in this repo

- Viewer BRD/backlog (existing): `packages/viewer/docs/BRD.md`, `packages/viewer/docs/BACKLOG.md`
- VS Code backlog (existing): `packages/vscode/BACKLOG.md`
- Shared server: `packages/server/src/*`
- VS Code server + UI integration: `packages/vscode/src/*`
- Vitest reporting: `packages/vitest/_src/app/reporter/*`

---

## 1. Executive summary

LiveDoc is a **unified Living Documentation reporting system** that turns executable specifications (BDD + conventional tests) into:

- A **full-featured website** for business stakeholders and cross-team visibility.
- A **VS Code extension** for developers to get fast feedback, navigate results, and keep docs close to code.

The same underlying data (runs, features, scenarios, steps, suites) must power both experiences via a shared server, shared schema, and (where appropriate) shared UI.

### 1.1 Reality check: what is implemented vs what is missing

The current repo has a strong foundation for **test result visualization**. However, many **Living Documentation UX capabilities for business stakeholders** are not implemented yet.

#### What exists today (high-level)

|            Audience             |                                                   Current experience (implemented)                                                    | Status |
| ---                             | ---                                                                                                                                   | ---    |
| Developer (VS Code)             | Tree view of latest run + open embedded Viewer panel + basic live refresh                                                             | ✅/⚠️   |
| Developer/Team (Website Viewer) | Full navigation of stored runs (summary→feature→scenario) with real-time updates                                                      | ✅      |
| Business stakeholder            | Can read the same views, but there is no stakeholder-friendly mode, sharing/export, comments, review workflow, or requirement mapping | ⏳      |

#### The “most UX is done” misconception

The implemented UX is primarily **technical navigation** (what ran, what passed/failed, drill-down). The higher-value Living Documentation UX for stakeholders (discoverability, shareability, collaboration, traceability) is still largely **planned**.

---

## 2. Implementation gap analysis (clear and explicit)

This section is intentionally blunt: it lists what a “substantial value” system still needs beyond the current run viewer.

### 2.1 Stakeholder value gaps (Viewer website)

|          Gap           |                                  Why it matters                                  | Current status |
| ---                    | ---                                                                              | ---            |
| Business-friendly mode | Non-technical users need a simplified narrative without stacks/errors by default | ⏳ Missing      |
| Search + filtering     | Stakeholders and QA must find relevant scenarios quickly                         | ⏳ Missing      |
| Shareable deep links   | Stakeholders need to reference a specific scenario in email/chat                 | ⏳ Missing      |
| Export/print           | Stakeholder reporting needs PDF/HTML export for reviews                          | ⏳ Missing      |
| Collaboration workflow | Comments + review/approval states enable the “living” part                       | ⏳ Missing      |
| Requirement mapping    | Traceability to Jira/Azure DevOps turns docs into governance                     | ⏳ Missing      |

### 2.2 Developer workflow gaps (VS Code)

|           Gap           |                                 Why it matters                                 |  Current status   |
| ---                     | ---                                                                            | ---               |
| Remote mode enforcement | Settings exist but runtime behavior is not fully enforced                      | 🔁 Needs revision |
| Robust live updates     | WS client refreshes on a subset of events; no backoff                          | ⚠️ Partial        |
| Single UI experience    | Legacy “Reporter” webview is separate and not aligned with shared Viewer UI    | 🔁 Needs revision |
| Persisted local history | Extension currently uses a per-process temp `dataDir`, which defeats “history” | 🔁 Needs revision |

### 2.3 Reporting/ingestion gaps (Vitest)

|         Gap         |                  Why it matters                  |        Current status         |
| ---                 | ---                                              | ---                           |
| Streaming ingestion | Enables true “live” progress and partial results | ⏳ Missing (batch upload used) |
| Config precedence   | Needed for CI/remote and enterprise setups       | ⏳ Missing                     |
| Quiet offline mode  | Must not spam console; log once                  | 🔁 Needs revision             |

---

---

## 3. Problem statement

Most teams have one or more of the following failure modes:

- “Documentation drift”: docs are written once and become wrong.
- “Test output is ephemeral”: developers see console output briefly; business stakeholders never see it.
- “No shared language”: requirements live in tickets; behavior lives in code; neither is continuously reconciled.
- “Coverage is unknowable”: it’s unclear what is specified, tested, and trusted.

LiveDoc solves this by making tests **readable**, **discoverable**, and **continuously validated**, and by supporting workflows for both business and technical roles.

---

## 4. Living Documentation principles (research-grounded)

These principles are what the product must embody in UX, data modeling, and delivery.

### P1 — Collaboration over tooling

Living Documentation only provides value when it supports **shared understanding** across roles (product, QA, dev), not when it is “just test reporting”.

### P2 — Specification by example

Examples are easier to author and review than abstract specs. Executable examples also create a **double-check** between code and specification.

### P3 — Discovery → Formulation → Automation

The system should support the three BDD activities:

- **Discovery**: explore/agree on examples.
- **Formulation**: express examples in a semi-structured, readable form.
- **Automation**: turn examples into executable checks; keep the docs truthful.

### P4 — Domain language (ubiquitous language)

Step/scenario wording should use business terms and remain stable. The system must help teams keep tests readable and avoid leaking technical jargon into stakeholder-facing views.

### P5 — Documentation is an *asset*

Over time, a team should gain:

- Faster onboarding.
- Safer changes.
- Higher release confidence.
- Fewer “what does the system do?” meetings.

Reference reading (external):

- Cucumber BDD overview: https://cucumber.io/docs/bdd/
- Cucumber tutorial note on “living documentation”: https://cucumber.io/docs/guides/10-minute-tutorial/
- Agile Alliance BDD glossary: https://agilealliance.org/glossary/bdd/
- Martin Fowler on Specification by Example: https://martinfowler.com/bliki/SpecificationByExample.html

---

## 5. Vision and goals

### 4.1 Vision

**One source of truth** for “what the system does”: executable specifications that are continuously validated and visible to both developers and business stakeholders.

### 4.2 Primary goals

| Goal |                         Description                         | Priority |
| ---  | ---                                                         | ---:     |
| G1   | Stakeholders can read specs in plain language               | P0       |
| G2   | Developers get fast feedback and navigation                 | P0       |
| G3   | Results are persisted and queryable (runs/history)          | P0       |
| G4   | Real-time streaming updates during execution                | P1       |
| G5   | Cross-framework ingestion via shared schema                 | P1       |
| G6   | Requirement coverage & traceability (optional integrations) | P2       |
| G7   | Collaboration workflow (comments, review states)            | P2       |

### 4.3 Success metrics (measurable)

**Developer value metrics**

- D1: “Time-to-first-signal” from test start to UI update ≤ 2s on local dev.
- D2: “Time-to-root-cause” reduced (proxy: fewer context switches; direct navigation to scenario/step and code pointers).

**Business stakeholder metrics**

- B1: A non-technical user can correctly summarize a feature’s behavior by reading the viewer alone (target ≥ 90% for key flows).
- B2: Stakeholder review loop time reduces (days → hours).

**System metrics**

- S1: Support ≥ 1,000 scenarios/run without UI lockups.
- S2: Persist and browse ≥ 50 runs per project/environment by default.

---

## 6. Scope

### 5.1 In scope

- Shared server + schema (`@livedoc/server`)
- Vitest ingestion (`@livedoc/vitest`)
- Viewer web UI (`@livedoc/viewer`)
- VS Code extension UI (`@livedoc/vscode`)

### 5.2 Out of scope (for this BRD version)

- Full authentication/authorization system (may be added as a later epic; see security requirements).
- Editing specs in the UI (read-first).
- Complex enterprise multi-tenancy.

---

## 7. Personas and jobs-to-be-done

### 6.1 Developer

- **JTBD:** “When I run tests, I want immediate, navigable results so I can iterate quickly.”
- Needs: live status, failures surfaced, jump-to-code, reliable history.

### 6.2 Business Analyst / Product Manager

- **JTBD:** “I want to read and validate requirements as behavior examples, and know what is covered and passing.”
- Needs: plain language, simplified view, sharing/printing, requirement mapping.

### 6.3 QA

- **JTBD:** “I want to spot gaps, flaky areas, and regression risks.”
- Needs: filtering, trends, comparisons, coverage views.

### 6.4 CI/CD

- **JTBD:** “I want stable ingestion and storage of results across builds.”
- Needs: batch upload, deterministic run identity (or stable correlation), retention.

---

## 8. System architecture (unified)

### 7.1 Component diagram

```
┌─────────────────────────────┐
│  Test Frameworks            │
│  (Vitest, xUnit, etc.)      │
└──────────────┬──────────────┘
							 │
							 │ Reporter events (batch or streaming)
							 ▼
┌─────────────────────────────┐
│ @livedoc/server             │
│ - REST API                  │
│ - WebSocket events          │
│ - RunStore (persist)        │
│ - Schema types              │
└───────┬───────────┬────────┘
				│           │
				│           │
				▼           ▼
┌────────────────┐  ┌───────────────────────────┐
│ @livedoc/viewer │  │ @livedoc/vscode           │
│ Website (React) │  │ Extension (Tree + Webview)│
└────────────────┘  └───────────────────────────┘
```

### 7.2 Shared data contract

**Schema is the contract.** All producers and consumers must conform to `@livedoc/server` schema types.

- BDD: Feature → Scenario/ScenarioOutline → Step (plus Background)
- Non-BDD: Suite → Test

---

## 9. Common vs component-specific responsibilities

### 8.1 Common (shared) responsibilities

- Run identity, lifecycle, and persistence
- Schema stability and versioning
- Real-time updates over WebSocket
- Discoverability (health + port discovery) for local flows
- Canonical interpretation of statuses (`pending`, `running`, `passed`, `failed`, `skipped`, `completed`)

### 8.2 Viewer (website) responsibilities

- Stakeholder-first navigation, sharing, and printable views
- Multi-project visibility and historical browsing
- Optional read-only mode and lightweight hosting

### 8.3 VS Code extension responsibilities

- “Fast lane” navigation: Tree view for quick scanning
- Tight integration with developer workflow: commands, context menus, open viewer, open file
- Option to host server embedded (local) or connect to remote

---

## 10. Unified requirements

This section is the “contract” for what the whole system must do.

### 9.1 Data & semantics requirements (shared)

|     ID     |                                             Requirement                                              | Priority |                                       Status (repo)                                       |
| ---        | ---                                                                                                  | ---:     | ---                                                                                       |
| U-DATA-001 | A run contains BDD features and/or non-BDD suites                                                    | P0       | ✅ Done (schema supports both; server accepts batch run)                                   |
| U-DATA-002 | Status and statistics are computed consistently across components                                    | P0       | ⚠️ Partial (reporter computes; ensure server/store consistency across streaming vs batch) |
| U-DATA-003 | Scenarios and steps preserve “business-readable titles” separate from raw/bound forms                | P1       | ✅ Done (schema has `displayTitle`, `rawTitle`, `valuesRaw`)                               |
| U-DATA-004 | Scenario Outline must preserve template steps and example executions                                 | P0       | ✅ Done in viewer; ⚠️ Partial in reporter (batch mitigation present)                       |
| U-DATA-005 | The system must support linking specs to external IDs (e.g., Jira keys) without breaking readability | P2       | ⏳ Planned                                                                                 |

### 9.2 Server/API requirements (shared)

|    ID     |                                  Requirement                                   | Priority |                               Status (repo)                                |
| ---       | ---                                                                            | ---:     | ---                                                                        |
| U-API-001 | REST endpoints exist for hierarchy, projects, runs, and posting results        | P0       | ✅ Done (`/api/*`)                                                          |
| U-API-002 | WebSocket endpoint broadcasts events for run lifecycle and updates             | P0       | ✅ Done (`/ws`, events in schema)                                           |
| U-API-003 | Server can run embedded (library mode) or standalone (CLI)                     | P0       | ✅ Done (`createServer`, `startServer`, `cli.ts`)                           |
| U-API-004 | Server discovery works locally via port file + health check                    | P0       | ✅ Done (`discoverServer`, `/api/health`, port file)                        |
| U-API-005 | Streaming endpoints support incremental ingestion for features/scenarios/steps | P1       | ✅ Done (streaming endpoints exist)                                         |
| U-API-006 | Streaming endpoints for non-BDD suites/tests exist                             | P2       | ⏳ Planned (not present in server routes)                                   |
| U-API-007 | Backward compatibility: schema evolution must be versioned                     | P1       | ⚠️ Partial (schema has `version: '1.0'`; no migration strategy documented) |

### 9.3 UX principles (shared)

|    ID    |                                   Requirement                                    | Priority |                                        Status                                         |
| ---      | ---                                                                              | ---:     | ---                                                                                   |
| U-UX-001 | The same run renders the same meaning across viewer and extension                | P0       | ⚠️ Partial (UI parity exists, but extension has additional legacy “Reporter” webview) |
| U-UX-002 | Stakeholder mode hides technical noise by default (errors/stack traces optional) | P1       | ⏳ Planned                                                                             |
| U-UX-003 | Deep-link navigation to Feature/Scenario is supported                            | P1       | ✅ Done for VS Code → viewer panel message; website needs URL deep-links (planned)     |

### 9.4 Cross-surface harmony requirements (website + VS Code)

These requirements ensure the **external website** and the **VS Code extension** work in harmony while still allowing host-appropriate navigation.

|     ID     |                                                                     Requirement                                                                      | Priority |                                        Status                                         |
| ---        | ---                                                                                                                                                  | ---:     | ---                                                                                   |
| U-HARM-001 | A single run must render the same semantic meaning in Website and VS Code (same status, counts, hierarchy, titles)                                   | P0       | ⚠️ Partial (core parity exists; legacy VS Code Reporter webview violates “single UI”) |
| U-HARM-002 | Host navigation is specialized (web routing vs VS Code tree), but right-side content views are shared from the same UI implementation where feasible | P0       | ✅ Done (baseline reuse via Viewer bundle) / ⏳ Planned (formalize shared modules)      |
| U-HARM-003 | Filtering/search behavior inside content views is consistent across Website and VS Code (same fields, same semantics)                                | P1       | ⏳ Planned                                                                             |
| U-HARM-004 | Deep-link identity is consistent across hosts: the website uses URLs; VS Code uses message navigation, but both address the same underlying IDs      | P1       | ⚠️ Partial (VS Code navigate exists; website URL deep-links planned)                  |
| U-HARM-005 | Version compatibility is explicit: viewer + extension must be compatible with the server schema version they connect to                              | P1       | ⚠️ Partial (schema has a version field; no compatibility policy documented)           |
| U-HARM-006 | Build outputs are deterministic: the VS Code webview uses the same Viewer source of truth as the website build (no forked UI implementations)        | P0       | ⚠️ Partial (true for embedded viewer; legacy reporter webview is a fork)              |

---

## 11. Component requirements — @livedoc/viewer (website)

This section focuses on business stakeholder value and website-specific needs.

### 10.1 Functional requirements

|   ID   |                       Requirement                        | Priority |           Status (repo)            |
| ---    | ---                                                      | ---:     | ---                                |
| VW-001 | Browse hierarchy: Project → Environment → Run            | P0       | ✅ Done                             |
| VW-002 | Drill-down: Summary → Group → Feature → Scenario → Steps | P0       | ✅ Done                             |
| VW-003 | Live updates during execution (WebSocket)                | P0       | ✅ Done                             |
| VW-004 | Delete runs and manage history                           | P1       | ✅ Done                             |
| VW-005 | Search and filter by status/tags/text                    | P1       | ⏳ Planned (backlog in viewer docs) |
| VW-006 | Shareable deep links (feature/scenario)                  | P1       | ⏳ Planned                          |
| VW-007 | Export/print stakeholder-friendly report (HTML/PDF)      | P2       | ⏳ Planned                          |
| VW-008 | Business view mode (hide technical details)              | P1       | ⏳ Planned                          |
| VW-009 | Comments/review workflow (collaboration)                 | P2       | ⏳ Planned                          |

### 10.2 Non-functional requirements

|     ID     |                   Requirement                   | Priority |            Status            |
| ---        | ---                                             | ---:     | ---                          |
| VW-NFR-001 | Accessible UI (keyboard + semantics)            | P1       | ⚠️ Partial (not audited)     |
| VW-NFR-002 | Performance: handle large runs without freezing | P1       | ⚠️ Partial (not benchmarked) |
| VW-NFR-003 | Theme persistence (localStorage)                | P2       | ⏳ Planned                    |

---

## 12. Component requirements — @livedoc/vscode (VS Code extension)

This section focuses on developer workflow and VS Code-specific integration.

### 11.1 Functional requirements

|   ID   |                     Requirement                      | Priority |                                    Status (repo)                                    |
| ---    | ---                                                  | ---:     | ---                                                                                 |
| VS-001 | Start server on activation (non-blocking, resilient) | P0       | ✅ Done                                                                              |
| VS-002 | VS Code settings for server mode/port/remote URL     | P0       | ✅ Done (manifest) / ⚠️ Partial (not all modes enforced in runtime)                  |
| VS-003 | Tree view reads from server API and supports refresh | P0       | ✅ Done                                                                              |
| VS-004 | Live updates via WebSocket                           | P0       | ⚠️ Partial (reconnect exists; no backoff; limited event handling)                   |
| VS-005 | Command to open embedded Viewer panel (replace mode) | P0       | ✅ Done (`livedoc.openViewer`, reuse panel)                                          |
| VS-006 | Tree item context action “Open in Viewer”            | P1       | ✅ Done                                                                              |
| VS-007 | Tree items navigate to code locations                | P1       | ⚠️ Partial (implementation exists in tree items; needs validation across platforms) |

### 11.2 VS Code-specific quality requirements

|     ID     |                      Requirement                       | Priority |                                                         Status                                                         |
| ---        | ---                                                    | ---:     | ---                                                                                                                    |
| VS-NFR-001 | Must not spam notifications; failures degrade silently | P1       | ⚠️ Partial (server start warns via toast; reporter logs to console)                                                    |
| VS-NFR-002 | Webview CSP must be safe and predictable               | P0       | 🔁 Needs revision (webview injects inline config script; should prefer non-inline config path or strict CSP alignment) |
| VS-NFR-003 | Remote mode must not auto-start local server           | P1       | 🔁 Needs revision (settings exist; runtime always starts local when autoStart=true)                                    |

---

## 13. Component requirements — @livedoc/vitest (reporting)

### 12.1 Functional requirements

|   ID   |                               Requirement                               | Priority |                       Status (repo)                       |
| ---    | ---                                                                     | ---:     | ---                                                       |
| VT-001 | Reporter can discover server automatically for zero-config local use    | P0       | ✅ Done (`discoverServer`)                                 |
| VT-002 | Reporter must not fail the test run if server is missing                | P0       | ✅ Done                                                    |
| VT-003 | Streaming mode: send events as tests execute                            | P1       | ⏳ Planned (current reporter uses batch upload mitigation) |
| VT-004 | Batch mode: send complete run at end (CI-friendly)                      | P0       | ✅ Done                                                    |
| VT-005 | Config: environment variable and/or reporter options override discovery | P1       | ⏳ Planned                                                 |

### 12.2 Requirements that imply revisions

- **VT-REV-001:** “Silent offline mode” should log **once** and avoid noisy console output by default. Current reporter logs multiple messages to console. (🔁 Needs revision)
- **VT-REV-002:** Add event queue + bounded memory when streaming is enabled. (⏳ Planned)

---

## 14. Component requirements — @livedoc/server (shared server)

### 13.1 Functional requirements

|   ID   |                         Requirement                         | Priority |               Status (repo)               |
| ---    | ---                                                         | ---:     | ---                                       |
| SV-001 | Persistent run store with retention per project/environment | P0       | ✅ Done (`RunStore`, default 50)           |
| SV-002 | Health endpoint returns status + port                       | P0       | ✅ Done (`/api/health`)                    |
| SV-003 | Port discovery file is written and cleaned up safely        | P0       | ✅ Done (`livedoc-server.json`, PID check) |
| SV-004 | Stable REST API for runs and hierarchy                      | P0       | ✅ Done                                    |
| SV-005 | WebSocket broadcast supports subscriptions                  | P0       | ✅ Done                                    |

### 13.2 Security & governance requirements

|     ID     |                          Requirement                           | Priority |                               Status                               |
| ---        | ---                                                            | ---:     | ---                                                                |
| SV-SEC-001 | Optional API token enforcement for write endpoints             | P2       | ⏳ Planned (header exists; not enforced)                            |
| SV-SEC-002 | Avoid leaking absolute file paths by default in stakeholder UI | P1       | ⚠️ Partial (schema supports filenames; UI policies not formalized) |

---

## 15. Shared UI strategy (website + VS Code webview)

### 14.1 Current state (repo)

- Viewer web UI is a React app.
- Viewer can be built for webview: `@livedoc/viewer` has `build:webview` producing `dist/webview/index.js` + `index.css`.
- VS Code extension copies webview assets into `packages/vscode/dist/viewer` during compile.
- VS Code viewer webview passes `window.__LIVEDOC_CONFIG__ = { serverUrl, mode: 'embedded' }` and sends navigation messages.

**Status:** ✅ Done (core mechanism exists)

### 14.2 Updated requirement (CSP + config injection)

**UI-SHARED-001 (P0):** Embedded viewer configuration must not require inline scripts.

- Rationale: aligns with strict webview CSP and reduces security surface.
- Recommended approach: set config via `acquireVsCodeApi()` messaging or load a small config script as a separate resource.

**Status:** 🔁 Needs revision (current webview uses inline `<script nonce>` for config)

### 14.3 Unifying principle: host navigation, shared right-side views

**Intent:** Keep a unified UI stack where it makes sense.

- **Host-specialized navigation (left / shell):**
	- VS Code: Tree view + context menus remain VS Code-native.
	- Website: Browser routing/sidebar remain web-native.
- **Shared content views (right-side panes):**
	- Scenario/feature/run detail views should be shared (same React/Tailwind/shadcn primitives where possible), and embedded in both the website and the VS Code webview.
	- **Filtering/search UI is considered a right-side view** when shown as part of the content experience, and should be shared if feasible.

**UI-SHARED-002 (P0):** Right-side “content views” must be implemented once and reused across Web + VS Code webview.

- Examples: scenario detail, feature overview, failure details, step timeline.

**Status:** ✅ Done (baseline reuse exists via Viewer bundle) / ⏳ Planned (refactor into clearer shareable modules)

**UI-SHARED-003 (P1):** Filtering/search components used inside content views should be shared.

- Examples: status filter chips, tag filters, text search box used within Viewer screens.

**Status:** ⏳ Planned

### 14.4 Transition rule: archive before removal (repo-root)

During any UI transition (e.g., replacing the legacy VS Code Reporter webview), **do not delete old code immediately**.

**ARCHIVE-001 (P0):** Any deprecated implementation must be moved into the repo-root `./archive/` folder before removal.

- Goal: prevent accidental loss, preserve reference behavior, and keep a recovery path during migration.
- Constraint: archived code must not be part of the production bundle/activation path.
- Cleanup: once the replacement is verified, archived code may be deleted.

**Status:** ⏳ Planned (policy documented; enforce during refactors)

### 14.5 Execution acceptance criteria for “harmonized web + extension”

This is the minimum Definition of Done for the “two surfaces in harmony” milestone.

|                                                                   Criteria                                                                   |                   Why it matters                    |    Status     |
| ---                                                                                                                                          | ---                                                 | ---           |
| AC-HARM-001: The VS Code experience for right-side views is the embedded Viewer (no separate legacy Reporter webview in the production path) | Enforces single shared UI implementation            | ⏳ Planned     |
| AC-HARM-002: Website and VS Code both support the same core drill-down views (summary/feature/scenario) with consistent semantics            | Prevents divergence and duplicated bug fixes        | ✅ Done (core) |
| AC-HARM-003: Filtering/search UI inside the content views behaves the same on both surfaces                                                  | Enables shared UX patterns and reduces support cost | ⏳ Planned     |
| AC-HARM-004: A link/reference to a scenario can be shared between roles (web URL; VS Code “copy link” or “open in website”)                  | Enables cross-team collaboration                    | ⏳ Planned     |
| AC-HARM-005: Archived code is stored under repo-root `./archive/` and is removable after verification                                        | Safe migration path without long-term clutter       | ⏳ Planned     |

---

---

## 16. Delivery epics (unified backlog)

This replaces fragmentation across per-package backlogs while preserving them as detailed notes.

### Epic E1 — Shared server foundation

- ✅ Extract server into `@livedoc/server`
- ✅ Embeddable server API
- ✅ Viewer consumes shared server
- ✅ Health + port discovery
- ⏳ Add non-BDD streaming endpoints (`/suites`, `/tests`) and WS events

### Epic E2 — VS Code integration

- ✅ Start server on activation (local)
- ⚠️ Remote mode behavior and settings enforcement
- ✅ Tree view reads from API
- ⚠️ WebSocket reconnect backoff + broader event handling
- ✅ Embedded viewer panel + navigation from tree

### Epic E3 — Reporter integration

- ✅ Batch upload (`POST /api/runs`) from vitest reporter
- ⏳ Streaming event queue and incremental updates
- ⏳ Config precedence: ENV > options > discovery > default

### Epic E4 — Stakeholder value features (Viewer)

- ⏳ Business view mode
- ⏳ Search/filter
- ⏳ Shareable links
- ⏳ Export/print
- ⏳ Requirement mapping + traceability
- ⏳ Comments/review workflow

---

## 17. “Done / Partial / Needs revision” summary (based on repo state)

### ✅ Completed

- `@livedoc/server` exists with REST + WS + persistent store + discovery.
- `@livedoc/viewer` uses `@livedoc/server` and has a full SPA UI.
- VS Code extension can host the server, connect WS, fetch latest run, show a tree, and open the embedded viewer panel.
- Viewer webview build + copy into extension works.
- Vitest reporter can discover server and post a complete run in batch mode.

### ⚠️ Partial

- VS Code settings exist but runtime does not fully enforce `server.enabled` / `server.mode` (local vs remote).
- VS Code WebSocket reconnect lacks backoff and only refreshes on a subset of events.
- Streaming reporting is not implemented in vitest reporter (batch mitigation used).

### 🔁 Needs revision (important)

- **Extension server dataDir strategy:** extension currently uses a per-process temp dataDir, which conflicts with “persistent history” and “global multi-project server scope” goals. Decide:
	- (A) Always use a stable data dir (recommended), OR
	- (B) Make it configurable with clear tradeoffs.
- **Webview CSP/config injection:** remove inline config script to align with strict CSP requirements.
- **Reporter logging:** default should be quiet (log once) in offline mode.

---

## 18. Open decisions (must be made explicitly)

|         Decision         |                         Options                          |                  Default recommendation                  |
| ---                      | ---                                                      | ---                                                      |
| D1: Server ownership     | Extension-hosted vs standalone viewer vs separate daemon | Extension-hosted for dev; standalone for stakeholders/CI |
| D2: Persistence location | repo `.livedoc/data` vs user-home vs temp                | repo-local for dev projects; configurable for CI         |
| D3: Identity model       | runId only vs runId + build metadata                     | runId + optional metadata (branch/commit/build)          |
| D4: Stakeholder access   | local only vs hosted server                              | support hosted server as a later epic                    |

---

## 19. Next concrete steps (recommended)

1. Align on the **revision items** (dataDir, CSP config injection, reporter logging) and update implementation accordingly.
2. Implement **reporter streaming** (E3) to unlock real-time progress UX.
3. Implement **Viewer stakeholder value** (E4) starting with business view mode + search.

---

## 23. Execution plan (milestones that unlock delivery)

This section turns the BRD into an execution checklist. Complete milestones in order to keep the website and extension aligned.

### Milestone M0 — Foundation (already in place)

- Server exists (`@livedoc/server`), Viewer exists (`@livedoc/viewer`), VS Code embeds Viewer, Vitest uploads batch results.
- **Exit criteria:** already met (✅).

### Milestone M1 — Harmonized surfaces (unified right-side UI)

- Remove legacy VS Code Reporter webview from production usage (archive it first).
- Ensure embedded Viewer panel is the single “right-side” viewing surface inside VS Code.
- **Exit criteria:** AC-HARM-001 + AC-HARM-002 + ARCHIVE-001 satisfied.

### Milestone M2 — Shared filtering/search (first shared “content feature”)

- Implement Viewer filtering/search in a way that works identically in website + VS Code webview.
- **Exit criteria:** AC-HARM-003 satisfied and UX-FIND-001/UX-FIND-002 move to ✅.

### Milestone M3 — Shareable references

- Add website deep links and a way to open/copy the same target from VS Code.
- **Exit criteria:** AC-HARM-004 satisfied and UX-SHARE-001 moves to ✅.

### Milestone M4 — Stakeholder mode (minimum viable business value)

- Implement business-friendly mode (reduces technical noise by default).
- **Exit criteria:** UX-BIZ-001 moves to ✅.

---

## 20. Tech stack compliance & component reuse audit

You asked for a concrete analysis of reuse and compliance with:

- TypeScript
- Vitest
- React
- Zustand
- Tailwind CSS
- shadcn/ui

This section reports what is actually present in this repo today.

### 20.1 TypeScript

|     Component     | Compliance |         Evidence (repo reality)          |
| ---               | ---        | ---                                      |
| `@livedoc/server` | ✅ Yes      | TS source in `packages/server/src/*`     |
| `@livedoc/vitest` | ✅ Yes      | TS source in `packages/vitest/_src/*`    |
| `@livedoc/viewer` | ✅ Yes      | TS/TSX source in `packages/viewer/src/*` |
| `@livedoc/vscode` | ✅ Yes      | TS source in `packages/vscode/src/*`     |

### 20.2 Vitest (as a testing framework)

|       Component       | Compliance |                                                                             Notes                                                                              |
| ---                   | ---        | ---                                                                                                                                                            |
| `@livedoc/vitest`     | ✅ Yes      | Core framework/reporter package                                                                                                                                |
| Viewer/Server/VS Code | ⚠️ Partial | Vitest exists in the monorepo, but BRD does not currently require each package to have its own Vitest test suite; add tests where appropriate as work proceeds |

### 20.3 React

|               Surface               | Compliance |                                                 Notes                                                 |
| ---                                 | ---        | ---                                                                                                   |
| Viewer website UI                   | ✅ Yes      | React app in `packages/viewer/src/client`                                                             |
| VS Code embedded viewer             | ✅ Yes      | Reuses the same built Viewer React app (webview bundle copied into extension)                         |
| VS Code “Reporter” webview (legacy) | ⚠️ Partial | Appears to be a separate React app build (`out/reporter/index.js`), not aligned with shared Viewer UI |

### 20.4 Zustand

|            Surface            | Compliance |                           Notes                            |
| ---                           | ---        | ---                                                        |
| Viewer website UI             | ✅ Yes      | Uses Zustand store (`packages/viewer/src/client/store.ts`) |
| VS Code embedded viewer       | ✅ Yes      | Same UI as Viewer, thus same Zustand usage                 |
| VS Code extension (tree view) | N/A        | Tree view is native VS Code APIs, not React/Zustand        |

### 20.5 Tailwind CSS

|               Surface               | Compliance |                                 Notes                                 |
| ---                                 | ---        | ---                                                                   |
| Viewer website UI                   | ✅ Yes      | Tailwind v4 import (`@import "tailwindcss"`) and Vite Tailwind plugin |
| VS Code embedded viewer             | ✅ Yes      | Uses the same built Viewer CSS bundle                                 |
| VS Code “Reporter” webview (legacy) | ❌ No       | Uses Bootstrap + FontAwesome resources                                |

### 20.6 shadcn/ui (component library)

|               Surface               | Compliance |                                                                                           Notes                                                                                            |
| ---                                 | ---        | ---                                                                                                                                                                                        |
| Viewer website UI                   | ⚠️ Partial | Viewer uses Tailwind and utility deps common in shadcn ecosystems (CVA/clsx/tailwind-merge) but does not appear to use shadcn/ui component patterns directly (no `components/ui/*` found). |
| VS Code embedded viewer             | ⚠️ Partial | Same as Viewer UI                                                                                                                                                                          |
| VS Code “Reporter” webview (legacy) | ❌ No       | Bootstrap-based                                                                                                                                                                            |

**Updated requirement (enforced going forward):** For any new UI primitives (buttons, inputs, dialogs, dropdowns, tabs) use shadcn/ui patterns and avoid bespoke one-off components.

---

## 21. Component reuse analysis (what is shared today, what is not)

### 21.1 What is already reused successfully

|                       Shared asset                        |                 Used by                  | Status |
| ---                                                       | ---                                      | ---    |
| `@livedoc/server` schema/types                            | server, viewer, vitest reporter, VS Code | ✅ Done |
| Server implementation (`createServer`, REST/WS, RunStore) | viewer + VS Code                         | ✅ Done |
| Viewer React UI bundle as VS Code webview                 | website + VS Code                        | ✅ Done |

### 21.2 What is duplicated or conflicting

|                        Area                         |                                                           Problem                                                            |      Status       |
| ---                                                 | ---                                                                                                                          | ---               |
| VS Code “Reporter” webview vs embedded Viewer panel | Two different UIs; legacy uses Bootstrap and inline scripts; undermines “shared UI” goal                                     | 🔁 Needs revision |
| VS Code tree vs Viewer sidebar                      | Similar navigation concepts but different implementation; acceptable due to platform UX, but must align semantics and naming | ⚠️ Partial        |

### 21.3 Required action to meet “shared UI” goal

|                   Requirement                    |                                           Decision                                           |  Status   |
| ---                                              | ---                                                                                          | ---       |
| REUSE-001: Prefer the Viewer UI for rich viewing | Deprecate/retire the legacy reporter webview and route users to `livedoc.openViewer`         | ⏳ Planned |
| REUSE-002: Preserve legacy implementation        | Move legacy reporter webview sources into `./archive/` (repo root) as part of the transition | ⏳ Planned |

---

## 22. UX requirements catalog (detailed, with explicit status)

This is the missing “what do we actually need to build?” section. It groups UX requirements by outcome and marks status clearly.

### 22.1 Core navigation (technical drill-down)

|     ID      |                         Requirement                         |    Applies to    |              Status               |
| ---         | ---                                                         | ---              | ---                               |
| UX-CORE-001 | Navigate hierarchy (project/env/run)                        | Viewer           | ✅ Done                            |
| UX-CORE-002 | Drill-down views (summary → feature → scenario → step)      | Viewer           | ✅ Done                            |
| UX-CORE-003 | Open embedded Viewer from VS Code                           | VS Code          | ✅ Done                            |
| UX-CORE-004 | Navigate to feature/scenario from VS Code into viewer panel | VS Code + Viewer | ✅ Done (message-based navigation) |
| UX-CORE-005 | Tree view shows latest run                                  | VS Code          | ✅ Done                            |
| UX-CORE-006 | Tree view indicates “tests running”                         | VS Code          | ✅ Done                            |

### 22.2 Live updates (true real-time experience)

|     ID      |                         Requirement                          |   Applies to    |                         Status                         |
| ---         | ---                                                          | ---             | ---                                                    |
| UX-LIVE-001 | UI updates during execution (WS events)                      | Viewer          | ✅ Done                                                 |
| UX-LIVE-002 | VS Code tree updates during execution without manual refresh | VS Code         | ⚠️ Partial (limited event handling + simple reconnect) |
| UX-LIVE-003 | Reporter streams incremental events as tests run             | Vitest reporter | ⏳ Planned                                              |

### 22.3 Stakeholder readability (business value)

|     ID     |                               Requirement                               | Applies to |  Status   |
| ---        | ---                                                                     | ---        | ---       |
| UX-BIZ-001 | Business-friendly mode (hide stack traces, collapse timings by default) | Viewer     | ⏳ Planned |
| UX-BIZ-002 | Glossary/tooltips for domain terms                                      | Viewer     | ⏳ Planned |
| UX-BIZ-003 | “Documentation mode” (read behavior without run obsession)              | Viewer     | ⏳ Planned |

### 22.4 Sharing & publishing

|      ID      |                  Requirement                  | Applies to |  Status   |
| ---          | ---                                           | ---        | ---       |
| UX-SHARE-001 | Deep-link URLs to feature/scenario on website | Viewer     | ⏳ Planned |
| UX-SHARE-002 | Export/print (HTML/PDF)                       | Viewer     | ⏳ Planned |

### 22.5 Collaboration workflow

|      ID       |                 Requirement                 |        Applies to        |  Status   |
| ---           | ---                                         | ---                      | ---       |
| UX-COLLAB-001 | Comments on scenarios/features              | Viewer (+server storage) | ⏳ Planned |
| UX-COLLAB-002 | Review states (Reviewed / Needs discussion) | Viewer (+server storage) | ⏳ Planned |

### 22.6 Findability (scale)

|     ID      |            Requirement            | Applies to |  Status   |
| ---         | ---                               | ---        | ---       |
| UX-FIND-001 | Search (features/scenarios/steps) | Viewer     | ⏳ Planned |
| UX-FIND-002 | Filter by status/tags             | Viewer     | ⏳ Planned |

### 22.7 Trust, governance, and traceability

|      ID      |                       Requirement                        |         Applies to         |  Status   |
| ---          | ---                                                      | ---                        | ---       |
| UX-TRACE-001 | Requirement mapping (external IDs on scenarios/features) | Viewer + server + reporter | ⏳ Planned |
| UX-SEC-001   | Optional API token enforcement for writes                | Server                     | ⏳ Planned |


