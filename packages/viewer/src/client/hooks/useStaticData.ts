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

    // Static data always represents a completed run — force terminal status
    if (data.status === 'running' || data.status === 'pending') {
      const hasFailed = data.documents?.some(d =>
        d.tests?.some(t => t.execution?.status === 'failed')
      );
      data.status = hasFailed ? 'failed' : 'passed';
    }

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
