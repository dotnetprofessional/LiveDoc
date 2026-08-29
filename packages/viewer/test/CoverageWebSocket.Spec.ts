import { expect } from 'vitest';
import { specification, rule } from '@swedevtools/livedoc-vitest';
import type { CoverageReport, TestRunV1 } from '@swedevtools/livedoc-schema';
import { makeRunState, type Run } from '../src/client/store';
import { applyCoverageEvent } from '../src/client/hooks/useWebSocket';

const coverage: CoverageReport = {
  status: 'available',
  summary: {
    lines: { covered: 9, total: 10, pct: 90 },
  },
};

function hydratedRun(runId: string): Run {
  const run: TestRunV1 = {
    protocolVersion: '1.0',
    runId,
    project: 'CoverageProject',
    environment: 'local',
    framework: 'xunit',
    timestamp: '2026-07-18T00:00:00.000Z',
    duration: 10,
    status: 'passed',
    summary: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
    documents: [],
  };
  return makeRunState(run);
}

specification(`Viewer Coverage WebSocket Events
  Coverage events hydrate unknown runs before applying coverage and emit diagnostics that reflect the viewer store.
  `, () => {
  rule("An unknown run is hydrated and emits success code 'LD-COV-090' only after coverage is stored", async (ctx) => {
    const expectedCode = ctx.rule.values[0] as string;
    const runs = new Map<string, Run>();
    const logs: string[] = [];
    const runId = 'hydrated-run';

    const applied = await applyCoverageEvent(runId, coverage, {
      fetchRunById: async (id) => hydratedRun(id),
      addRun: (run) => runs.set(run.run.runId, run),
      attachCoverage: (id, report) => {
        const run = runs.get(id);
        if (run) runs.set(id, makeRunState({ ...run.run, coverage: report }));
      },
      getRun: (id) => runs.get(id),
      logInfo: (message) => logs.push(message),
      logError: (message) => logs.push(message),
    });

    expect(applied).toBe(true);
    expect(runs.get(runId)?.run.coverage?.summary?.lines?.pct).toBe(90);
    expect(logs.some((message) => message.includes(expectedCode))).toBe(true);
    expect(logs.some((message) => message.includes('LD-COV-091'))).toBe(false);
  });

  rule("A failed REST hydration emits actionable code 'LD-COV-091' and never emits 'LD-COV-090'", async (ctx) => {
    const [failureCode, successCode] = ctx.rule.values as [string, string];
    const logs: string[] = [];

    const applied = await applyCoverageEvent('missing-run', coverage, {
      fetchRunById: async () => null,
      addRun: () => undefined,
      attachCoverage: () => undefined,
      getRun: () => undefined,
      logInfo: (message) => logs.push(message),
      logError: (message) => logs.push(message),
    });

    expect(applied).toBe(false);
    expect(logs.some((message) => message.includes(failureCode) && message.includes('rest-hydration'))).toBe(true);
    expect(logs.some((message) => message.includes(successCode))).toBe(false);
  });
});
