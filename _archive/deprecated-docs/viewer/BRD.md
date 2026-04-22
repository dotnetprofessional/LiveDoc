# LiveDoc Viewer - Business Requirements Document (DEPRECATED)

> **DEPRECATION NOTICE**: This document is now deprecated. Please refer to the new [packages/viewer/viewer-brd.md](../viewer-brd.md) for the current source of truth.

**Version:** 1.0  
**Last Updated:** December 5, 2025  
**Status:** Living Document

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Objectives](#2-goals--objectives)
3. [System Architecture](#3-system-architecture)
4. [Feature Requirements](#4-feature-requirements)
   - [Implemented Features](#41-implemented-features)
   - [Planned Features](#42-planned-features)
5. [Data Model](#5-data-model)
6. [API Specification](#6-api-specification)
7. [User Interface Requirements](#7-user-interface-requirements)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Implementation Tracking](#9-implementation-tracking)

---

## 1. Overview

### 1.1 Purpose

LiveDoc Viewer is a **Living Documentation** platform that transforms executable BDD specifications into accessible, human-readable documentation. It provides a unified dashboard for viewing test results from multiple frameworks (Vitest, xUnit, Mocha, Jest) while enabling real-time collaboration between technical teams and business stakeholders.

### 1.2 Living Documentation Philosophy

The core principle of LiveDoc Viewer is that **tests are documentation**. Unlike traditional static documentation that becomes outdated, Living Documentation is:

- **Always Current**: Generated from actual executable tests, ensuring accuracy
- **Business-Readable**: Gherkin syntax (Given/When/Then) is understandable by non-technical stakeholders
- **Verifiable**: Each scenario is backed by automated tests that prove the system works as documented
- **Collaborative**: Business PMs and analysts can review, validate, and suggest improvements

> *"For the first time, Business PMs can see the actual tests validating the system. They can verify specifications match requirements and provide feedback before issues reach production."*

### 1.2 Scope

The viewer consists of:
- **Server Component**: Node.js/Hono API server with WebSocket support for real-time updates
- **Client Component**: React SPA with Tailwind CSS for the user interface
- **CLI Tool**: Command-line interface for starting the server
- **Persistent Storage**: File-based storage for test run history

### 1.3 Target Users

|          User Type          |               Primary Use Case               |                        Key Needs                        |
| -----------                 | -----------------                            | ------------                                            |
| **Business Analysts / PMs** | Review specifications, validate requirements | Plain language, no technical jargon, ability to comment |
| **Product Owners**          | Verify acceptance criteria coverage          | High-level summaries, requirement traceability          |
| **Developers**              | Debug failures, monitor test execution       | Detailed errors, stack traces, real-time updates        |
| **QA Engineers**            | Review test coverage, identify gaps          | Filtering, search, trend analysis                       |
| **Team Leads**              | Monitor project health across teams          | Dashboards, aggregated statistics                       |
| **CI/CD Pipelines**         | Report test results automatically            | API integration, batch uploads                          |

### 1.4 User Personas

#### Sarah - Business Analyst
> *"I need to verify that what the developers built matches what we specified. I don't want to read code, I want to read requirements in plain English and see if they pass or fail."*

- Reviews feature specifications weekly
- Needs to share findings with stakeholders in meetings
- Wants to add comments when something looks incorrect
- Prefers clean, printable reports for documentation

#### Marcus - Product Owner
> *"Before we release, I need confidence that all acceptance criteria are covered. I want to see at a glance: are we ready to ship?"*

- Checks test status before sprint reviews
- Needs to trace scenarios back to Jira tickets
- Wants notifications when critical features fail
- Reviews trends across multiple releases

#### Dev - Developer (Current Primary User)
> *"When tests fail, I need to know exactly what went wrong, where, and why. Give me the stack trace and let me debug."*

- Monitors tests in real-time during development
- Needs detailed error information
- Uses keyboard shortcuts for efficiency
- Wants to compare runs to find regressions

---

## 2. Goals & Objectives

### 2.1 Primary Goals

|  ID  |                                    Goal                                    |    Status     |
| ---- | ------                                                                     | --------      |
| G1   | **Living Documentation** - Bridge gap between business and technical teams | ⚠️ Partial    |
| G2   | Real-time visualization of test execution                                  | ✅ Implemented |
| G3   | Support for multiple test frameworks                                       | ✅ Implemented |
| G4   | Hierarchical navigation (Project → Group → Feature → Scenario)             | ✅ Implemented |
| G5   | Persistent storage of test history                                         | ✅ Implemented |
| G6   | Dark/Light theme support                                                   | ⚠️ Partial    |
| G7   | Business stakeholder collaboration                                         | ❌ Not Started |

### 2.2 Success Metrics

**Technical Metrics:**
- Test results displayed within 100ms of server receipt
- Support for 1000+ scenarios per run
- History retention of 50 runs per project/environment

**Business Collaboration Metrics:**
- Non-technical users can understand 90%+ of scenario descriptions without assistance
- Time to validate new feature specifications reduced by 50%
- Business stakeholder feedback loop reduced from days to hours

---

## 3. System Architecture

### 3.1 Component Overview

```
┌─────────────────┐     HTTP/WS      ┌─────────────────┐
│  Test Reporter  │ ───────────────► │    API Server   │
│  (Vitest/xUnit) │                  │   (Hono/Node)   │
└─────────────────┘                  └────────┬────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │               │               │
                              ▼               ▼               ▼
                       ┌──────────┐    ┌──────────┐    ┌──────────┐
                       │ REST API │    │WebSocket │    │  Static  │
                       │          │    │ Manager  │    │  Files   │
                       └──────────┘    └──────────┘    └──────────┘
                              │               │
                              └───────┬───────┘
                                      │
                              ┌───────▼───────┐
                              │   Run Store   │
                              │ (In-Memory +  │
                              │  File System) │
                              └───────────────┘
```

### 3.2 Technology Stack

|     Component      |  Technology  |  Version  |
| -----------        | ------------ | --------- |
| Server Framework   | Hono         | 4.6.x     |
| Runtime            | Node.js      | 18+       |
| Frontend Framework | React        | 19.x      |
| State Management   | Zustand      | 5.x       |
| Styling            | Tailwind CSS | 4.x       |
| Build Tool         | Vite         | 6.x       |
| WebSocket          | ws           | 8.x       |

---

## 4. Feature Requirements

### 4.1 Implemented Features

#### 4.1.1 Server Features

|   ID   |       Feature       |               Description                |   Status   |
| ----   | ---------           | -------------                            | --------   |
| SF-001 | REST API            | Full CRUD operations for test runs       | ✅ Complete |
| SF-002 | WebSocket Events    | Real-time broadcast of test events       | ✅ Complete |
| SF-003 | Persistent Storage  | File-based storage in `.livedoc/data/`   | ✅ Complete |
| SF-004 | Project Hierarchy   | Organize runs by project/environment     | ✅ Complete |
| SF-005 | Run History         | Maintain history per project/environment | ✅ Complete |
| SF-006 | CORS Support        | Cross-origin requests enabled            | ✅ Complete |
| SF-007 | Static File Serving | Serve React SPA in production            | ✅ Complete |

#### 4.1.2 Client Features

|   ID   |        Feature        |               Description               |                        Status                         |
| ----   | ---------             | -------------                           | --------                                              |
| CF-001 | Sidebar Navigation    | Tree view of projects/environments/runs | ✅ Complete                                            |
| CF-002 | Summary View          | Dashboard with aggregate stats          | ✅ Complete                                            |
| CF-003 | Group View            | Feature grouping by folder path         | ✅ Complete                                            |
| CF-004 | Feature View          | Feature details with scenario list      | ✅ Complete                                            |
| CF-005 | Scenario View         | Step-by-step execution details          | ✅ Complete                                            |
| CF-006 | Scenario Outline View | Examples table with template steps      | ✅ Complete                                            |
| CF-007 | Real-time Updates     | Live updates via WebSocket              | ✅ Complete                                            |
| CF-008 | Breadcrumb Navigation | Context-aware navigation path           | ✅ Complete                                            |
| CF-009 | Stats Bar             | Pass/fail/pending statistics            | ✅ Complete                                            |
| CF-010 | Status Badges         | Visual status indicators                | ✅ Complete                                            |
| CF-011 | Connection Status     | WebSocket connection indicator          | ✅ Complete                                            |
| CF-012 | Delete Run            | Remove runs from history                | ✅ Complete                                            |
| CF-013 | Theme Toggle          | Dark/Light mode switch                  | ⚠️ Partial (button exists, implementation incomplete) |

#### 4.1.3 Data Features

|   ID   |     Feature      |                Description                 |   Status   |
| ----   | ---------        | -------------                              | --------   |
| DF-001 | BDD Schema       | Full Gherkin model (Feature/Scenario/Step) | ✅ Complete |
| DF-002 | Error Details    | Error messages, stack traces, diffs        | ✅ Complete |
| DF-003 | Rule Violations  | Validation rule tracking                   | ✅ Complete |
| DF-004 | Tags Support     | Feature/Scenario tagging                   | ✅ Complete |
| DF-005 | DocStrings       | Multi-line step arguments                  | ✅ Complete |
| DF-006 | Data Tables      | Tabular step arguments                     | ✅ Complete |
| DF-007 | Background       | Shared scenario setup steps                | ✅ Complete |
| DF-008 | Scenario Outline | Parameterized scenarios                    | ✅ Complete |

### 4.2 Planned Features

#### 4.2.0 Living Documentation Features (Business Stakeholder Collaboration)

These features directly support the Living Documentation philosophy by making tests accessible and collaborative for business stakeholders.

|   ID   |            Feature             |                               Description                               |  Priority  |    Status     |
| ----   | ---------                      | -------------                                                           | ---------- | --------      |
| LD-001 | **Business-Friendly View**     | Simplified view hiding technical details (errors, stack traces, timing) | High       | ❌ Not Started |
| LD-002 | **Scenario Comments**          | Allow users to add comments/feedback on scenarios                       | High       | ❌ Not Started |
| LD-003 | **Requirement Mapping**        | Link scenarios to external requirements (Jira, Azure DevOps, etc.)      | High       | ❌ Not Started |
| LD-004 | **Glossary/Term Definitions**  | Hover definitions for domain terms used in scenarios                    | Medium     | ❌ Not Started |
| LD-005 | **Approval Workflow**          | Mark scenarios as "Reviewed" or "Needs Discussion"                      | Medium     | ❌ Not Started |
| LD-006 | **Shareable Links**            | Deep links to specific features/scenarios for email/chat sharing        | High       | ❌ Not Started |
| LD-007 | **Print-Friendly Export**      | Generate stakeholder-ready PDF/HTML reports                             | High       | ❌ Not Started |
| LD-008 | **Feature Documentation Mode** | View features as documentation without run context                      | Medium     | ❌ Not Started |
| LD-009 | **Change Highlighting**        | Show what changed between specification versions                        | Medium     | ❌ Not Started |
| LD-010 | **Coverage Gaps Report**       | Identify areas without test coverage for review                         | Medium     | ❌ Not Started |
| LD-011 | **Notification Subscriptions** | Subscribe to changes in specific features                               | Low        | ❌ Not Started |
| LD-012 | **Read-Only Stakeholder Mode** | Secure view-only access for external stakeholders                       | Medium     | ❌ Not Started |

#### 4.2.1 High Priority

|   ID   |       Feature       |              Description              |  Priority  |    Status     |
| ----   | ---------           | -------------                         | ---------- | --------      |
| PF-001 | Search & Filter     | Search by name, filter by status/tags | High       | ❌ Not Started |
| PF-002 | Run Comparison      | Compare two runs side-by-side         | High       | ❌ Not Started |
| PF-003 | Export Results      | Export to JSON, HTML, PDF             | High       | ❌ Not Started |
| PF-004 | Keyboard Navigation | Shortcuts for common actions          | High       | ❌ Not Started |

#### 4.2.2 Medium Priority

|   ID   |       Feature        |          Description           |  Priority  |    Status     |
| ----   | ---------            | -------------                  | ---------- | --------      |
| PF-005 | Test Trends          | Historical pass/fail graphs    | Medium     | ❌ Not Started |
| PF-006 | Duration Trends      | Execution time graphs          | Medium     | ❌ Not Started |
| PF-007 | Flaky Test Detection | Identify inconsistent tests    | Medium     | ❌ Not Started |
| PF-008 | Notification System  | Alerts for failures            | Medium     | ❌ Not Started |
| PF-009 | Test Grouping        | Custom grouping beyond folders | Medium     | ❌ Not Started |
| PF-010 | Collapsible Steps    | Expand/collapse step details   | Medium     | ❌ Not Started |

#### 4.2.3 Low Priority

|   ID   |      Feature       |           Description            |  Priority  |    Status     |
| ----   | ---------          | -------------                    | ---------- | --------      |
| PF-011 | Authentication     | User login, API tokens           | Low        | ❌ Not Started |
| PF-012 | Multi-tenant       | Multiple teams/workspaces        | Low        | ❌ Not Started |
| PF-013 | CI/CD Integrations | GitHub Actions, Azure DevOps     | Low        | ❌ Not Started |
| PF-014 | Embed Mode         | Iframe-friendly minimal view     | Low        | ❌ Not Started |
| PF-015 | Code Coverage      | Display coverage alongside tests | Low        | ❌ Not Started |

#### 4.2.4 Bug Fixes / Improvements

|   ID   |       Issue       |              Description              |  Priority  |    Status     |
| ----   | -------           | -------------                         | ---------- | --------      |
| BF-001 | Theme Persistence | Save theme preference to localStorage | Medium     | ❌ Not Started |
| BF-002 | Theme Colors      | Complete light theme color palette    | Medium     | ❌ Not Started |
| BF-003 | Mobile Responsive | Improve layout on small screens       | Low        | ❌ Not Started |
| BF-004 | Loading States    | Add skeleton loaders                  | Low        | ❌ Not Started |
| BF-005 | Error Boundaries  | Graceful error handling in UI         | Medium     | ❌ Not Started |

---

## 5. Data Model

### 5.1 Core Entities

```typescript
// Test Run - Top level container
interface TestRun {
  runId: string;
  project: string;
  environment: string;
  framework: 'vitest' | 'xunit' | 'mocha' | 'jest';
  timestamp: string;  // ISO 8601
  status: TestStatus;
  duration: number;   // ms
  summary: Statistics;
  features: Feature[];
}

// Feature - Maps to a .feature file or test file
interface Feature {
  id: string;
  title: string;
  description?: string;
  filename: string;
  tags?: string[];
  status: TestStatus;
  duration: number;
  background?: Scenario;
  scenarios: Scenario[];
  statistics: Statistics;
}

// Scenario - Individual test case
interface Scenario {
  id: string;
  type: 'Scenario' | 'ScenarioOutline' | 'Background';
  title: string;
  description?: string;
  tags?: string[];
  status: TestStatus;
  duration: number;
  steps: Step[];
  // For ScenarioOutline examples
  outlineId?: string;
  exampleIndex?: number;
  exampleValues?: Record<string, unknown>;
}

// Step - Given/When/Then action
interface Step {
  id: string;
  type: 'Given' | 'When' | 'Then' | 'and' | 'but';
  title: string;
  status: TestStatus;
  duration: number;
  error?: ErrorInfo;
  docString?: string;
  dataTable?: DataTableRow[];
}
```

### 5.2 Storage Structure

```
.livedoc/
└── data/
    └── {project}/
        └── {environment}/
            ├── lastrun.json      # Most recent run
            └── history/
                ├── 2025-12-05T10-30-00_abc123.json
                └── 2025-12-04T15-45-30_def456.json
```

---

## 6. API Specification

### 6.1 REST Endpoints

|  Method  |                 Endpoint                  |           Description            |  Status  |
| -------- | ----------                                | -------------                    | -------- |
| GET      | `/api/projects`                           | List all projects                | ✅        |
| GET      | `/api/hierarchy`                          | Get project tree for navigation  | ✅        |
| GET      | `/api/runs`                               | List all runs                    | ✅        |
| GET      | `/api/runs/:runId`                        | Get run details                  | ✅        |
| DELETE   | `/api/runs/:runId`                        | Delete a run                     | ✅        |
| GET      | `/api/projects/:project/:env/runs`        | List runs for project            | ✅        |
| GET      | `/api/projects/:project/:env/latest`      | Get latest run                   | ✅        |
| POST     | `/api/runs/start`                         | Start a new run (streaming mode) | ✅        |
| POST     | `/api/runs/:runId/features`               | Add feature to run               | ✅        |
| POST     | `/api/runs/:runId/scenarios`              | Add scenario to run              | ✅        |
| POST     | `/api/runs/:runId/steps`                  | Add step to run                  | ✅        |
| POST     | `/api/runs/:runId/scenarios/:id/complete` | Complete scenario                | ✅        |
| POST     | `/api/runs/:runId/complete`               | Complete run                     | ✅        |
| POST     | `/api/runs`                               | Post complete run (batch mode)   | ✅        |

### 6.2 WebSocket Events

|        Event         |    Direction    |         Description         |  Status  |
| -------              | -----------     | -------------               | -------- |
| `run:started`        | Server → Client | New run started             | ✅        |
| `feature:added`      | Server → Client | Feature added to run        | ✅        |
| `feature:updated`    | Server → Client | Feature status changed      | ✅        |
| `scenario:started`   | Server → Client | Scenario execution started  | ✅        |
| `scenario:completed` | Server → Client | Scenario execution finished | ✅        |
| `step:started`       | Server → Client | Step execution started      | ✅        |
| `step:completed`     | Server → Client | Step execution finished     | ✅        |
| `run:completed`      | Server → Client | Run finished                | ✅        |
| `run:deleted`        | Server → Client | Run was deleted             | ✅        |
| `subscribe`          | Client → Server | Subscribe to updates        | ✅        |
| `unsubscribe`        | Client → Server | Unsubscribe from updates    | ✅        |
| `ping`               | Client → Server | Keep-alive ping             | ✅        |

---

## 7. User Interface Requirements

### 7.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌───────────────┐ ┌───────────────────────────────────────────┐ │
│ │               │ │                                           │ │
│ │   SIDEBAR     │ │              MAIN CONTENT                 │ │
│ │               │ │                                           │ │
│ │ - Logo        │ │  ┌─────────────────────────────────────┐  │ │
│ │ - Connection  │ │  │         BREADCRUMB NAV              │  │ │
│ │ - Project     │ │  └─────────────────────────────────────┘  │ │
│ │   Tree        │ │  ┌─────────────────────────────────────┐  │ │
│ │   - Envs      │ │  │         PAGE HEADER                 │  │ │
│ │     - Runs    │ │  │         + STATS BAR                 │  │ │
│ │               │ │  └─────────────────────────────────────┘  │ │
│ │               │ │  ┌─────────────────────────────────────┐  │ │
│ │               │ │  │                                     │  │ │
│ │               │ │  │         CONTENT AREA                │  │ │
│ │               │ │  │         (List/Details)              │  │ │
│ │               │ │  │                                     │  │ │
│ │               │ │  └─────────────────────────────────────┘  │ │
│ └───────────────┘ └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Views

|   View   |                Purpose                |           Components Used            |
| ------   | ---------                             | -----------------                    |
| Summary  | Project overview with group list      | StatsBar, ItemList                   |
| Group    | Features in a folder group            | Breadcrumb, StatsBar, ItemList       |
| Feature  | Feature details with scenarios        | Breadcrumb, StatsBar, ItemList, Tags |
| Scenario | Step-by-step execution details        | Breadcrumb, StepList, Error display  |
| Outline  | Scenario template with examples table | Breadcrumb, Examples table, StepList |

### 7.3 Color Scheme

|    Element     |  Dark Mode  |  Light Mode  |
| ---------      | ----------- | ------------ |
| Background     | `#0d1117`   | `#ffffff`    |
| Surface        | `#161b22`   | `#f6f8fa`    |
| Border         | `#30363d`   | `#d0d7de`    |
| Text Primary   | `#e6edf3`   | `#24292f`    |
| Text Secondary | `#8b949e`   | `#57606a`    |
| Pass           | `#3fb950`   | `#1a7f37`    |
| Fail           | `#f85149`   | `#cf222e`    |
| Pending        | `#d29922`   | `#9a6700`    |
| Accent         | `#58a6ff`   | `#0969da`    |

---

## 8. Non-Functional Requirements

### 8.1 Performance

|        Requirement        |  Target  |     Status      |
| -------------             | -------- | --------        |
| Initial load time         | < 2s     | ⚠️ Not measured |
| WebSocket message latency | < 100ms  | ✅ Achieved      |
| Support concurrent runs   | 10+      | ✅ Achieved      |
| Max scenarios per run     | 1000+    | ✅ Achieved      |
| Memory usage (server)     | < 512MB  | ⚠️ Not measured |

### 8.2 Compatibility

|    Requirement    |                 Target                 |   Status   |
| -------------     | --------                               | --------   |
| Node.js version   | 18+                                    | ✅          |
| Browser support   | Chrome, Firefox, Safari, Edge (latest) | ✅          |
| Mobile responsive | Tablet and above                       | ⚠️ Partial |

### 8.3 Security

|    Requirement     |          Target          |         Status         |
| -------------      | --------                 | --------               |
| CORS configuration | Configurable origins     | ⚠️ Currently allow-all |
| API authentication | Optional token-based     | ❌ Not implemented      |
| Input validation   | All API inputs validated | ⚠️ Partial             |

---

## 9. Implementation Tracking

### 9.1 Current Sprint

|            Task            |   Status   |  Assignee  |     Notes     |
| ------                     | --------   | ---------- | -------       |
| Document existing features | ✅ Complete | -          | This document |
| Theme persistence fix      | ❌ Todo     | -          | -             |
| Search functionality       | ❌ Todo     | -          | -             |

### 9.2 Changelog

|    Date    |  Version  |                                   Changes                                    |
| ------     | --------- | ---------                                                                    |
| 2025-12-05 |       1.0 | Initial BRD created                                                          |
| 2025-12-05 |       1.1 | Added Living Documentation philosophy and stakeholder collaboration features |

### 9.3 Open Questions

**Technical:**
1. Should we support custom grouping beyond folder-based grouping?
2. What export formats are most valuable (JSON, HTML, PDF)?
3. Should authentication be required or optional?
4. Do we need support for multiple simultaneous runs from same project/env?

**Living Documentation & Collaboration:**
5. How should comments/feedback be stored? (Local file, external service, database?)
6. Should stakeholders be able to suggest edits to scenario text?
7. What level of change history is needed? (Per-scenario, per-feature, per-run?)
8. How do we handle requirement traceability across different project management tools?
9. Should there be role-based access (viewer, commenter, admin)?
10. How do we notify stakeholders when scenarios they're subscribed to change?

---

## Appendix A: Component Inventory

### Client Components

|      Component      |           File            |        Purpose         |
| -----------         | ------                    | ---------              |
| App                 | `App.tsx`                 | Root component         |
| Sidebar             | `Sidebar.tsx`             | Navigation tree        |
| MainContent         | `MainContent.tsx`         | Content router         |
| SummaryView         | `SummaryView.tsx`         | Project dashboard      |
| GroupView           | `GroupView.tsx`           | Feature group view     |
| FeatureView         | `FeatureView.tsx`         | Feature details        |
| ScenarioView        | `ScenarioView.tsx`        | Scenario details       |
| ScenarioOutlineView | `ScenarioOutlineView.tsx` | Outline with examples  |
| ScenarioOutlineCard | `ScenarioOutlineCard.tsx` | Outline card component |
| Breadcrumb          | `Breadcrumb.tsx`          | Navigation breadcrumb  |
| StatsBar            | `StatsBar.tsx`            | Statistics display     |
| StatusBadge         | `StatusBadge.tsx`         | Status indicator       |
| ItemList            | `ItemList.tsx`            | Generic list component |
| StepList            | `StepList.tsx`            | Step display           |
| Icons               | `Icons.tsx`               | SVG icons              |

### Server Components

|  Component  |        File        |      Purpose      |
| ----------- | ------             | ---------         |
| Server      | `index.ts`         | Main server entry |
| Store       | `store.ts`         | Data persistence  |
| WebSocket   | `websocket.ts`     | Real-time updates |
| Schema      | `shared/schema.ts` | Type definitions  |

---

*This is a living document. Update it as features are implemented or requirements change.*
