# LiveDoc Reporting Model v3 — API & Patching Guide (Fix Forward)

This document defines the **recommended API and patch/upsert semantics** for the v3 reporting model.

It assumes we can make breaking changes (not deployed yet) and will implement v3 end-to-end.

- Model reference: [REPORTER_MODEL_V3.md](REPORTER_MODEL_V3.md)
- Canonical TS types: [packages/schema/src/reporter-v3.ts](packages/schema/src/reporter-v3.ts)

## 1) Objectives

- Reporters send **definitions** once and stream **execution** updates frequently.
- All messages are **idempotent** (safe to resend).
- The server can store runs incrementally and broadcast realtime updates.
- The Viewer can update its store using simple upserts and execution patches.

## 2) Wire model: what gets sent

### Definition data (rarely changes)
- TestRun identity: `runId/project/environment/framework/timestamp`
- TestCase structure: documents + hierarchy + templates
- Outline example tables (`examples`) + template steps/rules

### Execution data (streams frequently)
- Non-outline execution: patch `test.execution`
- Outline execution: upsert `exampleResults` entries keyed by `(outlineId, rowId, testId)`

## 3) REST API (proposed)

These endpoints are designed to be small and composable.

### Start a run
`POST /api/v3/runs/start`

Request:
```json
{
  "project": "LiveDoc Project",
  "environment": "local",
  "framework": "xunit",
  "timestamp": "2026-01-09T12:00:00.000Z"
}
```

Response:
```json
{
  "protocolVersion": "3.0",
  "runId": "<generated>",
  "websocketUrl": "/ws"
}
```

Notes:
- Reporters should treat `runId` as the primary key for subsequent requests.

### Upsert a TestCase (document)
`POST /api/v3/runs/:runId/testcases`

Request:
```json
{
  "testCase": {
    "id": "Feature:Login",
    "style": "Feature",
    "path": "features/auth/Login.feature",
    "title": "Login",
    "description": "...",
    "tags": ["auth"],
    "statistics": {"total":0,"passed":0,"failed":0,"pending":0,"skipped":0},
    "tests": []
  }
}
```

Semantics:
- Upsert by `testCase.id`.
- The server merges fields (JSON merge patch semantics).
- The server ensures the run contains the document exactly once.

### Upsert a Test under a TestCase
`POST /api/v3/runs/:runId/tests`

Request:
```json
{
  "testCaseId": "Feature:Login",
  "test": {
    "id": "Scenario:Login:happy",
    "kind": "Scenario",
    "title": "Successful login",
    "description": "...",
    "execution": {"status":"pending","duration":0}
  }
}
```

Semantics:
- Upsert by `test.id`.
- Ensure the test appears in `testCase.tests`.

Notes:
- This endpoint is used for scenarios, outlines, rules, rule outlines, and standard tests.

### Upsert steps under a Scenario/ScenarioOutline
`POST /api/v3/runs/:runId/scenarios/:scenarioId/steps`

Request:
```json
{
  "steps": [
    {"id":"Step:1","kind":"Step","keyword":"given","title":"Given there are <start> cucumbers","execution":{"status":"pending","duration":0}},
    {"id":"Step:2","kind":"Step","keyword":"when","title":"When I eat <eat> cucumbers","execution":{"status":"pending","duration":0}}
  ]
}
```

Semantics:
- Upsert steps by id.

Recommended behavior:
- Replace the scenario’s `steps` list with the provided ordered list.
- Maintain uniqueness by `step.id`.

### Patch execution (non-outline)
`PATCH /api/v3/runs/:runId/tests/:testId/execution`

Request:
```json
{
  "status": "passed",
  "duration": 12
}
```

Semantics:
- Patch replaces the `execution` object for that test (merge patch on fields).
- Reporters may send partial patches (e.g. status first, then duration).

### Upsert outline example results (per-row + per-step)
`POST /api/v3/runs/:runId/outlines/:outlineId/example-results`

Request:
```json
{
  "results": [
    {
      "testId": "Step:1",
      "result": {"rowId": 7, "status": "passed", "duration": 3}
    },
    {
      "testId": "Step:2",
      "result": {"rowId": 7, "status": "failed", "duration": 1, "error": {"message":"boom","stack":"...","code":"...","lineNumber":42}}
    }
  ]
}
```

Semantics:
- Upsert by composite key `(outlineId, rowId, testId)`.
- Reporter may send results in any order.
- Later updates overwrite earlier ones.

Notes:
- `testId` points at the template node being executed:
  - ScenarioOutline: usually a `StepTest.id`
  - RuleOutline: a `RuleTest.id`
- `rowId` must match the outline’s `examples[].rows[].rowId` (and is unique across tables).

Table naming:
- `DataTable.name` is optional but recommended so the UI can label tables (e.g. "Examples", "Inputs").

### Complete a run
`POST /api/v3/runs/:runId/complete`

Request:
```json
{
  "status": "failed",
  "duration": 1234,
  "summary": {"total":10,"passed":9,"failed":1,"pending":0,"skipped":0}
}
```

Semantics:
- Server finalizes and persists the run.
- Server may recompute `summary`/`statistics` from known executions if reporter omitted them.

## 4) WebSocket events (proposed)

Events are optional if the Viewer polls, but recommended for realtime.
All events should be safe to receive multiple times.

### `run:v3:started`
```json
{"type":"run:v3:started","runId":"...","project":"...","environment":"...","framework":"xunit","timestamp":"..."}
```

### `testcase:upsert`
```json
{"type":"testcase:upsert","runId":"...","testCase":{...}}
```

### `test:upsert`
```json
{"type":"test:upsert","runId":"...","testCaseId":"...","test":{...}}
```

### `test:execution`
```json
{"type":"test:execution","runId":"...","testId":"...","patch":{"execution":{...}}}
```

### `outline:exampleResults`
```json
{"type":"outline:exampleResults","runId":"...","outlineId":"...","results":[...]} 
```

### `run:v3:completed`
```json
{"type":"run:v3:completed","runId":"...","status":"passed","duration":1234,"summary":{...}}
```

## 6. Patch semantics (recommended)

### Idempotency
All reporter messages should be safe to re-send.

- Upserts are keyed by stable IDs.
- Execution patches overwrite (do not merge arrays unless explicitly defined).

### Merge strategy
Use **JSON Merge Patch** semantics for object updates:
- missing fields leave existing values unchanged
- null explicitly clears a value

For arrays, define behavior explicitly per field:
- `tests[]`: server maintains uniqueness by `id`
- `steps[]`: server maintains uniqueness by `id`
- `exampleResults[]`: server maintains uniqueness by `(rowId,testId)`

## 5) Viewer store expectations (so patching is easy)

At minimum the Viewer should index:

- `testCasesById: Map<string, TestCase>`
- `testsById: Map<string, AnyTest>`
- `outlineResultsByKey: Map<string /* outlineId|rowId|testId */, ExecutionResult>`

This makes outline rendering a pure join:

- Template steps: from `ScenarioOutlineTest.steps[]`
- Selected row results: from `outlineResultsByKey`

## 6) Implementation notes / gotchas

- If your producer currently emits `protocolVersion: '2.0'`, update it to `'3.0'`.
- If you omit stats in early implementation, the server can compute them later, but IDs and rowIds must be correct.
- If you later want named example tables, add metadata to the table model; the execution join key remains the same.
- What is the canonical ID generation strategy (and where is it implemented) for stable cross-run IDs?
