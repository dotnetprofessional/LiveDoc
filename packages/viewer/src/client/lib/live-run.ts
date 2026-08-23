import type { Run, RunGroup, RunProjection } from '../store';

export interface LiveRunTarget {
  key: string;
  kind: 'run' | 'group';
  run: Run;
  runId?: string;
  runGroupId?: string;
  view: RunProjection;
  isSelected: boolean;
}

interface LiveRunState {
  runs: Run[];
  physicalRuns: Record<string, Run>;
  groups: RunGroup[];
  selectedRunId: string | null;
  selectedRunGroupId: string | null;
}

function timestampMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupTarget(group: RunGroup, selectedRunGroupId: string | null): LiveRunTarget {
  return {
    key: `group:${group.group.id}`,
    kind: 'group',
    run: group,
    runGroupId: group.group.id,
    view: 'combined',
    isSelected: selectedRunGroupId === group.group.id,
  };
}

function runTarget(
  run: Run,
  runId: string,
  view: RunProjection,
  selectedRunId: string | null
): LiveRunTarget {
  return {
    key: `run:${view}:${runId}`,
    kind: 'run',
    run,
    runId,
    view,
    isSelected: selectedRunId === runId,
  };
}

export function findLiveRunTarget(state: LiveRunState): LiveRunTarget | undefined {
  const activeGroups = state.groups.filter((group) =>
    group.group.runs.some((run) => run.status === 'running')
  );
  const groupedRunIds = new Set(
    activeGroups.flatMap((group) => group.group.runs.map((run) => run.runId))
  );
  const candidates: LiveRunTarget[] = [
    ...activeGroups.map((group) => groupTarget(group, state.selectedRunGroupId)),
    ...state.runs
      .filter((run) => run.run.status === 'running' && !groupedRunIds.has(run.run.runId))
      .map((run) => runTarget(run, run.run.runId, 'combined', state.selectedRunId)),
    ...Object.entries(state.physicalRuns)
      .filter(([, run]) => run.run.status === 'running')
      .map(([runId, run]) => runTarget(run, runId, 'physical', state.selectedRunId)),
  ];

  const selected = candidates.find((candidate) => candidate.isSelected);
  if (selected) return selected;

  return candidates.sort((left, right) =>
    timestampMs(right.run.run.timestamp) - timestampMs(left.run.run.timestamp)
  )[0];
}

export function resolveLiveRunTarget(
  key: string | undefined,
  state: LiveRunState
): LiveRunTarget | undefined {
  if (!key) return undefined;

  if (key.startsWith('group:')) {
    const groupId = key.slice('group:'.length);
    const group = state.groups.find((candidate) => candidate.group.id === groupId);
    return group ? groupTarget(group, state.selectedRunGroupId) : undefined;
  }

  const match = /^run:(combined|physical):(.+)$/.exec(key);
  if (!match) return undefined;
  const view = match[1] as RunProjection;
  const runId = match[2]!;
  const run = view === 'physical'
    ? state.physicalRuns[runId] ?? state.runs.find((candidate) => candidate.run.runId === runId)
    : state.runs.find((candidate) => candidate.run.runId === runId) ?? state.physicalRuns[runId];
  return run ? runTarget(run, runId, view, state.selectedRunId) : undefined;
}
