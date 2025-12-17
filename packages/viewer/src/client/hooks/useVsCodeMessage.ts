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
            if (message.featureId) {
                // Find run containing this feature
                let targetRunId: string | undefined;
                
                // Check all runs
                for (const run of runs) {
                    const feature = run.features.find(f => f.id === message.featureId);
                    if (feature) {
                        targetRunId = run.runId;
                        break;
                    }
                }
                
                if (targetRunId) {
                    selectRun(targetRunId);
                    if (message.scenarioId) {
                        navigate('scenario', undefined, message.featureId, message.scenarioId);
                    } else {
                        navigate('feature', undefined, message.featureId);
                    }
                }
            }
            break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [runs, selectRun, navigate]);
}
