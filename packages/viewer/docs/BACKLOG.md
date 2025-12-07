# LiveDoc Viewer - Product Backlog

**Last Updated:** December 5, 2025

---

## Vision

LiveDoc Viewer transforms executable BDD tests into **Living Documentation** that business stakeholders can read, review, and validate alongside technical teams.

---

## Backlog

### 🔴 Priority 1 - Critical (Current Focus)

|  ID   |      Feature       |                           Description                           |   Status    |  Assigned  |  Notes  |
| ----  | ---------          | -------------                                                   | --------    | ---------- | ------- |
| P1-01 | Search & Filter    | Search scenarios by name, filter by status/tags                 | Not Started | -          | -       |
| P1-02 | Shareable Links    | Deep links to specific features/scenarios                       | Not Started | -          | -       |
| P1-03 | Theme Persistence  | Save dark/light preference to localStorage                      | Not Started | -          | -       |
| P1-04 | Business View Mode | Simplified view hiding technical details (errors, stack traces) | Not Started | -          | -       |

### 🟠 Priority 2 - High

|  ID   |       Feature        |               Description               |   Status    |  Assigned  |  Notes  |
| ----  | ---------            | -------------                           | --------    | ---------- | ------- |
| P2-01 | Export to PDF/HTML   | Print-friendly reports for stakeholders | Not Started | -          | -       |
| P2-02 | Scenario Comments    | Add feedback/notes on scenarios         | Not Started | -          | -       |
| P2-03 | Run Comparison       | Compare two runs side-by-side           | Not Started | -          | -       |
| P2-04 | Keyboard Navigation  | Shortcuts for common actions            | Not Started | -          | -       |
| P2-05 | Complete Light Theme | Finish light theme color palette        | Not Started | -          | -       |

### 🟡 Priority 3 - Medium

|  ID   |       Feature       |                   Description                   |   Status    |  Assigned  |  Notes  |
| ----  | ---------           | -------------                                   | --------    | ---------- | ------- |
| P3-01 | Requirement Mapping | Link scenarios to Jira/Azure DevOps items       | Not Started | -          | -       |
| P3-02 | Test Trends         | Historical pass/fail graphs                     | Not Started | -          | -       |
| P3-03 | Approval Workflow   | Mark scenarios as "Reviewed"/"Needs Discussion" | Not Started | -          | -       |
| P3-04 | Collapsible Steps   | Expand/collapse step details                    | Not Started | -          | -       |
| P3-05 | Error Boundaries    | Graceful error handling in UI                   | Not Started | -          | -       |
| P3-06 | Change Highlighting | Show what changed between versions              | Not Started | -          | -       |
| P3-07 | Glossary Tooltips   | Hover definitions for domain terms              | Not Started | -          | -       |

### 🟢 Priority 4 - Low

|  ID   |          Feature           |             Description             |   Status    |  Assigned  |  Notes  |
| ----  | ---------                  | -------------                       | --------    | ---------- | ------- |
| P4-01 | Authentication             | Optional user login, API tokens     | Not Started | -          | -       |
| P4-02 | Flaky Test Detection       | Identify inconsistent tests         | Not Started | -          | -       |
| P4-03 | Mobile Responsive          | Improve small screen layout         | Not Started | -          | -       |
| P4-04 | Loading Skeletons          | Add loading state placeholders      | Not Started | -          | -       |
| P4-05 | Notification Subscriptions | Subscribe to feature changes        | Not Started | -          | -       |
| P4-06 | CI/CD Integrations         | GitHub Actions, Azure DevOps badges | Not Started | -          | -       |

---

## Completed ✅

|  ID  |           Feature           |  Completed  |                 Notes                  |
| ---- | ---------                   | ----------- | -------                                |
| -    | REST API                    | ✅           | Full CRUD for test runs                |
| -    | WebSocket Real-time         | ✅           | Live updates during test execution     |
| -    | Persistent Storage          | ✅           | File-based in `.livedoc/data/`         |
| -    | Project Hierarchy           | ✅           | Project → Environment → Run navigation |
| -    | Summary View                | ✅           | Dashboard with stats                   |
| -    | Feature/Scenario/Step Views | ✅           | Full drill-down navigation             |
| -    | Scenario Outline Support    | ✅           | Examples table with template steps     |
| -    | Breadcrumb Navigation       | ✅           | Context-aware nav path                 |
| -    | Delete Run                  | ✅           | Remove runs from history               |
| -    | Connection Status           | ✅           | WebSocket indicator                    |

---

## Status Key

| Status      | Meaning                       |
| --------    | ---------                     |
| Not Started | Work has not begun            |
| In Progress | Currently being worked on     |
| In Review   | Ready for code review/testing |
| Blocked     | Waiting on dependency         |
| Done        | Completed and deployed        |

---

## Notes

- Priority can be adjusted based on stakeholder feedback
- Features may be split into smaller tasks when work begins
- See `BRD.md` for detailed requirements and technical specifications
