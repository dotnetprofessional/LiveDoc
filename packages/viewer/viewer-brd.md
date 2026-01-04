# LiveDoc Viewer BRD

> **Deprecation Notice**: This document supersedes all previous BRDs and backlogs for the LiveDoc Viewer website.

## Overview
The LiveDoc Viewer is a web-based dashboard that provides a professional, polished view of all "Living Documentation". it is designed for business stakeholders, product owners, and QA teams to review specifications, track progress, and validate that the system meets requirements.

## Features

|              Feature               |   Status   |                 Reference                  |
| :---                               | :---       | :---                                       |
| **Browse Hierarchy**               | ✅ Done     | [Details](#browse-hierarchy)               |
| **Real-time Execution View**       | ⚠️ Partial | [Details](#real-time-execution-view)       |
| **Drill-down Navigation**          | ✅ Done     | [Details](#drill-down-navigation)          |
| **Persistent Run History**         | ✅ Done     | [Details](#persistent-run-history)         |
| **Scenario Outline Visualization** | ✅ Done     | [Details](#scenario-outline-visualization) |
| **Syntax Highlighting**            | ✅ Done     | [Details](#syntax-highlighting)            |
| **Business-Friendly Mode**         | ⏳ Planned  | [Details](#business-friendly-mode)         |

## Feature Details

### Browse Hierarchy
Stakeholders can navigate through a structured view of projects, environments, and individual test runs. This allows for easy discovery of documentation across different parts of the organization.

**Layout Sample:**
```text
Sidebar:
  [Project A]
    [Production]
      - Run #123 (Passed)
      - Run #122 (Failed)
    [Staging]
  [Project B]
```

### Syntax Highlighting
The viewer automatically highlights key elements in the Gherkin text to improve readability.
- **Quoted Values**: Text inside single or double quotes is highlighted.
- **Placeholders**: Gherkin placeholders (e.g., `<placeholder>`) are highlighted.
- **Step Keywords**: Given, When, Then, And, But are styled distinctly.

### Real-time Execution View
As tests are running (e.g., in a CI pipeline or on a developer's machine), the Viewer updates in real-time to show progress. Stakeholders can watch features turn green (pass) or red (fail) as they execute.

**Current Status Note:** 
Implementation is currently limited to feature-level updates. Individual scenario progress within a feature is not yet reflected in real-time (requires a full feature update from the reporter).

**Detail Sample:**
- Progress bar at the top showing % completion.
- Live status badges (Running, Passed, Failed) updating on features and scenarios.

### Drill-down Navigation
Users can start at a high-level summary of a test run and drill down into specific features, scenarios, and individual steps to see exactly what was tested and what the outcome was.

**Layout Sample:**
```text
Run Summary -> Feature List -> Scenario List -> Step Details
[Dashboard]    [Auth Feature]  [Login Success]  [Given I am...]
```

### Persistent Run History
The system stores a history of previous test runs (defaulting to the last 50). This allows teams to track stability over time and look back at the state of documentation for previous releases.

**Detail Sample:**
- A "History" tab within a project/environment showing a list of past runs with timestamps and summary stats.

### Scenario Outline Visualization
Displays parameterized scenarios as a template followed by a table of examples. Each example row shows its specific execution status, making it easy to see which data combinations passed or failed.

**Layout Sample:**
```text
Scenario Outline: Calculate shipping
  Given the customer is from <country>
  ...
Examples:
| country   | status |
| Australia | ✅ Pass |
| USA       | ❌ Fail |
```

### Business-Friendly Mode
(Planned) A simplified view that hides technical noise like stack traces, error details, and execution timings. This focuses the user's attention on the business narrative and requirements.

**Detail Sample:**
- A toggle switch "Stakeholder Mode" that collapses all technical metadata and only shows the Gherkin text.

### Search & Filter
(Planned) Allows users to quickly find specific features or scenarios by name, status, or tags. This is essential for navigating large documentation sets with hundreds or thousands of scenarios.

### Shareable Deep Links
(Planned) Enables users to copy a link to a specific feature or scenario to share in emails, chat, or bug reports. This facilitates communication between stakeholders and developers.

### Export to PDF/HTML
(Planned) Generates professional, stakeholder-ready reports that can be saved or printed for compliance, sign-off, or offline review.

### Collaboration & Comments
(Planned) Allows users to add comments or feedback directly onto scenarios. This turns the documentation into a collaborative space for refining requirements and resolving ambiguities.

### Requirement Mapping
(Planned) Links scenarios directly to external requirement IDs (e.g., Jira tickets or Azure DevOps items). This provides full traceability from business requirements to executable specifications.
