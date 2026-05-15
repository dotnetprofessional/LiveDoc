import { V1TestRunSchema, type TestRunV1 } from '@swedevtools/livedoc-schema';
import type { DataDiagnostic } from '../store';

export interface RunValidationResult {
  run?: TestRunV1;
  diagnostic?: DataDiagnostic;
}

function describeSource(source: string | undefined): string {
  return source && source.trim().length > 0 ? source : 'LiveDoc run data';
}

export function validateTestRunData(data: unknown, source?: string): RunValidationResult {
  const label = describeSource(source);

  if (!data || typeof data !== 'object') {
    return {
      diagnostic: {
        severity: 'error',
        code: 'invalid-model',
        message: `${label} is not a LiveDoc run object.`,
      },
    };
  }

  const record = data as Record<string, unknown>;
  if (record.protocolVersion !== '1.0') {
    const legacyHint =
      Array.isArray(record.features) ||
      Array.isArray(record.suites) ||
      Array.isArray(record.children) ||
      Array.isArray(record.nodes);

    return {
      diagnostic: {
        severity: 'error',
        code: 'unsupported-model',
        message:
          `${label} is not a supported LiveDoc TestRunV1 file. ` +
          `Expected protocolVersion '1.0' but found '${String(record.protocolVersion ?? 'missing')}'.`,
        details: legacyHint
          ? ['This looks like an older LiveDoc model. Re-run tests with the current LiveDoc reporter.']
          : undefined,
      },
    };
  }

  const parsed = V1TestRunSchema.safeParse(data);
  if (!parsed.success) {
    return {
      diagnostic: {
        severity: 'error',
        code: 'invalid-model',
        message: `${label} does not match the LiveDoc TestRunV1 model.`,
        details: parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
      },
    };
  }

  return { run: parsed.data as TestRunV1 };
}
