# LiveDoc Reporting Model v1 — Implementer Guide (Fix Forward)

This document defines the **new reporting model** for LiveDoc.

It is intentionally simpler than the prior model: it focuses on **rendering execution results** in the Viewer / VS Code extension.

Canonical TypeScript types live in [packages/schema/src/reporter-v1.ts](packages/schema/src/reporter-v1.ts).

## 1) Design principles (read this first)

- Templates are never pre-bound: `title` and `description` are always the raw template strings.
- Highlighting/binding is UI-driven: the Viewer binds templates using example table data.
- Realtime is first-class: all updates must be safe to resend (idempotent upserts/patches).
- Code is shown only on error: code is carried on `ErrorInfo.code` and only present when an error exists.
- DocStrings are not special: they remain inline inside `description`.

## 2) The model (what objects exist)

### TestRunV1 (root envelope)
Represents one run.

Required:
- `protocolVersion: '1.0'`
- `runId`, `project`, `environment`, `framework`
- `timestamp` (ISO 8601), `duration` (ms), `status`, `summary`
- `documents: TestCase[]`

### TestCase (a document)
Represents a “top-level document” shown in the left navigation.

Discriminator:
- `style: 'Feature' | 'Specification' | 'Container'`

Required:
- `id` (stable), `style`, `title`, `tests[]`, `statistics`

Recommended:
- `path` (for grouping)
- `tags[]`
- `background` (Feature only)

### Test (a node that can execute)
Represents an executable node or template node:

- `ScenarioTest` (has `steps[]`)
- `StepTest` (has `keyword`)
- `ScenarioOutlineTest` (a Scenario shape + examples + exampleResults)
- `RuleTest`
- `RuleOutlineTest`
- `StandardTest`

All tests share:
- `id` (stable)
- `kind` discriminator
- `title` (template)
- optional `description` (template)
- optional `tags[]`, `dataTables[]`, `ruleViolations[]`
- `execution` (for non-outline execution; outline execution is in `exampleResults`)

### ExecutionResult
Represents the outcome of executing a specific thing.

Required:
- `status`, `duration`

Optional:
- `error` (only when failing)
- `attachments`
- `rowId` (only for outline-scoped results)

### ScenarioOutlineTest / RuleOutlineTest (critical)
Outlines are represented as:

1) A **single template** (title + step templates or rule template)
2) One or more **example tables** (`examples[]`)
3) A stream of **exampleResults[]** keyed by `(rowId, testId)`

The UI uses table row values to bind the templates on demand.

## 3) Required invariants (non-negotiable)

### Stable IDs
IDs are what make patching possible.

- `TestCase.id` MUST be stable across runs.
- `Test.id` MUST be stable across runs.
- `StepTest.id` MUST be stable across runs.

Step IDs must remain unique even if multiple steps have identical titles.
Recommendation: include step index/position in the ID hash.

### Outline RowId uniqueness
Row IDs are integers.

Invariant for a given outline:
- `Row.rowId` MUST be unique across ALL example tables for that outline.

If multiple tables exist, allocate RowId in a single monotonic row-space (virtual concatenation).

### Outline execution join key
Every outline execution update MUST identify:

- `rowId` (which example row executed)
- `testId` (which template node executed)

That pair is how the Viewer renders per-row/per-step status.

## 4) How to represent each feature

### Feature / background

- Create a `FeatureTestCase`.
- Put scenarios/outlines into `testCase.tests`.
- If a Gherkin Background exists, set `testCase.background` to a `ScenarioTest` (with `steps[]`).

### Scenario

- `ScenarioTest.title` is the scenario title (template).
- `ScenarioTest.steps[]` are the step templates.
- Step execution updates patch `step.execution`.

### Scenario Outline

- `ScenarioOutlineTest.title` is the outline title (template).
- `ScenarioOutlineTest.steps[]` are the step templates.
- `ScenarioOutlineTest.examples[]` contains the example tables.
- `ScenarioOutlineTest.exampleResults[]` streams per-row/per-step results.

