import { useEffect } from 'react';
import { useStore } from '../store';

export function useVsCodeMessage() {
  const { runs, selectRun, navigate } = useStore();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || !message.command) return;

      switch (message.command) {
        case 'navigate':
            if (message.nodeId) {
                // Find run containing this node
                let targetRunId: string | undefined;
                
                for (const run of runs) {
                    if (run.nodeMap[message.nodeId]) {
                        targetRunId = run.runId;
                        break;
                    }
                }
                
                if (targetRunId) {
                    selectRun(targetRunId);
                    navigate('node', message.nodeId);
                }
            } else if (message.featureId) {
                // Back-compat for legacy navigation
                let targetRunId: string | undefined;
                for (const run of runs) {
                    if (run.nodeMap[message.featureId]) {
                        targetRunId = run.runId;
                        break;
                    }
                }
                
                if (targetRunId) {
                    selectRun(targetRunId);
                    navigate('node', message.scenarioId || message.featureId);
                }
            }
            break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [runs, selectRun, navigate]);
}
