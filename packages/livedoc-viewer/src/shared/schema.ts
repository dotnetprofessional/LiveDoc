/**
 * LiveDoc Unified Schema
 * Shared types for all LiveDoc reporters and the viewer
 * Version 1.0
 */

// =============================================================================
// Core Enums
// =============================================================================

export type Framework = 'vitest' | 'xunit' | 'mocha' | 'jest';
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'completed';
export type StepType = 'Given' | 'When' | 'Then' | 'and' | 'but' | 'Background';
export type ScenarioType = 'Scenario' | 'ScenarioOutline' | 'Background';

// =============================================================================
// Statistics
// =============================================================================

export interface Statistics {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  duration: number;  // milliseconds
}

// =============================================================================
// Rule Violations
// =============================================================================

export interface RuleViolation {
  rule: string;
  message: string;
  title?: string;
}

// =============================================================================
// Error Information
// =============================================================================

export interface ErrorInfo {
  message: string;
  stack?: string;
  expected?: string;
  actual?: string;
  diff?: string;
  filename?: string;
  line?: number;
  column?: number;
}

// =============================================================================
// Step
// =============================================================================

export interface Step {
  id: string;
  type: StepType;
  title: string;
  displayTitle?: string;    // Formatted title for display
  rawTitle?: string;        // Original title with placeholders
  status: TestStatus;
  duration: number;         // milliseconds
  sequence?: number;        // Order within scenario
  error?: ErrorInfo;
  
  // Data
  docString?: string;
  docStringRaw?: string;    // Original docstring before binding
  dataTable?: DataTableRow[];
  values?: unknown[];       // Parsed values from title
  valuesRaw?: string[];     // Original value strings
  
  // Validation
  ruleViolations?: RuleViolation[];
  
  // Code
  code?: string;            // The step implementation code
}

export interface DataTableRow {
  [key: string]: string;
}

// =============================================================================
// Scenario
// =============================================================================

export interface Scenario {
  id: string;
  type: ScenarioType;
  title: string;
  displayTitle?: string;    // Formatted title for display
  description?: string;
  rawDescription?: string;  // Original description
  tags?: string[];
  status: TestStatus;
  duration: number;
  sequence?: number;        // Order within feature
  
  steps: Step[];
  
  // Validation
  ruleViolations?: RuleViolation[];
  
  // Statistics
  statistics?: Statistics;
  
  // For ScenarioOutline examples
  exampleIndex?: number;    // Which example (1, 2, 3...)
  exampleValues?: Record<string, unknown>;  // The parameter values
  exampleValuesRaw?: Record<string, string>;  // Original string values
  outlineId?: string;       // Reference to parent ScenarioOutline
  
  // Code
  code?: string;            // The scenario test code
}

// =============================================================================
// Scenario Outline (container for examples)
// =============================================================================

export interface ScenarioOutline {
  id: string;
  type: 'ScenarioOutline';
  title: string;
  description?: string;
  tags?: string[];
  status: TestStatus;
  duration: number;
  
  // Template steps (with placeholders)
  templateSteps: Step[];
  
  // Example table headers
  exampleHeaders: string[];
  
  // Individual examples (each is a Scenario)
  examples: Scenario[];
}

// =============================================================================
// Feature
// =============================================================================

export interface Feature {
  id: string;
  title: string;
  displayTitle?: string;    // Formatted title for display
  description?: string;
  rawDescription?: string;  // Original description
  filename: string;
  tags?: string[];
  status: TestStatus;
  duration: number;
  sequence?: number;        // Order within run
  
  background?: Scenario;
  scenarios: (Scenario | ScenarioOutline)[];
  
  // Validation
  ruleViolations?: RuleViolation[];
  
  statistics: Statistics;
}

// =============================================================================
// Non-BDD Suite (for regular tests)
// =============================================================================

export interface TestSuite {
  id: string;
  title: string;
  filename: string;
  status: TestStatus;
  duration: number;
  
  tests: Test[];
  suites: TestSuite[];  // Nested suites
  
  statistics: Statistics;
}

export interface Test {
  id: string;
  title: string;
  status: TestStatus;
  duration: number;
  error?: ErrorInfo;
}

// =============================================================================
// Test Run (Complete Results)
// =============================================================================

export interface TestRun {
  // Schema version
  $schema?: string;
  version: '1.0';
  
