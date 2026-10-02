import type { TestRunV1 } from '@swedevtools/livedoc-schema';
import { getApiBaseUrl } from '../config';
import { makeRunState, useStore, type ProjectNode } from '../store';
import type { LogicalRunGroup } from './run-grouping';

export function sourceProjectsForGroup(
  name: string,
  groups: LogicalRunGroup[]
): string[] {
  const members = new Set(groups
    .filter((group) => group.name === name)
    .flatMap((group) => group.runs.map((run) => run.project)));
  return [...members].sort((left, right) => left.localeCompare(right));
}

async function checkedResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error)
      : `HTTP ${response.status}`;
    throw new Error(`${message} (HTTP ${response.status})`);
  }
  return response.json();
}

export async function deleteStoredResult(kind: 'projects' | 'runs', id: string): Promise<void> {
  // Encode the entire source name as one path segment, including embedded slashes and Unicode.
  const response = await fetch(`${getApiBaseUrl()}/api/v1/${kind}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const payload = await checkedResponse(response);
  if (!payload || typeof payload !== 'object' || !('success' in payload) || payload.success !== true) {
    throw new Error('The server did not confirm deletion. Nothing was removed from this view.');
  }
}

export async function refreshStoredResults(): Promise<void> {
  const base = getApiBaseUrl();
  const [hierarchyPayload, runsPayload] = await Promise.all([
    fetch(`${base}/api/v1/hierarchy`, { cache: 'no-store' }).then(checkedResponse),
    fetch(`${base}/api/v1/runs`, { cache: 'no-store' }).then(checkedResponse),
  ]);
  if (!hierarchyPayload || typeof hierarchyPayload !== 'object' || !('projects' in hierarchyPayload)
    || !Array.isArray(hierarchyPayload.projects) || !Array.isArray(runsPayload)) {
    throw new Error('The server returned an invalid project or run list.');
  }
  const hierarchy: ProjectNode[] = hierarchyPayload.projects.map((project: {
    name: string;
    environments: Array<{
      name: string;
      latestRun?: TestRunV1;
      historyCount: number;
      history: ProjectNode['environments'][number]['history'];
    }>;
  }) => ({
    name: project.name,
    environments: project.environments.map((env) => ({
      name: env.name,
      latestRun: env.latestRun?.protocolVersion === '1.0' ? makeRunState(env.latestRun) : undefined,
      historyCount: env.historyCount,
      history: env.history ?? [],
    })),
  }));
  const availableIds = new Set<string>(runsPayload.map((run: { runId: string }) => run.runId));
  useStore.getState().reconcileServerSnapshot(hierarchy, availableIds);
}
