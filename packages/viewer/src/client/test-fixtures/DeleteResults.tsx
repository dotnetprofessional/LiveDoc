import { createRoot } from 'react-dom/client';
import type { TestRunV1 } from '@swedevtools/livedoc-schema';
import { Sidebar } from '../components/Sidebar';
import { useDeepLink } from '../hooks/useDeepLink';
import { makeRunState, useStore } from '../store';
import '../index.css';

const t = Date.parse('2026-05-15T01:00:00Z');
if (new URLSearchParams(location.search).has('static')) {
  (window as Window & { __LIVEDOC_DATA__?: unknown }).__LIVEDOC_DATA__ = {};
}
const examples = [
  ['unit-1', 'Demo.UnitTests', 0],
  ['integration-1', 'Demo.IntegrationTests', 1_000],
  ['unit-2', 'Demo.UnitTests', 120_000],
  ['integration-2', 'Demo.IntegrationTests', 121_000],
  ['keep-1', 'Other', 240_000],
  ['unicode-1', 'Research/測試', 360_000],
  ['unicode-valid', '測試Suite', 480_000],
  ['orphan-1', 'Demo.SmokeTests', 600_000],
] as const;

export const fixtureRuns: TestRunV1[] = examples.map(([runId, project, offset]) => ({
  protocolVersion: '1.0',
  runId,
  project,
  environment: 'local',
  framework: 'vitest',
  timestamp: new Date(t + offset).toISOString(),
  duration: 100,
  status: 'passed',
  summary: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
  documents: [],
}));

const hierarchy = [...new Set(fixtureRuns.map((run) => run.project))].map((name) => {
  const history = fixtureRuns.filter((run) => run.project === name);
  return {
    name,
    environments: [{
      name: 'local',
      latestRun: makeRunState(history[history.length - 1]!),
      historyCount: history.length,
      history: history.slice().reverse().map(({ runId, timestamp, status, summary, runType, baselineRunId }) =>
        ({ runId, timestamp, status, summary, runType, baselineRunId })),
    }],
  };
});

useStore.setState({
  runs: fixtureRuns.map(makeRunState).reverse(),
  projectHierarchy: hierarchy,
  projectGrouping: { enabled: !new URLSearchParams(location.search).has('raw'), hideSourceProjects: true, windowMs: 60_000 },
  selectedRunId: new URLSearchParams(location.search).has('raw') ? 'unit-2' : null,
});
if (!new URLSearchParams(location.search).has('raw')) {
  const group = useStore.getState().getRunGroups().find((item) => item.group.runs.some((run) => run.runId === 'unit-2'));
  useStore.getState().selectRunGroup(group!.group.id);
}

function Fixture() {
  useDeepLink();
  const selectedRun = useStore((state) => state.selectedRunId);
  const selectedGroup = useStore((state) => state.selectedRunGroupId);
  return (
    <>
      <Sidebar />
      <output aria-label="Current selection">{selectedRun ?? selectedGroup ?? 'none'}</output>
      <button type="button" onClick={() => useStore.getState().addRun(makeRunState(fixtureRuns[2]!))}>
        Simulate late run response
      </button>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
