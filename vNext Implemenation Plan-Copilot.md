# LiveDoc vNext Implementation Plan

This document outlines the strategy for re-architecting the LiveDoc ecosystem to use the **vNext Data Model** as defined in [LIVEDOC_DATA_PROTOCOL_ASSESSMENT.md](LIVEDOC_DATA_PROTOCOL_ASSESSMENT.md).

## Core Objectives
- **Unified Protocol**: Establish a single source of truth for data types.
- **UI-Ready Data**: Shift complexity from the Viewer to the Producer (SDK/Reporter) and Server.
- **First-Class Patterns**: Explicitly model BDD (Features), Specifications (Rules), and Suites.
- **Stability**: Implement deterministic `StabilityID` for cross-run correlation.

---

## Phase 1: Foundation (The Schema Package)
**Goal**: Create a shared package that defines the canonical vNext model.

1.  **Initialize `packages/schema`**:
    *   Create a new workspace package.
    *   Export all interfaces and types defined in the "Proposed core schema (vNext)" section of the assessment.
    *   Include runtime validation (e.g., using `zod` or `typebox`) to ensure data integrity at the boundaries.
2.  **Define StabilityID Logic**:
    *   Implement a utility for generating deterministic IDs based on the hierarchical strategy (Project + Path + Title + Kind).
3.  **Standardize Enums**:
    *   Enforce lowercase `StepKeyword` and `Status` values across the protocol.

---

## Phase 2: Server Evolution
**Goal**: Update the server to act as a strict gatekeeper and provide a clean read-model.

1.  **Adopt `@livedoc/schema`**:
    *   Replace internal types in `packages/server` with the new schema.
2.  **Strict Validation**:
    *   Update REST endpoints (`/api/runs/start`, `/api/runs/:id/nodes`, etc.) to validate incoming payloads against the vNext schema.
3.  **Incremental Aggregation**:
    *   Update the server to compute `Statistics` and `ExecutionResult` status incrementally as nodes are added/updated.
4.  **Canonical Read Model**:
    *   Refactor `GET /api/runs/:id` to return the full `TestRun` object with the hierarchical structure (Features, Specifications, Suites) fully resolved.
5.  **WebSocket Contract**:
    *   Align server events with the `NodeEvent` union.
    *   Ensure `node:added` and `node:updated` events carry enough context for the Viewer to update its state without a full refresh.

---

## Phase 3: SDK Mapping (Vitest Reporter)
**Goal**: Update the Vitest reporter to emit vNext data without changing the underlying SDK model.

1.  **Mapping Layer**:
    *   Implement a mapper in `packages/vitest` that converts the internal SDK model (`Feature`, `Scenario`, `ScenarioOutline`, `ScenarioExample`, `StepDefinition`, `Specification`, `Rule`, `RuleOutline`, `RuleExample`, `VitestSuite`, `LiveDocTest`) into vNext `Node` types.
    *   **Gherkin Mapping**:
        *   `Feature` -> `vNext.Feature`
        *   `Scenario` -> `vNext.Scenario`
        *   `ScenarioOutline` -> `vNext.ScenarioOutline` (with `template` and `examples`)
        *   `StepDefinition` -> `vNext.Step`
    *   **Specification Mapping**:
        *   `Specification` -> `vNext.Specification`
        *   `Rule` -> `vNext.Rule`
        *   `RuleOutline` -> `vNext.RuleOutline`
    *   **Suite Mapping**:
        *   `VitestSuite` -> `vNext.TestSuite`
        *   `LiveDocTest` -> `vNext.Test`
2.  **StabilityID Integration**:
    *   Use the `@livedoc/schema` utility to generate IDs during the reporting phase.
3.  **Binding & Values**:
    *   Ensure `binding` objects are populated for all example nodes.
    *   Extract and type `Step.values` at the reporter level.
4.  **Incremental Posting**:
    *   Update the reporter to use the new server endpoints, sending vNext-compliant JSON.

---

## Phase 4: Viewer Redesign
**Goal**: A complete redesign of the Viewer to be a "dumb" renderer of UI-ready vNext data.

1.  **Store Overhaul (Zustand)**:
    *   Replace the current complex store with a simple model that mirrors the `TestRun` and `ProjectHierarchy` types from the schema.
    *   Remove all "interpretation" logic (e.g., `transformRunData`, `gherkin-utils.ts` grouping).
2.  **Generic Node Rendering**:
    *   Implement a base `NodeView` component that handles common attributes (title, status, duration, tags).
    *   Use a registry or switch-case to render pattern-specific details (e.g., `StepList` for Scenarios, `CodeBlock` for Rules).
3.  **Template Binding**:
    *   Implement a UI utility to apply `Binding` variables to `title` templates, providing syntax highlighting for bound values.
4.  **Real-time Updates**:
    *   Update `useWebSocket` to apply `NodeEvent` patches directly to the Zustand store.
5.  **Eliminate Heuristics**:
    *   Remove all title-prefix checks (`includes('specification')`) and background detection logic. Rely solely on `node.kind`.

---

## Phase 5: VS Code Extension Integration
**Goal**: Ensure the extension leverages the new model for its webviews and decorations.

1.  **Webview Update**:
    *   Update the extension to host the redesigned Viewer.
2.  **Data Flow**:
    *   Ensure the extension passes vNext-compliant data to the webview.
3.  **StabilityID for Navigation**:
    *   Use the deterministic `id` to map from the Viewer back to the source code in the editor.

---

## Success Criteria
- [ ] `packages/schema` is the only source of truth for data types.
- [ ] The Viewer contains zero logic for grouping Scenario Outlines or detecting Specifications from strings.
- [ ] Specifications are rendered with their own distinct UI treatment, separate from Gherkin Features.
- [ ] Real-time updates work smoothly via granular WebSocket events.
- [ ] All tests in `packages/vitest` pass using the new reporter.
