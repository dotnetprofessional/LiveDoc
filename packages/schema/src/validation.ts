import { z } from 'zod';
import { KnownKind, Status, StepKeyword } from './types';

export const StatusSchema = z.enum([
  'pending',
  'running',
  'passed',
  'failed',
  'skipped',
  'timedOut',
  'cancelled',
]);

export const StepKeywordSchema = z.enum(['given', 'when', 'then', 'and', 'but']);

export const TypedValueSchema = z.object({
  value: z.unknown(),
  type: z.enum(['string', 'number', 'boolean', 'date', 'object', 'null', 'undefined']),
  displayFormat: z.string().optional(),
});

export const BindingVariableSchema = z.object({
  name: z.string(),
  value: TypedValueSchema,
});

export const BindingSchema = z.object({
  variables: z.array(BindingVariableSchema),
  rowId: z.string().optional(),
});

export const RowSchema = z.object({
  rowId: z.string(),
  values: z.array(TypedValueSchema),
});

export const DataTableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(RowSchema),
});

export const ExampleTableSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  headers: z.array(z.string()),
  rows: z.array(RowSchema),
});

export const AttachmentSchema = z.object({
  id: z.string(),
  kind: z.enum(['image', 'screenshot', 'file']),
  title: z.string().optional(),
  mimeType: z.string(),
  uri: z.string().optional(),
  base64: z.string().optional(),
});

export const ExecutionResultSchema = z.object({
  status: StatusSchema,
  duration: z.number(),
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    diff: z.string().optional(),
  }).optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

export const StatisticsSchema = z.object({
  total: z.number(),
  passed: z.number(),
  failed: z.number(),
  pending: z.number(),
  skipped: z.number(),
});

export const NodeSchema = z.object({
  id: z.string(),
  kind: z.string(),
  path: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  execution: ExecutionResultSchema.optional(),
  binding: BindingSchema.optional(),
}).passthrough();

export const ContainerSchema = NodeSchema.extend({
  stats: StatisticsSchema,
  children: z.array(z.lazy(() => NodeSchema)),
});

export const OutlineSchema = NodeSchema.extend({
  stats: StatisticsSchema,
  template: z.lazy(() => NodeSchema),
  examples: z.array(z.lazy(() => NodeSchema)),
  tables: z.array(ExampleTableSchema),
});

// Pattern-specific schemas can be added here if needed for stricter validation
