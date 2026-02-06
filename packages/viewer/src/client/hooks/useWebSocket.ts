import { useEffect, useRef, useCallback } from 'react';
import { makeRunState, useStore, Run } from '../store';
import { getApiBaseUrl, getWsBaseUrl } from '../config';
import type { V3WebSocketEvent, TestRunV3 } from '@swedevtools/livedoc-schema';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    setConnectionStatus, 
    setRuns, 
    addRun, 
    updateRun, 
    selectRun, 
    setProjectHierarchy,
    upsertTestCase,
    upsertTest,
    patchTestExecution,
    upsertOutlineExampleResults
  } = useStore();

  const fetchRunById = useCallback(async (runId: string): Promise<Run | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v3/runs/${runId}`, {
        cache: 'no-store'
      });
      if (!response.ok) return null;
      const fullRun = (await response.json()) as TestRunV3;
      return makeRunState(fullRun);
    } catch (e) {
      console.error(`Failed to fetch run ${runId}:`, e);
      return null;
    }
  }, []);

  // Fetch project hierarchy for navigation
  const fetchProjectHierarchy = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v3/hierarchy`, {
        cache: 'no-store'
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.projects) {
        const hierarchy = data.projects.map((project: any) => ({
          name: project.name,
          environments: project.environments.map((env: any) => ({
            name: env.name,
            latestRun: (env.latestRun && String(env.latestRun.protocolVersion ?? '') === '3.0')
              ? makeRunState(env.latestRun as TestRunV3)
              : undefined,
            historyCount: env.historyCount,
            history: env.history || [],
          })),
        }));
        setProjectHierarchy(hierarchy);
      }
    } catch (error) {
      console.error('Failed to fetch project hierarchy:', error);
    }
  }, [setProjectHierarchy]);

  // Fetch initial data via REST API
  const fetchInitialData = useCallback(async () => {
    try {
      await fetchProjectHierarchy();
      
      const runsListResponse = await fetch(`${getApiBaseUrl()}/api/v3/runs`, {
        cache: 'no-store'
      });
      if (!runsListResponse.ok) return;
      
      const runsList = await runsListResponse.json();
      const v3RunsList = Array.isArray(runsList)
        ? runsList.filter((r: any) => String(r?.protocolVersion ?? '') === '3.0')
        : [];

      if (v3RunsList.length === 0) {
        setRuns([]);
        return;
      }
      
      const fullRuns = await Promise.all(
        v3RunsList.map(async (run: any) => {
          return fetchRunById(run.runId);
        })
      );
      
      const validRuns = fullRuns.filter((r): r is Run => r !== null);
      setRuns(validRuns);
      
      if (validRuns.length > 0) {
        selectRun(validRuns[0].run.runId);
      }
    } catch (error) {
      console.error('Failed to fetch initial runs:', error);
    }
  }, [fetchProjectHierarchy, fetchRunById, selectRun, setRuns]);

  const handleRunCompleted = useCallback(async (runId: string) => {
    const full = await fetchRunById(runId);
    if (!full) return;

    const existing = useStore.getState().runs.some((r) => r.run.runId === runId);
    if (existing) {
      updateRun(runId, full);
    } else {
      addRun(full);
    }

    // Keep the Viewer on the latest run by default.
    selectRun(runId);
    fetchProjectHierarchy();
  }, [addRun, fetchProjectHierarchy, fetchRunById, selectRun, updateRun]);

  const handleMessage = useCallback((message: any) => {
    const type = String(message?.type ?? '');

    switch (type) {
      case 'run:v3:started': {
        const evt = message as V3WebSocketEvent & { type: 'run:v3:started' };
        if (!evt.runId) return;

        const run: TestRunV3 = {
          protocolVersion: '3.0',
          runId: evt.runId,
          project: evt.project ?? 'Test Results',
          environment: evt.environment ?? 'default',
          framework: evt.framework ?? 'vitest',
          timestamp: evt.timestamp ?? new Date().toISOString(),
          status: 'running',
          duration: 0,
          summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
          documents: [],
        };

        addRun(makeRunState(run));
        selectRun(evt.runId);
        fetchProjectHierarchy();
        break;
      }

      case 'testcase:upsert': {
        const evt = message as V3WebSocketEvent & { type: 'testcase:upsert' };
        if (evt.runId && evt.testCase) upsertTestCase(evt.runId, evt.testCase as any);
        break;
      }

      case 'test:upsert': {
        const evt = message as V3WebSocketEvent & { type: 'test:upsert' };
        if (evt.runId && evt.testCaseId && evt.test) upsertTest(evt.runId, evt.testCaseId, evt.test as any);
        break;
      }

      case 'test:execution': {
        const evt = message as V3WebSocketEvent & { type: 'test:execution' };
        if (evt.runId && evt.testId && evt.patch?.execution) {
          patchTestExecution(evt.runId, evt.testId, { execution: evt.patch.execution as any });
        }
        break;
      }

      case 'outline:exampleResults': {
        const evt = message as V3WebSocketEvent & { type: 'outline:exampleResults' };
        if (evt.runId && evt.outlineId && Array.isArray(evt.results)) {
          upsertOutlineExampleResults(evt.runId, evt.outlineId, evt.results as any);
        }
        break;
      }

      case 'run:v3:completed': {
        const evt = message as V3WebSocketEvent & { type: 'run:v3:completed' };
        if (evt.runId) {
          void handleRunCompleted(evt.runId);
        }
        break;
      }

      case 'pong':
        break;

      default:
        // Ignore unknown messages (future-proof)
        break;
    }
  }, [addRun, fetchProjectHierarchy, handleRunCompleted, patchTestExecution, selectRun, upsertOutlineExampleResults, upsertTest, upsertTestCase]);

  const connect = useCallback(() => {
    const wsUrl = `${getWsBaseUrl()}/ws`;
    
    setConnectionStatus('connecting');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      setConnectionStatus('connected');

      // Subscribe to all project/environment updates so we receive run events.
      // Without this, the server won't broadcast to this client.
      try {
        ws.send(JSON.stringify({ type: 'subscribe' }));
      } catch {
        // ignore
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      setConnectionStatus('disconnected');
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
    };
  }, [setConnectionStatus, handleMessage]);

  useEffect(() => {
    fetchInitialData();
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, fetchInitialData]);

  return {
    send: (data: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
  };
}
