import { expect } from 'vitest';
import { specification, rule } from '@swedevtools/livedoc-vitest';
import type { Statistics, TestRunV1 } from '@swedevtools/livedoc-schema';
import {
  buildLogicalRunGroups,
  latestLogicalRunGroups,
  type LogicalRunGroup,
  type ProjectGroupingSettings,
} from '../src/client/lib/run-grouping';

const baseTime = Date.parse('2026-05-15T01:00:00.000Z');

const settings: ProjectGroupingSettings = {
  enabled: true,
  hideSourceProjects: true,
  windowMs: 60_000,
};

function summary(): Statistics {
  return { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 };
}

function run(runId: string, project: string, offsetMs: number): TestRunV1 {
  return {
    protocolVersion: '1.0',
    runId,
    project,
    environment: 'local',
    framework: 'xunit',
    timestamp: new Date(baseTime + offsetMs).toISOString(),
    duration: 100,
    status: 'passed',
    summary: summary(),
    documents: [],
  };
}

function expectGroupRunIds(group: LogicalRunGroup, expectedRunIds: string[]) {
  expect(group.runs.map((sourceRun) => sourceRun.runId).sort()).toEqual([...expectedRunIds].sort());
}

specification(`Viewer Run Grouping
  Logical project grouping should represent one solution/test run at a time.
  `, () => {
  rule("Repeated project ids split one solution run into '2' logical groups", (ctx) => {
    const [expectedGroupCount] = ctx.rule.values as [number];
    const groups = buildLogicalRunGroups(
      [
        run('unit-1', 'Demo.UnitTests', 0),
        run('integration-1', 'Demo.IntegrationTests', 1_000),
        run('unit-2', 'Demo.UnitTests', 20_000),
        run('integration-2', 'Demo.IntegrationTests', 21_000),
      ],
      settings
    );

    expect(groups).toHaveLength(expectedGroupCount);
    expectGroupRunIds(groups[0]!, ['unit-2', 'integration-2']);
    expectGroupRunIds(groups[1]!, ['unit-1', 'integration-1']);
  });

  rule("Partial rerun leaves only the original multi-project group grouped as '1' group", (ctx) => {
    const [expectedGroupCount] = ctx.rule.values as [number];
    const groups = buildLogicalRunGroups(
      [
        run('unit-1', 'Demo.UnitTests', 0),
        run('integration-1', 'Demo.IntegrationTests', 1_000),
        run('unit-2', 'Demo.UnitTests', 20_000),
      ],
      settings
    );

    expect(groups).toHaveLength(expectedGroupCount);
    expectGroupRunIds(groups[0]!, ['unit-1', 'integration-1']);
  });

  rule("Duplicate-triggered split resets the time window and still forms '2' groups", (ctx) => {
    const [expectedGroupCount] = ctx.rule.values as [number];
    const groups = buildLogicalRunGroups(
      [
        run('unit-1', 'Demo.UnitTests', 0),
        run('integration-1', 'Demo.IntegrationTests', 1_000),
        run('unit-2', 'Demo.UnitTests', 30_000),
        run('integration-2', 'Demo.IntegrationTests', 85_000),
      ],
      settings
    );

    expect(groups).toHaveLength(expectedGroupCount);
    expectGroupRunIds(groups[0]!, ['unit-2', 'integration-2']);
    expectGroupRunIds(groups[1]!, ['unit-1', 'integration-1']);
  });

  rule("Back-to-back duplicate project ids keep only the latest complete solution run in '2' groups", (ctx) => {
    const [expectedGroupCount] = ctx.rule.values as [number];
    const groups = buildLogicalRunGroups(
      [
        run('unit-1', 'Demo.UnitTests', 0),
        run('integration-1', 'Demo.IntegrationTests', 1_000),
        run('unit-2', 'Demo.UnitTests', 20_000),
        run('unit-3', 'Demo.UnitTests', 21_000),
        run('integration-2', 'Demo.IntegrationTests', 22_000),
      ],
      settings
    );

    expect(groups).toHaveLength(expectedGroupCount);
    expectGroupRunIds(groups[0]!, ['unit-3', 'integration-2']);
    expectGroupRunIds(groups[1]!, ['unit-1', 'integration-1']);
  });

  rule("'2' historical groups for one project and environment produce '1' current project entry", (ctx) => {
    const [historicalGroupCount, expectedProjectEntries] = ctx.rule.values as [number, number];
    const groups = buildLogicalRunGroups(
      [
        run('unit-1', 'Demo.UnitTests', 0),
        run('integration-1', 'Demo.IntegrationTests', 1_000),
        run('unit-2', 'Demo.UnitTests', 20_000),
        run('integration-2', 'Demo.IntegrationTests', 21_000),
      ],
      settings
    );

    expect(groups).toHaveLength(historicalGroupCount);
    const latest = latestLogicalRunGroups(groups);
    expect(latest).toHaveLength(expectedProjectEntries);
    expectGroupRunIds(latest[0]!, ['unit-2', 'integration-2']);
  });
});
