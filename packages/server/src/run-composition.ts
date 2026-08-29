import type {
  AnyTest,
  CoverageReport,
  DataTable,
  ExecutionResult,
  Statistics,
  Status,
  TestCase,
  TestRunV1,
} from '@swedevtools/livedoc-schema';

export interface RunCompositionDiagnostic {
  code: 'kind-changed';
  nodeId: string;
  message: string;
}

export interface RunCompositionResult {
  run: TestRunV1;
  diagnostics: RunCompositionDiagnostic[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function emptyStatistics(): Statistics {
  return { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
}

function statisticsBucket(status: Status): keyof Omit<Statistics, 'total'> {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'timedOut':
      return 'failed';
    case 'skipped':
    case 'cancelled':
      return 'skipped';
    case 'pending':
    case 'running':
    default:
      return 'pending';
  }
}

function aggregateStatus(statuses: Status[]): Status {
  const values = new Set(statuses);
  if (values.has('failed') || values.has('timedOut')) return 'failed';
  if (values.has('cancelled')) return 'cancelled';
  if (values.has('running')) return 'running';
  if (values.has('pending')) return 'pending';
  if (values.has('skipped')) return 'skipped';
  if (values.has('passed')) return 'passed';
  return 'pending';
}

function mergeExampleTables(baseTables: DataTable[], updateTables: DataTable[]): DataTable[] {
  const result = clone(baseTables);

  for (let updateIndex = 0; updateIndex < updateTables.length; updateIndex++) {
    const updateTable = updateTables[updateIndex]!;
    let targetIndex = updateTable.name
      ? result.findIndex((table) => table.name === updateTable.name)
      : updateIndex < result.length
        ? updateIndex
        : -1;

    if (targetIndex < 0) {
      result.push({ ...clone(updateTable), rows: [] });
      targetIndex = result.length - 1;
    } else {
      result[targetIndex] = {
        ...result[targetIndex]!,
        name: updateTable.name,
        headers: clone(updateTable.headers),
      };
    }

    for (const updateRow of updateTable.rows) {
      let replaced = false;
      for (let tableIndex = 0; tableIndex < result.length && !replaced; tableIndex++) {
        const rowIndex = result[tableIndex]!.rows.findIndex((row) => row.rowId === updateRow.rowId);
        if (rowIndex >= 0) {
          result[tableIndex]!.rows[rowIndex] = clone(updateRow);
          replaced = true;
        }
      }

      if (!replaced) result[targetIndex]!.rows.push(clone(updateRow));
    }
  }

  return result;
}

function mergeExampleResults(
  baseResults: Array<{ testId: string; result: ExecutionResult }>,
  updateResults: Array<{ testId: string; result: ExecutionResult }>
): Array<{ testId: string; result: ExecutionResult }> {
  const result = clone(baseResults);
  const key = (entry: { testId: string; result: ExecutionResult }) =>
    `${entry.testId}\u0000${String(entry.result.rowId ?? '')}`;

  const positions = new Map(result.map((entry, index) => [key(entry), index]));
  for (const update of updateResults) {
    const existingIndex = positions.get(key(update));
    if (existingIndex === undefined) {
      positions.set(key(update), result.length);
      result.push(clone(update));
    } else {
      result[existingIndex] = clone(update);
    }
  }

  return result;
}

function recomputeOutline(test: AnyTest): AnyTest {
  const examples = ((test as any).examples ?? []) as DataTable[];
  const exampleResults = ((test as any).exampleResults ?? []) as Array<{
    testId: string;
    result: ExecutionResult;
  }>;
  const resultsByRow = new Map<number, ExecutionResult[]>();

  for (const entry of exampleResults) {
    const rowId = entry.result.rowId;
    if (rowId === undefined) continue;
    const rowResults = resultsByRow.get(rowId) ?? [];
    rowResults.push(entry.result);
    resultsByRow.set(rowId, rowResults);
  }

  const statistics = emptyStatistics();
  const rowStatuses: Status[] = [];
  for (const row of examples.flatMap((table) => table.rows)) {
    const status = aggregateStatus((resultsByRow.get(row.rowId) ?? []).map((result) => result.status));
    statistics.total += 1;
    statistics[statisticsBucket(status)] += 1;
    rowStatuses.push(status);
  }

  const execution: ExecutionResult = {
    status: aggregateStatus(rowStatuses),
    duration: exampleResults.reduce((total, entry) => total + (Number(entry.result.duration) || 0), 0),
  };

  return { ...(test as any), statistics, execution } as AnyTest;
}

function mergeTest(
  base: AnyTest,
  update: AnyTest,
  diagnostics: RunCompositionDiagnostic[]
): AnyTest {
  if (base.kind !== update.kind) {
    diagnostics.push({
      code: 'kind-changed',
      nodeId: update.id,
      message: `Test '${update.id}' changed kind from '${base.kind}' to '${update.kind}'.`,
    });
    return clone(update);
  }

  if (update.kind !== 'ScenarioOutline' && update.kind !== 'RuleOutline') {
    return clone(update);
  }

  const merged = {
    ...(clone(base) as any),
    ...(clone(update) as any),
    examples: mergeExampleTables(
      (((base as any).examples ?? []) as DataTable[]),
      (((update as any).examples ?? []) as DataTable[])
    ),
    exampleResults: mergeExampleResults(
      (((base as any).exampleResults ?? []) as Array<{ testId: string; result: ExecutionResult }>),
      (((update as any).exampleResults ?? []) as Array<{ testId: string; result: ExecutionResult }>)
    ),
  } as AnyTest;

  return recomputeOutline(merged);
}

function mergeTests(
  baseTests: AnyTest[],
  updateTests: AnyTest[],
  diagnostics: RunCompositionDiagnostic[]
): AnyTest[] {
  const result = clone(baseTests);
  const positions = new Map(result.map((test, index) => [test.id, index]));

  for (const update of updateTests) {
    const existingIndex = positions.get(update.id);
    if (existingIndex === undefined) {
      positions.set(update.id, result.length);
      result.push(clone(update));
    } else {
      result[existingIndex] = mergeTest(result[existingIndex]!, update, diagnostics);
    }
  }

  return result;
}

function recomputeTestCase(testCase: TestCase): TestCase {
  const statistics = emptyStatistics();

  for (const test of testCase.tests) {
    if (test.kind === 'ScenarioOutline' || test.kind === 'RuleOutline') {
      const outline = recomputeOutline(test);
      const index = testCase.tests.findIndex((candidate) => candidate.id === test.id);
      testCase.tests[index] = outline;
      const outlineStatistics = (outline as any).statistics as Statistics;
      statistics.total += outlineStatistics.total;
      statistics.passed += outlineStatistics.passed;
      statistics.failed += outlineStatistics.failed;
      statistics.pending += outlineStatistics.pending;
      statistics.skipped += outlineStatistics.skipped;
      continue;
    }

    const status = test.execution?.status ?? 'pending';
    statistics.total += 1;
    statistics[statisticsBucket(status)] += 1;
  }

  return { ...testCase, statistics };
}

function mergeTestCase(
  base: TestCase,
  update: TestCase,
  diagnostics: RunCompositionDiagnostic[]
): TestCase {
  return recomputeTestCase({
    ...(clone(base) as any),
    ...(clone(update) as any),
    tests: mergeTests(base.tests ?? [], update.tests ?? [], diagnostics),
    background: update.background ? clone(update.background) : clone(base.background),
  } as TestCase);
}

function mergeDocuments(
  baseDocuments: TestCase[],
  updateDocuments: TestCase[],
  diagnostics: RunCompositionDiagnostic[]
): TestCase[] {
  const result = clone(baseDocuments).map(recomputeTestCase);
  const positions = new Map(result.map((document, index) => [document.id, index]));

  for (const update of updateDocuments) {
    const existingIndex = positions.get(update.id);
    if (existingIndex === undefined) {
      positions.set(update.id, result.length);
      result.push(recomputeTestCase(clone(update)));
    } else {
      result[existingIndex] = mergeTestCase(result[existingIndex]!, update, diagnostics);
    }
  }

  return result;
}

function summarizeDocuments(documents: TestCase[]): Statistics {
  return documents.reduce<Statistics>((summary, document) => ({
    total: summary.total + document.statistics.total,
    passed: summary.passed + document.statistics.passed,
    failed: summary.failed + document.statistics.failed,
    pending: summary.pending + document.statistics.pending,
    skipped: summary.skipped + document.statistics.skipped,
  }), emptyStatistics());
}

function combinedStatus(summary: Statistics, latestStatus: Status): Status {
  if (summary.failed > 0 || latestStatus === 'failed' || latestStatus === 'timedOut') return 'failed';
  return latestStatus;
}

function baselineCoverage(coverage: CoverageReport | undefined, baselineRunId: string): CoverageReport | undefined {
  if (!coverage) return undefined;

  const copy = clone(coverage);
  const diagnostics = (copy.diagnostics ?? []).filter((diagnostic) => diagnostic.code !== 'stale');
  diagnostics.push({
    severity: 'info',
    code: 'stale',
    message: `Coverage is from full baseline run '${baselineRunId}'; partial runs do not update combined coverage.`,
  });
  copy.diagnostics = diagnostics;
  return copy;
}

function assertCompatible(baseline: TestRunV1, partial: TestRunV1): void {
  if ((baseline.runType ?? 'full') !== 'full') {
    throw new Error(`Baseline run '${baseline.runId}' is not a full run.`);
  }
  if ((partial.runType ?? 'full') !== 'partial') {
    throw new Error(`Run '${partial.runId}' is not a partial run.`);
  }
  if (partial.baselineRunId !== baseline.runId) {
    throw new Error(`Partial run '${partial.runId}' references baseline '${partial.baselineRunId}', not '${baseline.runId}'.`);
  }
  if (
    partial.project !== baseline.project ||
    partial.environment !== baseline.environment ||
    partial.framework !== baseline.framework
  ) {
    throw new Error(`Partial run '${partial.runId}' is not compatible with baseline '${baseline.runId}'.`);
  }
}

export function composeTestRun(baseline: TestRunV1, partials: TestRunV1[]): RunCompositionResult {
  if ((baseline.runType ?? 'full') !== 'full') {
    throw new Error(`Baseline run '${baseline.runId}' is not a full run.`);
  }

  const diagnostics: RunCompositionDiagnostic[] = [];

  for (const partial of partials) {
    assertCompatible(baseline, partial);
  }

  if (partials.length === 0) {
    return { run: clone(baseline), diagnostics };
  }

  let documents = clone(baseline.documents).map(recomputeTestCase);
  for (const partial of partials) {
    documents = mergeDocuments(documents, partial.documents, diagnostics);
  }

  const latest = partials[partials.length - 1]!;
  const summary = summarizeDocuments(documents);
  const run: TestRunV1 = {
    ...clone(latest),
    runType: 'partial',
    baselineRunId: baseline.runId,
    documents,
    summary,
    status: combinedStatus(summary, latest.status),
    coverage: baselineCoverage(baseline.coverage, baseline.runId),
  };

  return { run, diagnostics };
}
