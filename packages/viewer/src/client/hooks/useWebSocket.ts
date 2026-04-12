import { useEffect, useRef, useCallback } from 'react';
import { makeRunState, makeSessionState, useStore, Run, Session } from '../store';
import { getApiBaseUrl, getWsBaseUrl } from '../config';
import type { V1WebSocketEvent, TestRunV1, SessionV1 } from '@swedevtools/livedoc-schema';

export function useWebSocket(skip = false) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    setConnectionStatus, 
    setRuns, 
    addRun, 
    updateRun, 
    selectRun,
    setSessions,
    addSession,
    updateSession,
    selectSession,
    setProjectHierarchy,
    upsertTestCase,
    upsertTest,
    patchTestExecution,
    upsertOutlineExampleResults
  } = useStore();

  const fetchRunById = useCallback(async (runId: string): Promise<Run | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/runs/${runId}`, {
        cache: 'no-store'
      });
      if (!response.ok) return null;
      const fullRun = (await response.json()) as TestRunV1;
      return makeRunState(fullRun);
    } catch (e) {
      console.error(`Failed to fetch run ${runId}:`, e);
      return null;
    }
  }, []);

  const fetchSessionById = useCallback(async (sessionId: string): Promise<Session | null> => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/sessions/${sessionId}`, {
        cache: 'no-store'
      });
      if (!response.ok) {
        // Session endpoint might not exist on old servers - graceful degradation
        if (response.status === 404) {
          console.debug(`Session endpoint not available (404) - server may not support sessions yet`);
        }
        return null;
      }
      const fullSession = (await response.json()) as SessionV1;
      return makeSessionState(fullSession);
    } catch (e) {
      console.debug(`Failed to fetch session ${sessionId}:`, e);
      return null;
    }
  }, []);

  // Fetch project hierarchy for navigation
  const fetchProjectHierarchy = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/hierarchy`, {
        cache: 'no-store'
      });
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.projects) {
        const hierarchy = data.projects.map((project: any) => ({
          name: project.name,
          environments: project.environments.map((env: any) => ({
            name: env.name,
            latestRun: (env.latestRun && String(env.latestRun.protocolVersion ?? '') === '1.0')
              ? makeRunState(env.latestRun as TestRunV1)
              : undefined,
            latestSession: (env.latestSession && env.latestSession.sessionId)
              ? makeSessionState(env.latestSession as SessionV1)
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
      
      // Try to fetch sessions first (Phase 1)
      try {
        const sessionsListResponse = await fetch(`${getApiBaseUrl()}/api/v1/sessions`, {
          cache: 'no-store'
        });
        
        if (sessionsListResponse.ok) {
          const sessionsList = await sessionsListResponse.json();
          const validSessions = Array.isArray(sessionsList)
            ? sessionsList.filter((s: any) => s?.sessionId)
            : [];
          
          if (validSessions.length > 0) {
            // Fetch full session data for the latest one
            const latestSessionId = validSessions[0]?.sessionId;
            if (latestSessionId) {
              const fullSession = await fetchSessionById(latestSessionId);
              if (fullSession) {
                setSessions([fullSession]);
                selectSession(latestSessionId);
                return; // Session mode - don't load individual runs
              }
            }
          }
        }
      } catch (e) {
        // Sessions endpoint might not exist - graceful fallback to runs
        console.debug('Sessions endpoint not available, falling back to runs:', e);
      }
      
      // Fallback: load runs (backward compatibility)
      const runsListResponse = await fetch(`${getApiBaseUrl()}/api/v1/runs`, {
        cache: 'no-store'
      });
      if (!runsListResponse.ok) return;
      
      const runsList = await runsListResponse.json();
      const v1RunsList = Array.isArray(runsList)
        ? runsList.filter((r: any) => String(r?.protocolVersion ?? '') === '1.0')
        : [];

      if (v1RunsList.length === 0) {
        setRuns([]);
        return;
      }
      
      const fullRuns = await Promise.all(
        v1RunsList.map(async (run: any) => {
          return fetchRunById(run.runId);
        })
      );
      
      const validRuns = fullRuns.filter((r): r is Run => r !== null);
      setRuns(validRuns);
      
      if (validRuns.length > 0) {
        selectRun(validRuns[0].run.runId);
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  }, [fetchProjectHierarchy, fetchRunById, fetchSessionById, selectRun, selectSession, setRuns, setSessions]);

  const handleSessionUpdated = useCallback(async (sessionId: string) => {
    const fullSession = await fetchSessionById(sessionId);
    if (!fullSession) return;

    const existing = useStore.getState().sessions.some((s) => s.session.sessionId === sessionId);
    if (existing) {
      updateSession(sessionId, fullSession);
    } else {
      addSession(fullSession);
    }

    // Keep the Viewer on the latest session by default
    selectSession(sessionId);
    fetchProjectHierarchy();
  }, [addSession, fetchProjectHierarchy, fetchSessionById, selectSession, updateSession]);

  const handleRunCompleted = useCallback(async (runId: string) => {
    let full = await fetchRunById(runId);
    if (!full) return;

    // The server told us this run is complete. Ensure the status is terminal
    // so the RunProgressBanner transitions from "running" → "completing" → idle.
    // The server may still store the raw status as 'running'; derive the final
    // status from test results.
    if (full.run.status === 'running') {
      const hasFailed = (full.run.documents ?? []).some(
        (d) => (d.tests ?? []).some((t: any) => t.execution?.status === 'failed')
      );
      full = makeRunState({ ...full.run, status: hasFailed ? 'failed' : 'passed' });
    }

    const existing = useStore.getState().runs.some((r) => r.run.runId === runId);
    if (existing) {
      updateRun(runId, full);
    } else {
      addRun(full);
    }

    // Keep the Viewer on the latest run by default (unless a session is selected)
    const hasSession = useStore.getState().selectedSessionId !== null;
    if (!hasSession) {
      selectRun(runId);
    }
    fetchProjectHierarchy();
  }, [addRun, fetchProjectHierarchy, fetchRunById, selectRun, updateRun]);

  const handleMessage = useCallback((message: any) => {
    const type = String(message?.type ?? '');

    switch (type) {
      case 'session:v1:updated': {
        const evt = message as V1WebSocketEvent & { type: 'session:v1:updated' };
        if (evt.sessionId) {
          void handleSessionUpdated(evt.sessionId);
        }
        break;
      }

      case 'run:v1:started': {
        const evt = message as V1WebSocketEvent & { type: 'run:v1:started' };
        if (!evt.runId) return;

        const run: TestRunV1 = {
          protocolVersion: '1.0',
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
        // Only auto-select run if no session is active
        const hasSession = useStore.getState().selectedSessionId !== null;
        if (!hasSession) {
          selectRun(evt.runId);
        }
        fetchProjectHierarchy();
        break;
      }

      case 'testcase:upsert': {
        const evt = message as V1WebSocketEvent & { type: 'testcase:upsert' };
        if (evt.runId && evt.testCase) upsertTestCase(evt.runId, evt.testCase as any);
        break;
      }

      case 'test:upsert': {
        const evt = message as V1WebSocketEvent & { type: 'test:upsert' };
        if (evt.runId && evt.testCaseId && evt.test) upsertTest(evt.runId, evt.testCaseId, evt.test as any);
        break;
      }

      case 'test:execution': {
        const evt = message as V1WebSocketEvent & { type: 'test:execution' };
        if (evt.runId && evt.testId && evt.patch?.execution) {
          patchTestExecution(evt.runId, evt.testId, { execution: evt.patch.execution as any });
        }
        break;
      }

      case 'outline:exampleResults': {
        const evt = message as V1WebSocketEvent & { type: 'outline:exampleResults' };
        if (evt.runId && evt.outlineId && Array.isArray(evt.results)) {
          upsertOutlineExampleResults(evt.runId, evt.outlineId, evt.results as any);
        }
        break;
      }

      case 'run:v1:completed': {
        const evt = message as V1WebSocketEvent & { type: 'run:v1:completed' };
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
  }, [addRun, fetchProjectHierarchy, handleRunCompleted, handleSessionUpdated, patchTestExecution, selectRun, upsertOutlineExampleResults, upsertTest, upsertTestCase]);

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
    if (skip) return;

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
  }, [connect, fetchInitialData, skip]);

  return {
    send: (data: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
  };
}
