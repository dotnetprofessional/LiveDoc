import { useEffect } from 'react';
import { useStore } from '../store';

export function useVsCodeMessage() {
  const { runs, physicalRuns, selectRun, navigate } = useStore();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || !message.command) return;

      switch (message.command) {
        case 'navigate':
          if (!message.nodeId) break;

          // Find run containing this node — check combined runs first, then active/physical-only runs.
          let targetRunId: string | undefined;
          let targetRunView: 'combined' | 'physical' = 'combined';
          for (const run of runs) {
            if (run.itemById[message.nodeId]) {
              targetRunId = run.run.runId;
              break;
            }
          }
          if (!targetRunId) {
            for (const [runId, run] of Object.entries(physicalRuns)) {
              if (run.itemById[message.nodeId]) {
                targetRunId = runId;
                targetRunView = 'physical';
                break;
              }
            }
          }

          if (targetRunId) {
            selectRun(targetRunId, targetRunView);
            navigate('node', message.nodeId);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [runs, physicalRuns, selectRun, navigate]);
}
