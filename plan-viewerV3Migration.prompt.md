## Plan: Migrate Viewer/Server to Reporter v3 (Clean Break)

Because this isn’t deployed to prod, keep the transition simple: remove v2 concepts and move everything (server + viewer + schema) to v3 as the only supported model. Keep the work incremental by landing small, shippable steps, but avoid dual-protocol routing, adapters, or “support both” code paths.

Decisions locked in:
- Stable IDs remain producer-owned (same technique as today, e.g. deterministic hashing via `generateStabilityId` in `@livedoc/schema`). The server treats IDs as opaque and never rewrites them.
- Stats/summary are aggregated on the server while streaming (server is the source of truth for what it has received).
- The VS Code extension is migrated in the same workstream; it should reuse the Viewer web UI (already embedded via `dist/viewer`) and update its sidebar tree + WS client to v3 events.

Navigation/selection key:
- Use a single, colon-separated, traversable key for selection and deep links: the producer-generated `id` values.
	- Documents: `TestCase.id`
	- Executable/template nodes: `Test.id` (including `StepTest.id`)
- This works because the current stability-id technique produces hierarchical IDs where children are prefixed by `parentId + ':' + hash`.
- Viewer/server should treat IDs as opaque strings; any traversal is best-effort and must not assume more than “parent prefix up to last ':'” when needed.
- Even with traversable keys, keeping `testsById` / `testCasesById` maps in memory is still recommended for efficient lookups; the key design simply makes debugging, linking, and navigation simpler.

Cross-host consistency (Web Viewer + VS Code webview):
- Define a single navigation contract that both hosts use.
- The Viewer app routes by a single `id` string (producer-generated stable id).
- VS Code and the web host both deep-link using the same UI state shape (no special-case “nodeId/featureId/scenarioId” paths).

Proposed host→Viewer message contract (stable):
- `command: 'livedoc:navigate'`
	- `runId?: string` (optional; when omitted, the Viewer uses the currently selected/latest run)
	- `id: string` (required; the single colon-separated stable id for the target)
	- `kind?: 'testCase' | 'test'` (optional hint; Viewer can infer by lookup)
	- `rowId?: number` (optional; for outlines, selects an example row)

Proposed Viewer→host message contract (optional but recommended for VS Code parity):
- `command: 'livedoc:revealSource'`
	- `id: string` (stable id)
	- `path?: string` and `line?: number` (when the Viewer knows source mapping)

### Steps
1. Define the v3 contract as code (schema-first)
	- Ensure `packages/schema/src/reporter-v3.ts` is the single canonical source for v3 types.
	- Add Zod validators for the v3 REST payloads and WS events (only for what the server accepts on the wire).
	- Document invariants the producer must uphold:
	  - Stable IDs for `TestCase.id`, `Test.id`, `StepTest.id` (same deterministic strategy as today).
	  - Outline `rowId` uniqueness across all example tables for a given outline.

2. Replace the server API with v3 endpoints only
	- Implement the v3 REST surface from `REPORTER_MODEL_V3_API.md` under `packages/server/src/api`.
	- Remove v2 endpoints and “legacy support” endpoints early to prevent accidental usage.
	- Implement v3 WS events only (run started, testcase upsert, test upsert, execution patch, outline exampleResults, run completed).

3. Implement a v3-native server store
	- Store `TestRunV3` incrementally, optimized for patching:
	  - `testCasesById: Map<string, TestCase>`
	  - `testsById: Map<string, AnyTest>`
	  - `outlineResultsByKey: Map<string /* outlineId|rowId|testId */, ExecutionResult>`
	 - Apply JSON Merge Patch semantics for object updates and explicit array behaviors (replace ordered lists where appropriate; maintain uniqueness by keys).
	 - Aggregate stats as updates arrive:
		 - Maintain `TestRunV3.summary`.
		 - Maintain `TestCase.statistics` (document-level rollups).
		 - For outlines, compute row status by aggregating step results per row and roll that into the outline/test and document aggregates.
	- Persist the run in the new shape (no v2 node-tree persistence).

4. Replace the viewer data layer with a v3 store
	- Create a v3 Zustand store shape aligned with the server indexes (maps + selection state).
	- Implement v3 bootstrap via REST (start/run load) and realtime updates via WS events.
	- Delete v2 normalization/index building logic as you replace it, rather than keeping it around.

5. Refactor viewer rendering to v3 semantics
	- Navigation renders from `documents: TestCase[]` (and optional `path` grouping).
	- Scenario rendering is direct from `ScenarioTest.steps[]` and their `execution`.
	- Outline rendering is a pure join:
	  - templates: `ScenarioOutlineTest.steps[]`
	  - rows: `ScenarioOutlineTest.examples[].rows[]`
	  - results: `outlineResultsByKey`
	- Compute row-level status by aggregating step results per `(outlineId,rowId)`.

6. Cleanup and delete redundant code
	- Remove v2 server store + persistence + ws events.
	- Remove v2 viewer routes/components/utilities that assume node trees.
	- Remove unused schema exports/types for v2 once server/viewer compile clean.

### Further Considerations
1. VS Code extension UX: replace `navigateTo(nodeId)` with a v3-compatible navigation key (`testCaseId` + `testId`, or a single `testId` if globally unique in the UI).
2. Server rollups: define exact aggregation rules for outlines (row status derivation) and when to recompute from scratch vs incrementally update.
3. Outline result join keys: keep the internal `(outlineId,rowId,testId)` map key explicit (e.g. pipe-separated) even if navigation IDs are colon-separated, to avoid ambiguous parsing of `testId` which itself contains colons.
