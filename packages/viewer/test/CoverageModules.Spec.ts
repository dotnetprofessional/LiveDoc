import { expect } from 'vitest';
import { rule, specification } from '@swedevtools/livedoc-vitest';
import type { CoverageReport } from '@swedevtools/livedoc-schema';
import type { RunLike } from '../src/client/store';
import { buildCoverageTree, getCoverageSources, metricTone } from '../src/client/lib/coverage-utils';

const coverage: CoverageReport = {
  status: 'available',
  summary: {
    lines: { covered: 9, total: 20, pct: 45 },
  },
  files: [
    {
      module: 'Application',
      path: 'src/Application.cs',
      summary: { lines: { covered: 8, total: 10, pct: 80 } },
    },
    {
      module: 'Application.Tests',
      path: 'tests/ApplicationTests.cs',
      summary: { lines: { covered: 1, total: 10, pct: 10 } },
    },
  ],
};

function groupedRun(): RunLike {
  const sourceRun = {
    runId: 'source-1',
    project: 'Application.Tests',
    timestamp: '2026-08-22T00:00:00.000Z',
    duration: 10,
    summary: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
    status: 'passed' as const,
    framework: 'xunit',
    documentCount: 1,
    coverage,
  };

  return {
    run: {
      project: 'Application',
      environment: 'local',
      timestamp: sourceRun.timestamp,
      duration: sourceRun.duration,
      summary: sourceRun.summary,
      status: sourceRun.status,
      sourceRuns: [sourceRun, { ...sourceRun, runId: 'source-2' }],
    },
    itemById: {},
  };
}

specification(`Coverage Module Grouping
  Coverage is grouped by covered assembly rather than by the test projects that produced the run.
  `, () => {
  rule("Two duplicated source reports containing '2' modules produce '3' sources with an overall total of '20' lines", (ctx) => {
    const [expectedModules, expectedSources, expectedTotal] = ctx.rule.values as [number, number, number];

    const sources = getCoverageSources(groupedRun());

    expect(sources.filter((source) => source.scope === 'module')).toHaveLength(expectedModules);
    expect(sources).toHaveLength(expectedSources);
    expect(sources[0]?.label).toBe('All modules');
    expect(sources[0]?.coverage?.summary?.lines?.total).toBe(expectedTotal);
    expect(sources.map((source) => source.label)).toEqual([
      'All modules',
      'Application',
      'Application.Tests',
    ]);
  });

  rule("Coverage paths sharing '7' directory segments render '2' files directly at the module root", (ctx) => {
    const [sharedSegments, expectedFiles] = ctx.rule.values as [number, number];
    const prefix = Array.from({ length: sharedSegments }, (_, index) => `segment-${index}`).join('/');
    const files = Array.from({ length: expectedFiles }, (_, index) => ({
      path: `${prefix}/File${index + 1}.cs`,
      summary: { lines: { covered: 1, total: 1, pct: 100 } },
    }));

    const tree = buildCoverageTree(files);

    expect(tree).toHaveLength(expectedFiles);
    expect(tree.every((node) => node.type === 'file')).toBe(true);
  });

  rule("Coverage '49.9' is 'critical', '50' and '84.9' are 'warning', '85' is 'healthy', and missing coverage is 'muted'", (ctx) => {
    const [
      criticalPct,
      expectedCritical,
      warningMin,
      warningMax,
      expectedWarning,
      healthyMin,
      expectedHealthy,
      expectedMuted,
    ] = ctx.rule.values as [number, string, number, number, string, number, string, string];
    const metric = (pct: number) => ({ covered: pct, total: 100, pct });

    expect(metricTone(metric(criticalPct))).toBe(expectedCritical);
    expect(metricTone(metric(warningMin))).toBe(expectedWarning);
    expect(metricTone(metric(warningMax))).toBe(expectedWarning);
    expect(metricTone(metric(healthyMin))).toBe(expectedHealthy);
    expect(metricTone(undefined)).toBe(expectedMuted);
  });
});