  // Identification
  runId: string;
  project: string;
  environment: string;
  framework: Framework;
  
  // Timing
  timestamp: string;        // ISO 8601
  duration: number;         // milliseconds
  status: TestStatus;
  
  // Summary
  summary: Statistics;
  
  // Results
  features: Feature[];
  suites: TestSuite[];      // Non-BDD tests
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/** POST /api/runs/start */
export interface StartRunRequest {
  project: string;
  environment: string;
  framework: Framework;
  timestamp?: string;       // Defaults to server time
}

export interface StartRunResponse {
  runId: string;
  websocketUrl: string;
}

/** POST /api/runs/:runId/features */
export interface PostFeatureRequest {
  id: string;
  title: string;
  displayTitle?: string;
  description?: string;
  rawDescription?: string;
  filename: string;
  tags?: string[];
  status: TestStatus;
  sequence?: number;
  ruleViolations?: RuleViolation[];
}

/** POST /api/runs/:runId/scenarios */
export interface PostScenarioRequest {
  featureId: string;
  id: string;
  type: ScenarioType;
  title: string;
  displayTitle?: string;
  description?: string;
  rawDescription?: string;
  tags?: string[];
  status: TestStatus;
  sequence?: number;
  ruleViolations?: RuleViolation[];
  
  // For ScenarioOutline examples
  outlineId?: string;
  exampleIndex?: number;
  exampleValues?: Record<string, unknown>;
  exampleValuesRaw?: Record<string, string>;
  
  // Template steps for ScenarioOutline (with placeholders)
  steps?: { type: StepType; title: string; rawTitle?: string }[];
}

/** POST /api/runs/:runId/steps */
export interface PostStepRequest {
  scenarioId: string;
  id: string;
  type: StepType;
  title: string;
  displayTitle?: string;
  rawTitle?: string;
  status: TestStatus;
  duration: number;
  sequence?: number;
  error?: ErrorInfo;
  
  // Data
  docString?: string;
  docStringRaw?: string;
  dataTable?: DataTableRow[];
  values?: unknown[];
  valuesRaw?: string[];
  
  // Validation
  ruleViolations?: RuleViolation[];
  
  // Code
  code?: string;
}

/** POST /api/runs/:runId/complete */
export interface CompleteRunRequest {
  status: TestStatus;
  duration: number;
  summary: Statistics;
}

/** POST /api/runs (batch mode - complete results) */
export type PostRunRequest = Omit<TestRun, 'runId'>;

// =============================================================================
// WebSocket Events
// =============================================================================

export type WebSocketEvent = 
  | { type: 'run:started'; runId: string; project: string; environment: string; framework: Framework; timestamp: string }
  | { type: 'feature:added'; runId: string; feature: Feature }
  | { type: 'feature:updated'; runId: string; featureId: string; status: TestStatus }
  | { type: 'scenario:started'; runId: string; featureId: string; scenario: Scenario }
  | { type: 'scenario:completed'; runId: string; scenarioId: string; status: TestStatus; duration: number }
  | { type: 'step:started'; runId: string; scenarioId: string; step: Partial<Step> }
  | { type: 'step:completed'; runId: string; scenarioId: string; step: Step }
  | { type: 'run:completed'; runId: string; status: TestStatus; summary: Statistics; duration: number }
  | { type: 'run:deleted'; runId: string }
  | { type: 'error'; message: string };

export type WebSocketClientMessage =
  | { type: 'subscribe'; runId?: string; project?: string; environment?: string }
  | { type: 'unsubscribe'; runId?: string }
  | { type: 'ping' };

// =============================================================================
// Server Configuration
// =============================================================================

export interface ServerConfig {
  port: number;
  host: string;
  dataDir?: string;         // Optional: persist to files
  historyLimit?: number;    // Max runs to keep per project/env
  corsOrigins?: string[];   // CORS allowed origins
}

// =============================================================================
// Client Configuration (for reporters)
// =============================================================================

export interface ReporterConfig {
  server?: string;          // Server URL, e.g., 'http://localhost:3000'
  project?: string;         // Auto-detected if not provided
  environment?: string;     // Defaults to 'local'
  mode?: 'live' | 'batch' | 'file';
  outputFile?: string;      // For file mode
  fallbackToFile?: boolean; // If server unavailable
  apiToken?: string;        // Optional auth
}
