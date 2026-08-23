import { expect } from 'vitest';
import { rule, specification } from '@swedevtools/livedoc-vitest';
import type { TestRunV1 } from '@swedevtools/livedoc-schema';
import { makeRunState, type RunGroup } from '../src/client/store';
import { findLiveRunTarget, resolveLiveRunTarget } from '../src/client/lib/live-run';

function run(runId: string, project: string, status: TestRunV1['status'], offsetMs = 0) {
  return makeRunState({
    protocolVersion: '1.0',
    runId,
    project,
    environment: 'local',
    framework: 'vitest',
    timestamp: new Date(Date.parse('2026-08-23T00:00:00.000Z') + offsetMs).toISOString(),
    duration: 10,
    status,
    summary: {
      total: status === 'running' ? 0 : 1,
      passed: status === 'passed' ? 1 : 0,
      failed: status === 'failed' ? 1 : 0,
      pending: 0,
      skipped: 0,
    },
    documents: [],
  });
}

function group(unit: ReturnType<typeof run>, integration: ReturnType<typeof run>): RunGroup {
  const synthetic = run('group-run', 'Demo', 'running', 1_000);
  const groupId = `group:local:demo:${integration.run.runId}+${unit.run.runId}`;
  return {
    ...synthetic,
    group: {
      id: groupId,
      name: 'Demo',
      environment: 'local',
      startTime: Date.parse(unit.run.timestamp),
      endTime: Date.parse(integration.run.timestamp) + 10,
      runs: [integration.run, unit.run],
      run: synthetic.run,
    },
  };
}

specification(`Viewer Live Update Banner
  The banner represents global test activity rather than only the currently selected raw run.
  `, () => {
  rule("A running run 'live' is visible while completed run 'history' remains selected", (ctx) => {
    const [liveRunId, selectedRunId] = ctx.rule.values as [string, string];
    const target = findLiveRunTarget({
      runs: [run(selectedRunId, 'History', 'passed'), run(liveRunId, 'Live', 'running', 1_000)],
      physicalRuns: {},
      groups: [],
      selectedRunId,
      selectedRunGroupId: null,
    });

    expect(target?.runId).toBe(liveRunId);
    expect(target?.isSelected).toBe(false);
  });

  rule("A running logical group replaces its '2' raw source runs as the banner target", (ctx) => {
    const [expectedSourceRuns] = ctx.rule.values as [number];
    const unit = run('unit-live', 'Demo.UnitTests', 'running');
    const integration = run('integration-live', 'Demo.IntegrationTests', 'running', 1_000);
    const liveGroup = group(unit, integration);
    expect(liveGroup.group.runs).toHaveLength(expectedSourceRuns);

    const target = findLiveRunTarget({
      runs: [unit, integration],
      physicalRuns: {},
      groups: [liveGroup],
      selectedRunId: null,
      selectedRunGroupId: liveGroup.group.id,
    });

    expect(target?.kind).toBe('group');
    expect(target?.runGroupId).toBe(liveGroup.group.id);
    expect(target?.isSelected).toBe(true);
  });

  rule("A running partial in the physical cache uses projection 'physical'", (ctx) => {
    const [expectedView] = ctx.rule.values as ['physical'];
    const partial = run('partial-live', 'Demo.UnitTests', 'running');
    partial.run.runType = 'partial';

    const target = findLiveRunTarget({
      runs: [],
      physicalRuns: { 'partial-live': partial },
      groups: [],
      selectedRunId: null,
      selectedRunGroupId: null,
    });

    expect(target?.view).toBe(expectedView);
    expect(target?.runId).toBe('partial-live');
  });

  rule("A completed run remains resolvable for the banner's completion transition", () => {
    const completed = run('live', 'Demo', 'passed');
    const target = resolveLiveRunTarget('run:combined:live', {
      runs: [completed],
      physicalRuns: {},
      groups: [],
      selectedRunId: 'live',
      selectedRunGroupId: null,
    });

    expect(target?.run.run.status).toBe('passed');
    expect(target?.isSelected).toBe(true);
  });
});
