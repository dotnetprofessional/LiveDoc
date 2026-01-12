import { z } from 'zod';

// =============================================================================
// Reporter Model v3 — Wire Validators (REST payloads + WS events)
// =============================================================================

export const V3StatusSchema = z.enum([
  'pending',
  'running',
  'passed',
  'failed',
  'skipped',
  'timedOut',
  'cancelled',
]);

export const V3StepKeywordSchema = z.enum(['given', 'when', 'then', 'and', 'but']);

export const V3TypedValueSchema = z.object({
  value: z.unknown(),
  type: z.enum(['string', 'number', 'boolean', 'date', 'object', 'null', 'undefined']),
  displayFormat: z.string().optional(),
});

export const V3RowSchema = z.object({
  rowId: z.number().int().nonnegative(),
  values: z.array(V3TypedValueSchema),
});

export const V3DataTableSchema = z.object({
  name: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(V3RowSchema),
});

export const V3AttachmentSchema = z.object({
  id: z.string(),
  kind: z.enum(['image', 'screenshot', 'file']),
  title: z.string().optional(),
  mimeType: z.string(),
  uri: z.string().optional(),
  base64: z.string().optional(),
});

export const V3ErrorInfoSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  code: z.string().optional(),
  lineNumber: z.number().int().optional(),
});

export const V3ExecutionResultSchema = z.object({
  rowId: z.number().int().nonnegative().optional(),
  status: V3StatusSchema,
  duration: z.number().nonnegative(),
  error: V3ErrorInfoSchema.optional(),
  attachments: z.array(V3AttachmentSchema).optional(),
});

export const V3RuleViolationSchema = z.object({
  rule: z.string(),
  message: z.string(),
  title: z.string().optional(),
  errorId: z.number().int().optional(),
});

export const V3StatisticsSchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export const V3BaseTestSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dataTables: z.array(V3DataTableSchema).optional(),
  execution: V3ExecutionResultSchema,
  ruleViolations: z.array(V3RuleViolationSchema).optional(),
});

export const V3StepTestSchema = V3BaseTestSchema.extend({
  kind: z.literal('Step'),
  keyword: V3StepKeywordSchema,
});

export const V3ScenarioTestSchema = V3BaseTestSchema.extend({
  kind: z.literal('Scenario'),
  steps: z.array(V3StepTestSchema),
});

export const V3RuleTestSchema = V3BaseTestSchema.extend({
  kind: z.literal('Rule'),
});

export const V3StandardTestSchema = V3BaseTestSchema.extend({
  kind: z.literal('Test'),
});

export const V3ExampleResultSchema = z.object({
  testId: z.string(),
  result: V3ExecutionResultSchema,
});

export const V3ScenarioOutlineTestSchema = V3BaseTestSchema.extend({
  kind: z.literal('ScenarioOutline'),
  steps: z.array(V3StepTestSchema),
  examples: z.array(V3DataTableSchema),
  exampleResults: z.array(V3ExampleResultSchema),
  statistics: V3StatisticsSchema,
});

export const V3RuleOutlineTestSchema = V3BaseTestSchema.extend({
  kind: z.literal('RuleOutline'),
  examples: z.array(V3DataTableSchema),
  exampleResults: z.array(V3ExampleResultSchema),
  statistics: V3StatisticsSchema,
});

export const V3AnyTestSchema: z.ZodType<any> = z.union([
  V3StepTestSchema,
  V3ScenarioTestSchema,
  V3ScenarioOutlineTestSchema,
  V3RuleOutlineTestSchema,
  V3RuleTestSchema,
  V3StandardTestSchema,
  V3BaseTestSchema,
]);

export const V3TestCaseSchema = z.object({
  id: z.string(),
  style: z.string(),
  path: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tests: z.array(V3AnyTestSchema),
  background: V3AnyTestSchema.optional(),
  statistics: V3StatisticsSchema,
  ruleViolations: z.array(V3RuleViolationSchema).optional(),
});

export const V3FrameworkSchema = z.string();

export const V3TestRunSchema = z.object({
  protocolVersion: z.literal('3.0'),
  runId: z.string(),
  project: z.string(),
  environment: z.string(),
  framework: V3FrameworkSchema,
  timestamp: z.string(),
  duration: z.number().nonnegative(),
  status: V3StatusSchema,
  summary: V3StatisticsSchema,
  documents: z.array(V3TestCaseSchema),
});

