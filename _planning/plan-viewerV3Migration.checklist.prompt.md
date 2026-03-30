> **Historical:** This was the original V3 migration plan. The protocol has since been renamed to V1 for the first public release.

## Viewer/Server v3 Migration — Execution Checklist (Clean Break)

This is a concrete, implementation-ready checklist aligned to REPORTER_MODEL_V3.md and REPORTER_MODEL_V3_API.md.

### A. Schema + Wire Contracts
- [ ] Confirm v3 types are canonical in `packages/schema/src/reporter-v3.ts`.
- [ ] Confirm stable IDs are producer-owned using the existing deterministic technique (e.g. `generateStabilityId` in `packages/schema/src/stability.ts`).
  - Server MUST treat `TestCase.id`, `Test.id`, `StepTest.id` as opaque.
  - Server MUST NOT generate/transform IDs (only `runId` is server-generated).
- [ ] Navigation/selection key is a single value: use the producer `id` strings directly (colon-separated + traversable by prefix).
  - Documents: `TestCase.id`
  - Tests/steps/templates: `Test.id`
- [ ] Define runtime validators for v3 API payloads and WS events (Zod recommended) in `packages/schema` or `packages/server`.

### B. Server API (REST) — v3 Only
Implement these endpoints (delete/disable v2 endpoints early):

- [ ] `POST /api/v3/runs/start`
  - Input: `{ project, environment, framework, timestamp }`
  - Output: `{ protocolVersion:'3.0', runId, websocketUrl:'/ws' }`

- [ ] `POST /api/v3/runs/:runId/testcases`
  - Input: `{ testCase: TestCase }`
  - Semantics: upsert by `testCase.id` using JSON Merge Patch for objects.

- [ ] `POST /api/v3/runs/:runId/tests`
  - Input: `{ testCaseId: string, test: AnyTest }`
  - Semantics:
    - upsert by `test.id`
    - ensure `test.id` is present in `testCase.tests` (document owns membership/order)

- [ ] `POST /api/v3/runs/:runId/scenarios/:scenarioId/steps`
  - Input: `{ steps: StepTest[] }`
  - Semantics:
    - upsert steps by id
    - replace the scenario’s `steps` list with the provided ordered list

- [ ] `PATCH /api/v3/runs/:runId/tests/:testId/execution`
  - Input: merge-patch `{ status?, duration?, error?, attachments? }`
  - Semantics:
    - merge patch fields into `test.execution`
    - server recomputes aggregates impacted by this test

- [ ] `POST /api/v3/runs/:runId/outlines/:outlineId/example-results`
  - Input: `{ results: Array<{ testId: string, result: ExecutionResult /* includes rowId */ }> }`
  - Semantics:
    - upsert by composite key `(outlineId,rowId,testId)`
    - later updates overwrite earlier ones
    - server recomputes aggregates impacted by this outline row

- [ ] `POST /api/v3/runs/:runId/complete`
  - Input: `{ status, duration, summary? }`
  - Semantics:
    - finalize run
    - if `summary` omitted/partial, server computes it from known executions

### C. Server Store + Aggregation (Streaming)
- [ ] Store is patch-friendly and indexed:
  - `testCasesById: Map<string, TestCase>`
  - `testsById: Map<string, AnyTest>`
  - `outlineResultsByKey: Map<string /* outlineId|rowId|testId */, ExecutionResult>`
- [ ] Keep outline-result join keys explicit and non-ambiguous (pipe-separated is fine). Navigation IDs remain colon-separated.
- [ ] Aggregation rules are server-authoritative:
  - Run summary: `TestRunV3.summary`
  - Document stats: `TestCase.statistics`
  - Outline row status derived by aggregating step results per `(outlineId,rowId)`
- [ ] Decide incremental update strategy:
  - Minimum viable: recompute aggregates for a document/run on each update.
  - Optimized: maintain counters and update only deltas.

### D. WebSocket Events — v3 Only
- [ ] Implement and broadcast these events (idempotent):
  - `run:v3:started`
  - `testcase:upsert`
  - `test:upsert`
  - `test:execution`
  - `outline:exampleResults`
  - `run:v3:completed`
- [ ] Keep existing subscribe/unsubscribe client messages (`packages/server/src/websocket.ts` already supports this pattern).

### E. Viewer Data Layer (Zustand) — v3
- [ ] Replace v2 node-tree normalization with v3 indexes:
  - `run?: TestRunV3`
  - `testCasesById`, `testsById`, `outlineResultsByKey`
  - selection: `selectedTestCaseId`, `selectedTestId`, `selectedOutlineRowId?`
- [ ] Deep linking/navigate uses the single selection key (`selectedTestId`), which is already hierarchical and globally unique.
- [ ] Host ↔ Viewer navigation contract is consistent across Web + VS Code:
  - Host → Viewer message: `{ command: 'livedoc:navigate', runId?: string, id: string, kind?: 'testCase' | 'test', rowId?: number }`
  - Viewer routes by `id` (single stable key), optionally selecting `rowId` for outlines.
- [ ] REST bootstrap loads latest run for project/environment.
- [ ] WS handler applies v3 upserts/patches directly (no tree-walking).

### F. Viewer Rendering — v3 Semantics
- [ ] Navigation tree renders from `documents: TestCase[]` (optional grouping by `path`).
- [ ] Scenario view renders `ScenarioTest.steps[]` and uses `step.execution`.
- [ ] Outline view:
  - templates from `ScenarioOutlineTest.steps[]`
  - row values from `examples[].rows[]`
  - results from `outlineResultsByKey`
  - row status computed by aggregating step results for that row

### G. VS Code Extension Migration
The extension has two surfaces that must be migrated:

- [ ] Embedded Viewer webview (`packages/vscode/src/viewer/ViewerPanel.ts`)
  - Update navigation message contract: replace `navigateTo(nodeId)` with v3 `id` (single colon-separated key).
  - Send `{ command: 'livedoc:navigate', id }` (and `runId` when needed), matching the web Viewer contract.

- [ ] Sidebar outline tree (`packages/vscode/src/ExecutionResultOutline/ExecutionResultOutlineProvider.ts`)
  - Replace v2 `TestRun`/`Node` usage with v3 `TestRunV3`/`TestCase`/`AnyTest`.
  - Update WS event handling from `run:started|run:completed|node:*` to v3 events.
  - Update REST calls from `/api/projects/.../latest` to the new v3 endpoint(s) used by the Viewer.

### H. Cleanup Targets (Delete Early)
- [ ] Server: remove v2 endpoints and legacy feature/scenario/step endpoints.
- [ ] Viewer: remove v2 normalization/index builders and node-tree-only components.
- [ ] Schema: remove/stop exporting v2 WS event unions once server/viewer/extension compile.

### Acceptance Criteria (Definition of Done)
- [ ] A producer can stream a run using only v3 endpoints/events.
- [ ] Server persists run incrementally and shows correct aggregates mid-run.
- [ ] Viewer updates in realtime and correctly renders outlines via `(outlineId,rowId,testId)` join.
- [ ] VS Code sidebar outline + embedded Viewer both work against the same v3 server.
- [ ] No v2 endpoints/events/types remain in the mainline build.
