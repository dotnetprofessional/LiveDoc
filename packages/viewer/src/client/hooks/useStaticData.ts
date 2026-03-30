import { useEffect, useState } from 'react';
import { isStaticMode, getStaticData } from '../config';
import { makeRunState, useStore, type ProjectNode } from '../store';
import type { TestRunV1 } from '@swedevtools/livedoc-schema';

export function useStaticData(): boolean {
  const [isStatic] = useState(() => isStaticMode());

  const { setRuns, selectRun, setConnectionStatus, setProjectHierarchy } = useStore();

  useEffect(() => {
    if (!isStatic) return;

    const data = getStaticData() as TestRunV1 | undefined;
    if (!data) return;

    const run = makeRunState(data);

    setRuns([run]);
    selectRun(data.runId);
    setConnectionStatus('connected');

    const hierarchy: ProjectNode[] = [{
      name: data.project || 'Test Results',
      environments: [{
        name: data.environment || 'default',
        latestRun: run,
        historyCount: 1,
        history: [{
          runId: data.runId,
          timestamp: data.timestamp,
          status: data.status,
          summary: data.summary,
        }],
      }],
    }];
    setProjectHierarchy(hierarchy);
  }, [isStatic, selectRun, setConnectionStatus, setProjectHierarchy, setRuns]);

  return isStatic;
}
