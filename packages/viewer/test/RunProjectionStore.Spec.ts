import { expect } from 'vitest';
import { specification, rule } from '@swedevtools/livedoc-vitest';
import type { TestRunV1 } from '@swedevtools/livedoc-schema';
import { makeRunState, useStore, type Run } from '../src/client/store';

function baselineRun(overrides: Partial<TestRunV1> = {}): TestRunV1 {
  return {
    protocolVersion: '1.0',
    runId: 'run-a',
    project: 'Demo.Tests',
    environment: 'ci',
    framework: 'vitest',
    timestamp: '2026-06-01T00:00:00.000Z',
    duration: 10,
    status: 'passed',
    summary: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
    documents: [
      { id: 'doc-1', kind: 'Feature', title: 'Baseline feature', tests: [], statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 } },
    ],
    ...overrides,
  };
}

function partialCombinedRun(): TestRunV1 {
  return baselineRun({
    runId: 'partial-1',
    runType: 'partial',
    baselineRunId: 'run-a',
    documents: [
      { id: 'doc-1', kind: 'Feature', title: 'Baseline feature', tests: [], statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 } },
      { id: 'doc-2', kind: 'Feature', title: 'Overlay feature', tests: [], statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 } },
    ],
  });
}

function partialPhysicalRun(): TestRunV1 {
  return baselineRun({
    runId: 'partial-1',
    runType: 'partial',
    baselineRunId: 'run-a',
    documents: [
      { id: 'doc-2', kind: 'Feature', title: 'Overlay feature', tests: [], statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 } },
    ],
  });
}

function resetStore() {
  useStore.setState({
    runs: [],
    physicalRuns: {},
    projectHierarchy: [],
    selectedRunId: null,
    selectedRunGroupId: null,
    selectedNodeId: null,
    selectedRunView: 'combined',
    pendingRunFetch: null,
    currentView: { type: 'summary' },
    unresolvedDeepLink: null,
    diagnostics: [],
    projectGrouping: { enabled: false, hideSourceProjects: true, windowMs: 60_000 },
    followLatestRun: false,
  });
}

