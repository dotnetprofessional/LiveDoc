import { useEffect, useState } from 'react';
import { isStaticMode, getStaticData } from '../config';
import { makeRunState, useStore, type ProjectNode } from '../store';
import { validateTestRunData } from '../lib/run-validation';

export function useStaticData(): boolean {
  const [isStatic] = useState(() => isStaticMode());

  const { setRuns, selectRun, setConnectionStatus, setProjectHierarchy, setDiagnostics } = useStore();

  useEffect(() => {
    if (!isStatic) return;

    const { run: validatedRun, diagnostic } = validateTestRunData(getStaticData(), 'Embedded static report data');
    if (diagnostic) {
      setDiagnostics([diagnostic]);
      setConnectionStatus('error');
      return;
    }

    if (!validatedRun) return;

    const data = { ...validatedRun };
    setDiagnostics([]);

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
  }, [isStatic, selectRun, setConnectionStatus, setDiagnostics, setProjectHierarchy, setRuns]);

  return isStatic;
}
