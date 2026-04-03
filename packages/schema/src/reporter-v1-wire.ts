import { z } from 'zod';

// =============================================================================
// Reporter Model v1 — Wire Validators (REST payloads + WS events)
// =============================================================================

export const V1StatusSchema = z.enum([
  'pending',
  'running',
  'passed',
  'failed',
  'skipped',
  'timedOut',
  'cancelled',
]);

export const V1StepKeywordSchema = z.enum(['given', 'when', 'then', 'and', 'but']);

export const V1TypedValueSchema = z.object({
  value: z.unknown(),
  type: z.enum(['string', 'number', 'boolean', 'date', 'object', 'null', 'undefined']),
  displayFormat: z.string().optional(),
});

export const V1RowSchema = z.object({
  rowId: z.number().int().nonnegative(),
  values: z.array(V1TypedValueSchema),
});

export const V1DataTableSchema = z.object({
  name: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(V1RowSchema),
});

export const V1AttachmentSchema = z.object({
  id: z.string(),
  kind: z.enum(['image', 'screenshot', 'file']),
  title: z.string().optional(),
  mimeType: z.string(),
  uri: z.string().optional(),
  base64: z.string().optional(),
});

export const V1ErrorInfoSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  code: z.string().optional(),
  lineNumber: z.number().int().optional(),
});

export const V1ExecutionResultSchema = z.object({
  rowId: z.number().int().nonnegative().optional(),
  status: V1StatusSchema,
  duration: z.number().nonnegative(),
  error: V1ErrorInfoSchema.optional(),
  attachments: z.array(V1AttachmentSchema).optional(),
});

export const V1RuleViolationSchema = z.object({
  rule: z.string(),
  message: z.string(),
  title: z.string().optional(),
  errorId: z.number().int().optional(),
});

export const V1StatisticsSchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

export const V1BaseTestSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dataTables: z.array(V1DataTableSchema).optional(),
  execution: V1ExecutionResultSchema,
  ruleViolations: z.array(V1RuleViolationSchema).optional(),
});

export const V1StepTestSchema = V1BaseTestSchema.extend({
  kind: z.literal('Step'),
  keyword: V1StepKeywordSchema,
});

export const V1ScenarioTestSchema = V1BaseTestSchema.extend({
  kind: z.literal('Scenario'),
  steps: z.array(V1StepTestSchema),
});

export const V1RuleTestSchema = V1BaseTestSchema.extend({
  kind: z.literal('Rule'),
});

export const V1StandardTestSchema = V1BaseTestSchema.extend({
  kind: z.literal('Test'),
});

export const V1ExampleResultSchema = z.object({
  testId: z.string(),
  result: V1ExecutionResultSchema,
});

export const V1ScenarioOutlineTestSchema = V1BaseTestSchema.extend({
  kind: z.literal('ScenarioOutline'),
  steps: z.array(V1StepTestSchema),
  examples: z.array(V1DataTableSchema),
  exampleResults: z.array(V1ExampleResultSchema),
  statistics: V1StatisticsSchema,
});

export const V1RuleOutlineTestSchema = V1BaseTestSchema.extend({
  kind: z.literal('RuleOutline'),
  examples: z.array(V1DataTableSchema),
  exampleResults: z.array(V1ExampleResultSchema),
  statistics: V1StatisticsSchema,
});

export const V1AnyTestSchema: z.ZodType<any> = z.union([
  V1StepTestSchema,
  V1ScenarioTestSchema,
  V1ScenarioOutlineTestSchema,
  V1RuleOutlineTestSchema,
  V1RuleTestSchema,
  V1StandardTestSchema,
  V1BaseTestSchema,
]);

export const V1TestCaseSchema = z.object({
  id: z.string(),
  kind: z.string(),
  path: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tests: z.array(V1AnyTestSchema),
  background: V1AnyTestSchema.optional(),
  statistics: V1StatisticsSchema,
  ruleViolations: z.array(V1RuleViolationSchema).optional(),
});

export const V1FrameworkSchema = z.string();

export const V1TestRunSchema = z.object({
  protocolVersion: z.literal('1.0'),
  runId: z.string(),
  project: z.string(),
  environment: z.string(),
  framework: V1FrameworkSchema,
  timestamp: z.string(),
  duration: z.number().nonnegative(),
  status: V1StatusSchema,
  summary: V1StatisticsSchema,
  documents: z.array(V1TestCaseSchema),
});

// =============================================================================
// REST payload schemas
// =============================================================================

