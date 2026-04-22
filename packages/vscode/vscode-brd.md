# LiveDoc VS Code Extension BRD

> **Deprecation Notice**: This document supersedes all previous backlogs and design documents for the `livedoc-vscode` extension.

## Overview
The LiveDoc VS Code extension brings "Living Documentation" directly into the developer's workflow. It provides fast feedback, easy navigation between code and specifications, and hosts the local documentation server for zero-config development.

## Features

|            Feature             |      Status       |               Reference                |
| :---                           | :---              | :---                                   |
| **Local Documentation Server** | ✅ Done            | [Details](#local-documentation-server) |
| **Quick Navigation Tree**      | ✅ Done            | [Details](#quick-navigation-tree)      |
| **Embedded Viewer Panel**      | ✅ Done            | [Details](#embedded-viewer-panel)      |
| **Jump to Code**               | ✅ Done            | [Details](#jump-to-code)               |
| **Real-time Tree Updates**     | ⚠️ Partial        | [Details](#real-time-tree-updates)     |
| **Remote Server Mode**         | ⚠️ Partial        | [Details](#remote-server-mode)         |
| **Stable Local History**       | 🔁 Needs Revision | [Details](#stable-local-history)       |

## Feature Details

### Local Documentation Server
The extension automatically starts a local LiveDoc server when VS Code opens. This server captures test results from the developer's machine and powers the local documentation views without requiring any external infrastructure.

**Detail Sample:**
- Status bar indicator showing "LiveDoc: Online (Port 3100)".
- Output channel "LiveDoc Server" showing logs.
- Automatic discovery via `%TEMP%/livedoc-server.json`.

### Quick Navigation Tree
A dedicated view in the VS Code sidebar that shows the latest test results in a hierarchical tree. This allows developers to quickly scan the status of their features and scenarios without leaving the editor.

**Layout Sample:**
```text
LIVEDOC EXPLORER
  v Feature: User Login ✅
    - Scenario: Valid credentials ✅
    - Scenario: Invalid password ❌
```

### Embedded Viewer Panel
Provides a full, rich documentation view (the same as the web Viewer) directly inside a VS Code tab. This allows developers to see the detailed business narrative and failure details alongside their code.

**Detail Sample:**
- Command `LiveDoc: Open Viewer` opens a new editor tab with the React-based Viewer UI.

### Jump to Code
Allows developers to click on a feature or scenario in the tree view or embedded viewer and jump directly to the corresponding line of code in the editor. This significantly speeds up the "red-green-refactor" cycle.

**Detail Sample:**
- Clicking a tree item opens the `.Spec.ts` file at the exact line where the `scenario()` or `feature()` is defined.

### Real-time Tree Updates
The sidebar tree view updates automatically as tests execute.

> **Current Status Note**: Basic updates work, but since the Vitest reporter currently uses a batch mitigation, the tree often updates all at once at the end of a run. True incremental updates will be available once the reporter supports streaming.

**Detail Sample:**
- Tree icons change from "Pending" (gray) to "Running" (spinner) to "Passed/Failed" (green/red) in real-time.

### Remote Server Mode
Allows the extension to connect to a central, hosted LiveDoc server instead of running a local one. This is useful for teams that want to see shared results from CI or other environments. (Current status: Settings exist but runtime enforcement needs improvement).

### Stable Local History
(Planned Revision) Ensures that the local documentation server uses a stable directory for storing history, so that test results are preserved across VS Code restarts and shared across different projects in the same workspace.