// =============================================================================
// REST payload schemas
// =============================================================================

export const V3StartRunRequestSchema = z.object({
  project: z.string(),
  environment: z.string(),
  framework: z.string(),
  timestamp: z.string().optional(),
});

export const V3StartRunResponseSchema = z.object({
  protocolVersion: z.literal('3.0'),
  runId: z.string(),
  websocketUrl: z.string(),
});

export const V3UpsertTestCaseRequestSchema = z.object({
  testCase: V3TestCaseSchema,
});

export const V3UpsertTestRequestSchema = z.object({
  testCaseId: z.string(),
  test: V3AnyTestSchema,
});

export const V3UpsertScenarioStepsRequestSchema = z.object({
  steps: z.array(V3StepTestSchema),
});

export const V3PatchExecutionRequestSchema = z
  .object({
    status: V3StatusSchema.optional(),
    duration: z.number().nonnegative().optional(),
    error: V3ErrorInfoSchema.nullable().optional(),
    attachments: z.array(V3AttachmentSchema).nullable().optional(),
  })
  .strict();

export const V3UpsertOutlineExampleResultsRequestSchema = z.object({
  results: z.array(
    z.object({
      testId: z.string(),
      result: V3ExecutionResultSchema.extend({
        rowId: z.number().int().nonnegative(),
      }),
    })
  ),
});

export const V3CompleteRunRequestSchema = z.object({
  status: V3StatusSchema,
  duration: z.number().nonnegative(),
  summary: V3StatisticsSchema.optional(),
});

// =============================================================================
// WebSocket events (v3)
// =============================================================================

export const V3WsRunStartedSchema = z.object({
  type: z.literal('run:v3:started'),
  runId: z.string(),
  project: z.string(),
  environment: z.string(),
  framework: z.string(),
  timestamp: z.string(),
});

export const V3WsTestCaseUpsertSchema = z.object({
  type: z.literal('testcase:upsert'),
  runId: z.string(),
  testCase: V3TestCaseSchema,
});

export const V3WsTestUpsertSchema = z.object({
  type: z.literal('test:upsert'),
  runId: z.string(),
  testCaseId: z.string(),
  test: V3AnyTestSchema,
});

export const V3WsTestExecutionSchema = z.object({
  type: z.literal('test:execution'),
  runId: z.string(),
  testId: z.string(),
  patch: z.object({ execution: V3PatchExecutionRequestSchema }),
});

export const V3WsOutlineExampleResultsSchema = z.object({
  type: z.literal('outline:exampleResults'),
  runId: z.string(),
  outlineId: z.string(),
  results: V3UpsertOutlineExampleResultsRequestSchema.shape.results,
});

export const V3WsRunCompletedSchema = z.object({
  type: z.literal('run:v3:completed'),
  runId: z.string(),
  status: V3StatusSchema,
  duration: z.number().nonnegative(),
  summary: V3StatisticsSchema,
});

export const V3WebSocketEventSchema = z.union([
  V3WsRunStartedSchema,
  V3WsTestCaseUpsertSchema,
  V3WsTestUpsertSchema,
  V3WsTestExecutionSchema,
  V3WsOutlineExampleResultsSchema,
  V3WsRunCompletedSchema,
]);

export type V3WebSocketEvent = z.infer<typeof V3WebSocketEventSchema>;
export type V3StartRunRequest = z.infer<typeof V3StartRunRequestSchema>;
export type V3StartRunResponse = z.infer<typeof V3StartRunResponseSchema>;
export type V3UpsertTestCaseRequest = z.infer<typeof V3UpsertTestCaseRequestSchema>;
export type V3UpsertTestRequest = z.infer<typeof V3UpsertTestRequestSchema>;
export type V3UpsertScenarioStepsRequest = z.infer<typeof V3UpsertScenarioStepsRequestSchema>;
export type V3PatchExecutionRequest = z.infer<typeof V3PatchExecutionRequestSchema>;
export type V3UpsertOutlineExampleResultsRequest = z.infer<typeof V3UpsertOutlineExampleResultsRequestSchema>;
export type V3CompleteRunRequest = z.infer<typeof V3CompleteRunRequestSchema>;
