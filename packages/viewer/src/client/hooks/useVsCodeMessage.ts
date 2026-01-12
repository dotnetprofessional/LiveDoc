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
          if (!message.nodeId) break;

          // Find run containing this node
          let targetRunId: string | undefined;
          for (const run of runs) {
            if (run.itemById[message.nodeId]) {
              targetRunId = run.run.runId;
              break;
            }
          }

          if (targetRunId) {
            selectRun(targetRunId);
            navigate('node', message.nodeId);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [runs, selectRun, navigate]);
}
