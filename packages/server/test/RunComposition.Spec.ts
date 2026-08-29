import { expect } from 'vitest';
import { specification, rule } from '@swedevtools/livedoc-vitest';
import type { AnyTest, TestCase, TestRunV1 } from '@swedevtools/livedoc-schema';
import { composeTestRun } from '../src/run-composition.js';

function standardTest(id: string, title: string, status: 'passed' | 'failed'): AnyTest {
  return { id, kind: 'Test', title, execution: { status, duration: 10 } };
}

function document(id: string, title: string, tests: AnyTest[]): TestCase {
  return {
    id,
    kind: 'Container',
    title,
    tests,
    statistics: { total: tests.length, passed: tests.length, failed: 0, pending: 0, skipped: 0 },
  };
}

function run(
  runId: string,
  runType: 'full' | 'partial',
  documents: TestCase[],
  baselineRunId?: string
): TestRunV1 {
  return {
    protocolVersion: '1.0',
    runId,
    runType,
    baselineRunId,
    project: 'ComposerProject',
    environment: 'local',
    framework: 'vitest',
    timestamp: '2026-08-10T20:00:00.000Z',
    duration: runType === 'full' ? 1000 : 100,
    status: 'passed',
    summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
    documents,
  };
}

specification(`Partial Run Composition
  @server @partial-runs
  Combined snapshots retain unexecuted baseline content and replace only stable identities reported by partial runs.
  `, () => {
  rule("Partial run 'partial-1' updates test 'test-a' to 'passed' while retaining document 'doc-b'", (ctx) => {
    const [partialRunId, updatedTestId, expectedStatus, retainedDocumentId] = ctx.rule.valuesRaw;
    const baseline = run('full-1', 'full', [
      document('doc-a', 'A', [standardTest(updatedTestId, 'Updated test', 'failed')]),
      document(retainedDocumentId, 'B', [standardTest('test-b', 'Retained test', 'passed')]),
    ]);
    const partial = run(
      partialRunId,
      'partial',
      [document('doc-a', 'A', [standardTest(updatedTestId, 'Updated test', 'passed')])],
      baseline.runId
    );

    const combined = composeTestRun(baseline, [partial]).run;

    expect(combined.documents.map((item) => item.id)).toEqual(['doc-a', retainedDocumentId]);
    expect(combined.documents[0]?.tests[0]?.execution.status).toBe(expectedStatus);
    expect(combined.summary).toEqual({ total: 2, passed: 2, failed: 0, pending: 0, skipped: 0 });
  });

  rule("Partial outline row '1' changes to 'passed' while baseline row '0' remains 'failed'", (ctx) => {
    const [updatedRowId, updatedStatus, retainedRowId, retainedStatus] = ctx.rule.values;
    const outline = (results: Array<{ rowId: number; status: 'passed' | 'failed' }>): AnyTest => ({
      id: 'outline-1',
      kind: 'RuleOutline',
      title: 'Outline',
      execution: { status: 'failed', duration: 20 },
      examples: [{
        headers: ['value'],
        rows: [
          { rowId: retainedRowId, values: [{ value: 'a', type: 'string' }] },
          { rowId: updatedRowId, values: [{ value: 'b', type: 'string' }] },
        ],
      }],
      exampleResults: results.map((result) => ({
        testId: 'outline-1',
        result: { rowId: result.rowId, status: result.status, duration: 10 },
      })),
      statistics: { total: 2, passed: 0, failed: 2, pending: 0, skipped: 0 },
    });
    const baseline = run('full-1', 'full', [
      document('doc-a', 'A', [outline([
        { rowId: retainedRowId, status: retainedStatus },
        { rowId: updatedRowId, status: 'failed' },
      ])]),
    ]);
    const partial = run('partial-1', 'partial', [
      document('doc-a', 'A', [outline([{ rowId: updatedRowId, status: updatedStatus }])]),
    ], baseline.runId);

    const combinedOutline = composeTestRun(baseline, [partial]).run.documents[0]?.tests[0] as any;

    expect(combinedOutline.exampleResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ result: expect.objectContaining({ rowId: retainedRowId, status: retainedStatus }) }),
      expect.objectContaining({ result: expect.objectContaining({ rowId: updatedRowId, status: updatedStatus }) }),
    ]));
    expect(combinedOutline.statistics).toEqual({ total: 2, passed: 1, failed: 1, pending: 0, skipped: 0 });
  });

  rule("Combined run uses latest update duration '100' and marks baseline coverage from run 'full-1' as 'stale'", (ctx) => {
    const [expectedDuration, baselineRunId, diagnosticCode] = ctx.rule.values;
    const baseline = run(baselineRunId, 'full', [document('doc-a', 'A', [standardTest('test-a', 'A', 'passed')])]);
    baseline.coverage = {
      status: 'available',
      summary: { lines: { covered: 10, total: 10, pct: 100 } },
    };
    const partial = run('partial-1', 'partial', [
      document('doc-a', 'A', [standardTest('test-a', 'A', 'passed')]),
    ], baseline.runId);

    const combined = composeTestRun(baseline, [partial]).run;

    expect(combined.duration).toBe(expectedDuration);
    expect(combined.coverage?.summary?.lines?.pct).toBe(100);
    expect(combined.coverage?.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: diagnosticCode }),
    ]));
  });

  rule("Composing partial run 'partial-1' does not mutate baseline run 'full-1'", (ctx) => {
    const [partialRunId, baselineRunId] = ctx.rule.valuesRaw;
    const baseline = run(baselineRunId, 'full', [
      document('doc-a', 'A', [standardTest('test-a', 'A', 'failed')]),
    ]);
    const before = structuredClone(baseline);
    const partial = run(partialRunId, 'partial', [
      document('doc-a', 'A', [standardTest('test-a', 'A', 'passed')]),
    ], baseline.runId);

    composeTestRun(baseline, [partial]);

    expect(baseline).toEqual(before);
  });

  rule("A full baseline with status 'passed' and only skipped tests keeps status 'passed' when no partials are composed", (ctx) => {
    const [expectedStatus] = ctx.rule.values;
    const baseline = run('full-1', 'full', [{
      id: 'doc-a',
      kind: 'Container',
      title: 'A',
      tests: [{
        id: 'test-a',
        kind: 'Test',
        title: 'Skipped',
        execution: { status: 'skipped', duration: 0 },
      }],
      statistics: { total: 1, passed: 0, failed: 0, pending: 0, skipped: 1 },
    }]);

    expect(composeTestRun(baseline, []).run.status).toBe(expectedStatus);
  });

  rule("Partial run 'partial-1' without a baseline reference is rejected for baseline 'full-1'", (ctx) => {
    const [partialRunId, baselineRunId] = ctx.rule.valuesRaw;
    const baseline = run(baselineRunId, 'full', []);
    const partial = run(partialRunId, 'partial', []);
    delete partial.baselineRunId;

    expect(() => composeTestRun(baseline, [partial])).toThrow(baselineRunId);
  });

  rule("A passed partial keeps combined status 'passed' while retaining '1' pending baseline test", (ctx) => {
    const [expectedStatus, expectedPending] = ctx.rule.values;
    const baseline = run('full-1', 'full', [{
      id: 'doc-a',
      kind: 'Container',
      title: 'A',
      tests: [{
        id: 'test-pending',
        kind: 'Test',
        title: 'Pending',
        execution: { status: 'pending', duration: 0 },
      }],
      statistics: { total: 1, passed: 0, failed: 0, pending: 1, skipped: 0 },
    }]);
    const partial = run('partial-1', 'partial', [
      document('doc-b', 'B', [standardTest('test-passed', 'Passed', 'passed')]),
    ], baseline.runId);

    const combined = composeTestRun(baseline, [partial]).run;

    expect(combined.status).toBe(expectedStatus);
    expect(combined.summary.pending).toBe(expectedPending);
  });
});