Row-level status is derived by aggregating all step results for that row.

### Rule / Rule Outline

- `RuleTest` is a single template.
- `RuleOutlineTest` mirrors ScenarioOutlineTest but uses `testId` pointing at the rule template.

### Tables

- `DataTable` is used for:
  - Step tables (attached via `test.dataTables[]`)
  - Outline examples (attached via `outline.examples[]`)

`DataTable.name` is optional but recommended when a UI should label the table.

Typed values are represented as `TypedValue`.

## 5) Canonical JSON examples

These examples show the intended wire shape (camelCase). Producers in other languages should serialize to this shape.

### Example: simple scenario

```json
{
  "protocolVersion": "1.0",
  "runId": "run-123",
  "project": "LiveDoc Project",
  "environment": "local",
  "framework": "xunit",
  "timestamp": "2026-01-09T12:00:00.000Z",
  "duration": 0,
  "status": "running",
  "summary": {"total":0,"passed":0,"failed":0,"pending":0,"skipped":0},
  "documents": [
    {
      "id": "Feature:Auth/Login",
      "style": "Feature",
      "path": "features/auth/Login.feature",
      "title": "Login",
      "statistics": {"total":0,"passed":0,"failed":0,"pending":0,"skipped":0},
      "tests": [
        {
          "id": "Scenario:Auth/Login:happy",
          "kind": "Scenario",
          "title": "Successful login",
          "execution": {"status":"running","duration":0},
          "steps": [
            {
              "id": "Step:Auth/Login:happy:0",
              "kind": "Step",
              "keyword": "given",
              "title": "Given a user 'Alice' exists",
              "execution": {"status":"passed","duration":5}
            }
          ]
        }
      ]
    }
  ]
}
```

### Example: scenario outline (template + examples + per-row/per-step results)

```json
{
  "id": "ScenarioOutline:Eat",
  "kind": "ScenarioOutline",
  "title": "Eating",
  "execution": {"status":"pending","duration":0},
  "steps": [
    {"id":"Step:Eat:0","kind":"Step","keyword":"given","title":"Given there are <start> cucumbers","execution":{"status":"pending","duration":0}},
    {"id":"Step:Eat:1","kind":"Step","keyword":"when","title":"When I eat <eat> cucumbers","execution":{"status":"pending","duration":0}},
    {"id":"Step:Eat:2","kind":"Step","keyword":"then","title":"Then I should have <left> cucumbers","execution":{"status":"pending","duration":0}}
  ],
  "examples": [
    {
      "name": "Examples",
      "headers": ["start","eat","left"],
      "rows": [
        {"rowId": 0, "values": [{"value": 12,"type":"number"},{"value": 5,"type":"number"},{"value": 7,"type":"number"}]},
        {"rowId": 1, "values": [{"value": 20,"type":"number"},{"value": 5,"type":"number"},{"value": 15,"type":"number"}]}
      ]
    }
  ],
  "exampleResults": [
    {"testId":"Step:Eat:0","result":{"rowId":0,"status":"passed","duration":1}},
    {"testId":"Step:Eat:1","result":{"rowId":0,"status":"passed","duration":1}},
    {"testId":"Step:Eat:2","result":{"rowId":0,"status":"passed","duration":1}},

    {"testId":"Step:Eat:0","result":{"rowId":1,"status":"passed","duration":1}},
    {"testId":"Step:Eat:1","result":{"rowId":1,"status":"failed","duration":1,"error":{"message":"boom","stack":"...","code":"...","lineNumber":42}}}
  ],
  "statistics": {"total":2,"passed":1,"failed":1,"pending":0,"skipped":0}
}
```

## 6) What to patch vs what to send once

- Send once / rarely:
  - document structure, titles/descriptions/tags
  - step templates
  - example tables

- Patch often:
  - `execution` for non-outline nodes
  - `exampleResults` entries for outlines
  - `summary` / `statistics` updates (if computed incrementally)

API shape and event examples are defined in [REPORTER_MODEL_V1_API.md](REPORTER_MODEL_V1_API.md).