specification(`Viewer Run Projection Store
  Combined runs and physical (partial) run projections are cached separately so grouping/logical
  run inputs — which only ever read the combined 'runs' collection — can never be corrupted by an
  active partial's physical data.
  `, () => {
  rule("Selecting a run without specifying a projection defaults 'selectedRunView' to 'combined'", () => {
    resetStore();
    useStore.getState().selectRun('run-a');

    expect(useStore.getState().selectedRunId).toBe('run-a');
    expect(useStore.getState().selectedRunView).toBe('combined');
  });

  rule("Selecting a run with an explicit 'physical' projection is preserved on the store", () => {
    resetStore();
    useStore.getState().selectRun('partial-1', 'physical');

    expect(useStore.getState().selectedRunId).toBe('partial-1');
    expect(useStore.getState().selectedRunView).toBe('physical');
  });

  rule("Selecting a run group always resets the projection back to 'combined'", () => {
    resetStore();
    useStore.getState().selectRun('partial-1', 'physical');
    useStore.getState().selectRunGroup('group:1');

    expect(useStore.getState().selectedRunView).toBe('combined');
  });

  rule("Follow latest disabled keeps selected run 'run-a' when newer run 'run-b' arrives", (ctx) => {
    const [selectedRunId, newerRunId] = ctx.rule.values as [string, string];
    resetStore();
    useStore.getState().addRun(makeRunState(baselineRun({ runId: selectedRunId })));
    useStore.getState().selectRun(selectedRunId);
    useStore.getState().addRun(makeRunState(baselineRun({
      runId: newerRunId,
      timestamp: '2026-06-01T00:01:00.000Z',
    })));

    useStore.getState().followRunIfEnabled(newerRunId);

    expect(useStore.getState().selectedRunId).toBe(selectedRunId);
  });

  rule("Follow latest enabled switches selected run from 'run-a' to newer run 'run-b'", (ctx) => {
    const [selectedRunId, newerRunId] = ctx.rule.values as [string, string];
    resetStore();
    useStore.getState().addRun(makeRunState(baselineRun({ runId: selectedRunId })));
    useStore.getState().selectRun(selectedRunId);
    useStore.getState().setFollowLatestRun(true);
    useStore.getState().addRun(makeRunState(baselineRun({
      runId: newerRunId,
      timestamp: '2026-06-01T00:01:00.000Z',
    })));

    useStore.getState().followRunIfEnabled(newerRunId);

    expect(useStore.getState().selectedRunId).toBe(newerRunId);
  });

  rule("Follow latest enabled selects '1' containing group after '2' related projects arrive", (ctx) => {
    const [expectedGroupCount, expectedSourceRuns] = ctx.rule.values as [number, number];
    resetStore();
    useStore.setState({
      followLatestRun: true,
      projectGrouping: { enabled: true, hideSourceProjects: true, windowMs: 60_000 },
    });
    useStore.getState().addRun(makeRunState(baselineRun({
      runId: 'unit-latest',
      project: 'Demo.UnitTests',
    })));
    useStore.getState().addRun(makeRunState(baselineRun({
      runId: 'integration-latest',
      project: 'Demo.IntegrationTests',
      timestamp: '2026-06-01T00:00:01.000Z',
    })));

    useStore.getState().followRunIfEnabled('integration-latest');

    const state = useStore.getState();
    expect(state.getRunGroups()).toHaveLength(expectedGroupCount);
    expect(state.selectedRunGroupId).toBeTruthy();
    expect(state.getCurrentRunGroup()?.group.runs).toHaveLength(expectedSourceRuns);
  });

  rule("upsertPhysicalRun stores data only in the physical cache, leaving 'runs' — and therefore grouping inputs — untouched", () => {
    resetStore();
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));

    const state = useStore.getState();
    expect(state.runs).toHaveLength(0);
    expect(state.physicalRuns['partial-1']?.run.runId).toBe('partial-1');
    expect(state.getRunGroups()).toHaveLength(0);
  });

  rule("getCurrentRun returns the combined projection with '2' documents when runs holds it and the view is combined", (ctx) => {
    const [expectedDocumentCount] = ctx.rule.values as [number];
    resetStore();
    useStore.getState().addRun(makeRunState(partialCombinedRun()));
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));
    useStore.getState().selectRun('partial-1');

    const current = useStore.getState().getCurrentRun() as Run;
    expect(current.run.documents).toHaveLength(expectedDocumentCount);
  });

  rule("Toggling to the physical projection returns just '1' document for the same selected run", (ctx) => {
    const [expectedDocumentCount] = ctx.rule.values as [number];
    resetStore();
    useStore.getState().addRun(makeRunState(partialCombinedRun()));
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));
    useStore.getState().selectRun('partial-1');

    useStore.getState().setRunView('physical');

    const current = useStore.getState().getCurrentRun() as Run;
    expect(current.run.documents).toHaveLength(expectedDocumentCount);
    // setRunView must not reset navigation/node selection (unlike selectRun).
    expect(useStore.getState().selectedRunId).toBe('partial-1');
  });

  rule("An active partial with no combined snapshot yet still resolves via the physical cache when the view defaults back to combined", () => {
    resetStore();
    const livePartial = baselineRun({
      runId: 'partial-live',
      runType: 'partial',
      baselineRunId: 'run-a',
      status: 'running',
      documents: [],
    });
    useStore.getState().upsertPhysicalRun('partial-live', makeRunState(livePartial));
    useStore.getState().selectRun('partial-live', 'physical');
    // Simulate the loader defaulting the view back to 'combined' before a combined snapshot exists.
    useStore.getState().setRunView('combined');

    const current = useStore.getState().getCurrentRun() as Run;
    expect(current).toBeDefined();
    expect(current.run.runId).toBe('partial-live');
  });

  rule("A completed partial does not masquerade as Combined while its combined projection is loading", () => {
    resetStore();
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));
    useStore.getState().selectRun('partial-1', 'combined');

    expect(useStore.getState().getCurrentRun()).toBeUndefined();
  });

  rule("Real-time testcase upserts route to the physical cache when the runId is only tracked there, never touching 'runs'", () => {
    resetStore();
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));

    useStore.getState().upsertTestCase('partial-1', {
      id: 'doc-3',
      kind: 'Feature',
      title: 'New overlay doc',
      tests: [],
      statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
    } as any);

    const state = useStore.getState();
    expect(state.runs).toHaveLength(0);
    expect(state.physicalRuns['partial-1']?.run.documents).toHaveLength(2);
  });

  rule("Real-time testcase upserts continue to route to 'runs' for full runs, unaffected by the physical cache split", () => {
    resetStore();
    useStore.getState().addRun(makeRunState(baselineRun()));

    useStore.getState().upsertTestCase('run-a', {
      id: 'doc-2',
      kind: 'Feature',
      title: 'Second feature',
      tests: [],
      statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
    } as any);

    const state = useStore.getState();
    expect(state.runs[0]?.run.documents).toHaveLength(2);
    expect(Object.keys(state.physicalRuns)).toHaveLength(0);
  });

  rule("A failed testcase upsert keeps an active full run 'running' while recording '1' failure", (ctx) => {
    const [expectedStatus, expectedFailures] = ctx.rule.values as ['running', number];
    resetStore();
    useStore.getState().addRun(makeRunState(baselineRun({
      status: 'running',
      summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
      documents: [],
    })));

    useStore.getState().upsertTestCase('run-a', {
      id: 'failed-doc',
      kind: 'Feature',
      title: 'Feature with an early failure',
      tests: [{
        id: 'failed-scenario',
        kind: 'Scenario',
        title: 'A scenario fails before the suite completes',
        steps: [],
        execution: { status: 'failed', duration: 10 },
      }],
      statistics: { total: 1, passed: 0, failed: expectedFailures, pending: 0, skipped: 0 },
    } as any);

    const active = useStore.getState().runs[0]!.run;
    expect(active.status).toBe(expectedStatus);
    expect(active.summary.failed).toBe(expectedFailures);
  });

  rule("Late partial testcase updates change only the physical projection while Combined stays at '2' documents", (ctx) => {
    const [expectedCombinedDocuments] = ctx.rule.values as [number];
    resetStore();
    useStore.getState().addRun(makeRunState(partialCombinedRun()));
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));

    useStore.getState().upsertTestCase('partial-1', {
      id: 'doc-3',
      kind: 'Feature',
      title: 'Late physical update',
      tests: [],
      statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
    } as any);

    expect(useStore.getState().runs[0]?.run.documents).toHaveLength(expectedCombinedDocuments);
    expect(useStore.getState().physicalRuns['partial-1']?.run.documents).toHaveLength(2);
  });

  rule("Partial coverage '50' updates This partial while Combined baseline coverage remains '100'", (ctx) => {
    const [physicalPct, combinedPct] = ctx.rule.values as [number, number];
    resetStore();
    const combined = partialCombinedRun();
    combined.coverage = { status: 'available', summary: { lines: { covered: 10, total: 10, pct: combinedPct } } };
    useStore.getState().addRun(makeRunState(combined));
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));

    useStore.getState().attachCoverage('partial-1', {
      status: 'partial',
      summary: { lines: { covered: 5, total: 10, pct: physicalPct } },
    });

    expect(useStore.getState().physicalRuns['partial-1']?.run.coverage?.summary?.lines?.pct).toBe(physicalPct);
    expect(useStore.getState().runs[0]?.run.coverage?.summary?.lines?.pct).toBe(combinedPct);
  });

  rule("removeRun also evicts any physical cache entry for the same runId, preventing an orphaned toggle target", () => {
    resetStore();
    useStore.getState().addRun(makeRunState(partialCombinedRun()));
    useStore.getState().upsertPhysicalRun('partial-1', makeRunState(partialPhysicalRun()));

    useStore.getState().removeRun('partial-1');

    expect(useStore.getState().physicalRuns['partial-1']).toBeUndefined();
  });
});
