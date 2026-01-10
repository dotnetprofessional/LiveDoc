// =============================================================================
// Reporter Model v3 (Draft)
// =============================================================================
//
// This is a TypeScript representation of the new simplified reporting model
// currently prototyped in dotnet/xunit/src/REPORTER_MODEL_NET.cs.
//
// Design goals:
// - Report what executed (not all extraction details)
// - UI performs binding/highlighting using template titles + example tables
// - Support realtime patching/upserting by stable ids
// - Outline per-row + per-step results via (rowId, testId)
//
// IMPORTANT:
// - `ExecutionAggregateResult` is intentionally omitted from the wire model.
//   Aggregates can be computed by the server/UI from child results.

// =============================================================================
// Value Objects
// =============================================================================

export type Status =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped'
  | 'timedOut'
  | 'cancelled';

export type StepKeyword = 'given' | 'when' | 'then' | 'and' | 'but';

export interface TypedValue {
  // Producer must emit JSON-serializable values.
  // - date: ISO 8601 string
  // - object: JSON object/array
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'null' | 'undefined';
  displayFormat?: string;
}

export interface Row {
  // RowId is an integer index within the outline's examples row-space.
  // Invariant: RowId is unique across ALL example tables for a given outline.
  rowId: number;
  values: TypedValue[];
}

export interface DataTable {
  // Optional display name for the table (e.g. "Examples", "Inputs", "Pricing").
  // The UI may show this as the table title.
  name?: string;
  headers: string[];
  rows: Row[];
}

export interface Attachment {
  id: string;
  kind: 'image' | 'screenshot' | 'file';
  title?: string;
  mimeType: string;
  uri?: string;
  base64?: string;
}

export interface ErrorInfo {
  message: string;
  stack?: string;

  // Optional: show code only on error.
  code?: string;
  lineNumber?: number;
}

export interface ExecutionResult {
  // For outlines: the RowId of the example row this result corresponds to.
  // For non-outlines: omit or use 0.
  rowId?: number;

  status: Status;
  duration: number; // milliseconds
  error?: ErrorInfo;
  attachments?: Attachment[];
}

export interface RuleViolation {
  rule: string;
  message: string;
  title?: string;
  errorId?: number;
}

export interface Statistics {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
}

// =============================================================================
// Kinds / Styles
// =============================================================================

export const TestStyles = {
  Feature: 'Feature',
  Specification: 'Specification',
  Container: 'Container',
} as const;

export type TestStyle = typeof TestStyles[keyof typeof TestStyles];

export const TestKinds = {
  Scenario: 'Scenario',
  ScenarioOutline: 'ScenarioOutline',
  Step: 'Step',
  Rule: 'Rule',
  RuleOutline: 'RuleOutline',
  Test: 'Test',
} as const;

export type TestKind = typeof TestKinds[keyof typeof TestKinds];

// =============================================================================
// Core Types
// =============================================================================

export interface BaseTest {
  // Stable across runs.
  // Recommended: hash of fully qualified name + source location.
  id: string;

  kind: TestKind | string;

  // Raw template title/description. UI binds/highlights.
  title: string;
  description?: string;

  tags?: string[];

  // Any tables attached to the test (e.g. step tables).
  dataTables?: DataTable[];

  // Execution for this test instance.
  execution: ExecutionResult;

  ruleViolations?: RuleViolation[];
}

export interface StepTest extends BaseTest {
  kind: 'Step';
  keyword: StepKeyword;
}

export interface ScenarioTest extends BaseTest {
  kind: 'Scenario';
  steps: StepTest[];
}

export interface RuleTest extends BaseTest {
  kind: 'Rule';
}

export interface StandardTest extends BaseTest {
  kind: 'Test';
}

// Shared shapes (avoid kind-literal inheritance issues)
export interface ScenarioShape extends BaseTest {
  steps: StepTest[];
}

export interface RuleShape extends BaseTest {
  // No extra fields today; exists for symmetry and future evolution.
}

// Outline example result for realtime patching.
// This is the minimal join key needed for per-row/per-step statuses.
export interface ExampleResult {
  // References the template node id the result applies to.
  // For ScenarioOutline: usually a StepTest.id, and optionally ScenarioOutline.id
  // For RuleOutline: the RuleTest.id
  testId: string;

  result: ExecutionResult; // includes rowId
}

export interface ScenarioOutlineTest extends ScenarioShape {
  kind: 'ScenarioOutline';

  // Example tables (data only). UI binds into template titles.
  examples: DataTable[];

  // Per-row + per-test results for this outline.
  exampleResults: ExampleResult[];

  // Aggregate stats across all example executions.
  statistics: Statistics;
}

export interface RuleOutlineTest extends RuleShape {
  kind: 'RuleOutline';

  examples: DataTable[];
  exampleResults: ExampleResult[];
  statistics: Statistics;
}

export type AnyTest =
  | StepTest
  | ScenarioOutlineTest
  | ScenarioTest
  | RuleOutlineTest
  | RuleTest
  | StandardTest
  | BaseTest;

export interface BaseTestCase {
  id: string;
  style: TestStyle | string;

  // Source path for grouping.
  path?: string;

  title: string;
  description?: string;
  tags?: string[];

  // Top-level tests within the document.
  tests: AnyTest[];

  // Optional background (Feature-only).
  background?: AnyTest;

  // Aggregate stats across all contained tests.
  statistics: Statistics;

  ruleViolations?: RuleViolation[];
}

export interface FeatureTestCase extends BaseTestCase {
  style: 'Feature';
}

export interface SpecificationTestCase extends BaseTestCase {
  style: 'Specification';
}

export interface ContainerTestCase extends BaseTestCase {
  style: 'Container';
}

export type TestCase = FeatureTestCase | SpecificationTestCase | ContainerTestCase | BaseTestCase;

// =============================================================================
// Root Envelope
// =============================================================================

export type Framework = 'vitest' | 'xunit' | 'mocha' | 'jest' | string;

export interface TestRunV3 {
  protocolVersion: '3.0';

  runId: string;
  project: string;
  environment: string;
  framework: Framework;

  timestamp: string; // ISO 8601
  duration: number; // ms
  status: Status;

  summary: Statistics;

  documents: TestCase[];
}
