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

// Lowercase in the model; UI can capitalize for display.
export type StepKeyword = 'given' | 'when' | 'then' | 'and' | 'but';

export interface TypedValue {
  // The producer must emit JSON-serializable values.
  // - date: ISO 8601 string (e.g. "2026-01-04T12:34:56.000Z")
  // - object: JSON object/array
  // - undefined: should be avoided over the wire; prefer omitting the field or using null.
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'null' | 'undefined';
  displayFormat?: string; // e.g. for dates or currency
}

export interface Binding {
  // Ordered placeholder bindings (producer-defined order; UI preserves it).
  // Example: [{ name: "user", value: { value: "Alice", type: "string" } }]
  variables: Array<{ name: string; value: TypedValue }>;
  // Optional reference back to the example row that produced this binding.
  rowId?: string;
}

export interface Row {
  // Deterministic row id for realtime systems (avoids relying on arrival/order).
  rowId: string;
  values: TypedValue[];
}

export interface DataTable {
  headers: string[];
  rows: Row[];
}

export interface ExampleTable {
  name: string;
  description?: string;
  headers: string[];
  rows: Row[];
}

export interface Attachment {
  id: string;
  kind: 'image' | 'screenshot' | 'file';
  title?: string;
  mimeType: string;

  // How the UI retrieves the attachment.
  // - uri: preferred for server-hosted assets
  // - base64: optional for inline/small payloads
  uri?: string;
  base64?: string;
}

export interface ExecutionResult {
  status: Status;
  duration: number; // Duration of this specific node
  error?: {
    message: string;
    stack?: string;
    diff?: string;
  };

  // Future-proof: primarily screenshots, but can include other artifacts.
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
// Core Nodes
// =============================================================================

export interface Node {
  id: string;
  // Kind is explicit for known types; consumers should ignore unknown kinds gracefully.
  kind: string;

  // Optional source path for grouping (recommended: file path relative to repo/project root).
  // Example: "features/auth/Login.feature" or "src/specs/UserLogin.Spec.ts".
  path?: string;

  // IMPORTANT: title is a TEMPLATE.
  // If `binding` exists, the UI applies binding to `title` to render/format/highlight values.
  title: string;
  description?: string;
  tags?: string[];
  
  // Every node has its own execution result (status, duration, error)
  execution: ExecutionResult;

  // Non-fatal issues detected by LiveDoc rules (e.g., missing Given, ambiguous step patterns).
  // These should surface in dashboards as "warnings".
  ruleViolations?: RuleViolation[];

  // Optional binding for templated titles (steps/rules/examples, etc.).
  binding?: Binding;
}

export interface Container<TChild extends Node = Node> extends Node {
  // Containers have aggregate statistics
  summary: Statistics;
  
  // Generic children property for recursive rendering
  children: TChild[];
}

export interface Outline<TTemplate extends Node, TExample extends Node> extends Node {
  // Outlines also have aggregate statistics
  summary: Statistics;

  // The definition with placeholders (e.g. "Given <user>")
  template: TTemplate;
  
  // The generated examples (renamed from children for clarity)
  examples: TExample[];
  
  // The source data tables
  tables: ExampleTable[];
}

// =============================================================================
// Kinds (Known + Forward-Compatible)
// =============================================================================

export const SpecKind = {
  Feature: 'Feature',
  Background: 'Background',
  Scenario: 'Scenario',
  ScenarioOutline: 'ScenarioOutline',
  Step: 'Step',
  Specification: 'Specification',
  Rule: 'Rule',
  RuleOutline: 'RuleOutline',
  Suite: 'Suite',
  Test: 'Test'
} as const;

export type KnownKind = typeof SpecKind[keyof typeof SpecKind];

// =============================================================================
// Gherkin Pattern
// =============================================================================

export interface Feature extends Container<Scenario | ScenarioOutline> {
  kind: 'Feature';
  background?: Scenario;
}

export interface Scenario extends Container<Step> {
  kind: 'Scenario';
}

export interface ScenarioOutline extends Outline<Scenario, Scenario> {
  kind: 'ScenarioOutline';
}

export interface Step extends Node {
  kind: 'Step';
  keyword: StepKeyword;
  docString?: string;
  dataTable?: DataTable;
  code?: string;
  
  // The values extracted from the step text (e.g. "Given 5 cucumbers" -> 5)
  values?: TypedValue[]; 
}

// =============================================================================
// Specification Pattern
// =============================================================================

export interface Specification extends Container<Rule | RuleOutline> {
  kind: 'Specification';
}

export interface Rule extends Node {
  kind: 'Rule';
  code?: string; // The code body of the rule
}

export interface RuleOutline extends Outline<Rule, Rule> {
  kind: 'RuleOutline';
}

// =============================================================================
// Suite Pattern (Standard Tests)
// =============================================================================

export interface TestSuite extends Container<TestSuite | Test> {
  kind: 'Suite';
}

export interface Test extends Node {
  kind: 'Test';
  code?: string;
}

// =============================================================================
// Root Envelope (Run) + Navigation Hierarchy
// =============================================================================

export type Framework = 'vitest' | 'xunit' | 'mocha' | 'jest';

export interface TestRun {
  // Protocol versioning (distinct from implementation version).
  protocolVersion: '2.0';

  // Identification / grouping
  runId: string;
  project: string;
  environment: string;
  framework: Framework;

  // Timing
  timestamp: string; // ISO 8601
  duration: number; // milliseconds
  status: Status;

  // Summary (computed incrementally by the server based on known children)
  summary: Statistics;

  // UI-ready documents (no projection: features/specifications/suites are first-class nodes)
  documents: Array<Feature | Specification | TestSuite>;
}

export interface HistoryRun {
  runId: string;
  timestamp: string;
  status: Status | string;
  summary?: Statistics;
}

export interface EnvironmentNode {
  name: string;
  latestRun?: TestRun;
  historyCount: number;
  history: HistoryRun[];
}

export interface ProjectNode {
  name: string;
  environments: EnvironmentNode[];
}

export interface ProjectHierarchyResponse {
  projects: ProjectNode[];
}

// =============================================================================
// Realtime Events (NodeId-based)
// =============================================================================

export type WebSocketEvent =
  | { type: 'run:started'; runId: string; project: string; environment: string; framework: Framework; timestamp: string }
  | { type: 'node:added'; runId: string; parentId?: string; node: Node }
  | { type: 'node:updated'; runId: string; nodeId: string; patch: Partial<Node> }
  | { type: 'node:removed'; runId: string; nodeId: string }
  | { type: 'run:updated'; runId: string; patch: Partial<Pick<TestRun, 'status' | 'duration' | 'summary'>> }
  | { type: 'run:completed'; runId: string; status: Status; summary: Statistics; duration: number }
  | { type: 'run:deleted'; runId: string }
  | { type: 'error'; message: string };

export type WebSocketClientMessage =
  | { type: 'subscribe'; runId?: string; project?: string; environment?: string }
  | { type: 'unsubscribe'; runId?: string; project?: string; environment?: string }
  | { type: 'ping' };