export const V1StartRunRequestSchema = z.object({
  project: z.string(),
  environment: z.string(),
  framework: z.string(),
  timestamp: z.string().optional(),
});

export const V1StartRunResponseSchema = z.object({
  protocolVersion: z.literal('1.0'),
  runId: z.string(),
  websocketUrl: z.string(),
});

export const V1UpsertTestCaseRequestSchema = z.object({
  testCase: V1TestCaseSchema,
});

export const V1UpsertTestCasesBatchRequestSchema = z.object({
  testCases: z.array(V1TestCaseSchema),
  complete: z.object({
    status: V1StatusSchema,
    duration: z.number().nonnegative(),
    summary: V1StatisticsSchema.optional(),
  }).optional(),
});

export const V1UpsertTestRequestSchema = z.object({
  testCaseId: z.string(),
  test: V1AnyTestSchema,
});

export const V1UpsertScenarioStepsRequestSchema = z.object({
  steps: z.array(V1StepTestSchema),
});

export const V1PatchExecutionRequestSchema = z
  .object({
    status: V1StatusSchema.optional(),
    duration: z.number().nonnegative().optional(),
    error: V1ErrorInfoSchema.nullable().optional(),
    attachments: z.array(V1AttachmentSchema).nullable().optional(),
  })
  .strict();

export const V1UpsertOutlineExampleResultsRequestSchema = z.object({
  results: z.array(
    z.object({
      testId: z.string(),
      result: V1ExecutionResultSchema.extend({
        rowId: z.number().int().nonnegative(),
      }),
    })
  ),
});

export const V1CompleteRunRequestSchema = z.object({
  status: V1StatusSchema,
  duration: z.number().nonnegative(),
  summary: V1StatisticsSchema.optional(),
});

// =============================================================================
// WebSocket events (v1)
// =============================================================================

export const V1WsRunStartedSchema = z.object({
  type: z.literal('run:v1:started'),
  runId: z.string(),
  project: z.string(),
  environment: z.string(),
  framework: z.string(),
  timestamp: z.string(),
});

export const V1WsTestCaseUpsertSchema = z.object({
  type: z.literal('testcase:upsert'),
  runId: z.string(),
  testCase: V1TestCaseSchema,
});

export const V1WsTestUpsertSchema = z.object({
  type: z.literal('test:upsert'),
  runId: z.string(),
  testCaseId: z.string(),
  test: V1AnyTestSchema,
});

export const V1WsTestExecutionSchema = z.object({
  type: z.literal('test:execution'),
  runId: z.string(),
  testId: z.string(),
  patch: z.object({ execution: V1PatchExecutionRequestSchema }),
});

export const V1WsOutlineExampleResultsSchema = z.object({
  type: z.literal('outline:exampleResults'),
  runId: z.string(),
  outlineId: z.string(),
  results: V1UpsertOutlineExampleResultsRequestSchema.shape.results,
});

export const V1WsRunCompletedSchema = z.object({
  type: z.literal('run:v1:completed'),
  runId: z.string(),
  status: V1StatusSchema,
  duration: z.number().nonnegative(),
  summary: V1StatisticsSchema,
});

export const V1WebSocketEventSchema = z.union([
  V1WsRunStartedSchema,
  V1WsTestCaseUpsertSchema,
  V1WsTestUpsertSchema,
  V1WsTestExecutionSchema,
  V1WsOutlineExampleResultsSchema,
  V1WsRunCompletedSchema,
]);

export type V1WebSocketEvent = z.infer<typeof V1WebSocketEventSchema>;
export type V1StartRunRequest = z.infer<typeof V1StartRunRequestSchema>;
export type V1StartRunResponse = z.infer<typeof V1StartRunResponseSchema>;
export type V1UpsertTestCaseRequest = z.infer<typeof V1UpsertTestCaseRequestSchema>;
export type V1UpsertTestCasesBatchRequest = z.infer<typeof V1UpsertTestCasesBatchRequestSchema>;
export type V1UpsertTestRequest = z.infer<typeof V1UpsertTestRequestSchema>;
export type V1UpsertScenarioStepsRequest = z.infer<typeof V1UpsertScenarioStepsRequestSchema>;
export type V1PatchExecutionRequest = z.infer<typeof V1PatchExecutionRequestSchema>;
export type V1UpsertOutlineExampleResultsRequest = z.infer<typeof V1UpsertOutlineExampleResultsRequestSchema>;
export type V1CompleteRunRequest = z.infer<typeof V1CompleteRunRequestSchema>;
