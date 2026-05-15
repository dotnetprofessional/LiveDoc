import { useEffect, useRef, useCallback } from 'react';
import { makeRunState, useStore, type DataDiagnostic, type Run } from '../store';
import { getApiBaseUrl, getWsBaseUrl } from '../config';
import type { V1WebSocketEvent, TestRunV1 } from '@swedevtools/livedoc-schema';

function hasRunDocuments(run: Run | undefined): boolean {
  return (run?.run.documents?.length ?? 0) > 0;
}

function timestampMs(value: string | undefined): number {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : 0;
}

function latestRun(runs: Run[]): Run | undefined {
  return runs
    .slice()
    .sort((a, b) => timestampMs(b.run.timestamp) - timestampMs(a.run.timestamp))[0];
}

export function useWebSocket(skip = false) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasConnectedRef = useRef(false);

  const {
    setConnectionStatus,
    addRun,
    updateRun,
    selectRun,
    selectRunGroup,
    setProjectHierarchy,
    setDiagnostics,
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

  const fetchDiagnostics = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/diagnostics`, {
        cache: 'no-store'
      });
      if (!response.ok) return;

      const payload = await response.json();
      const diagnostics = Array.isArray(payload?.diagnostics)
        ? (payload.diagnostics as DataDiagnostic[])
        : [];
      setDiagnostics(diagnostics);
    } catch {
      // Older servers do not expose diagnostics; absence of the endpoint is not itself a viewer error.
    }
  }, [setDiagnostics]);

  // Fetch project hierarchy for navigation
  const fetchProjectHierarchy = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/hierarchy`, {
        cache: 'no-store'
      });
      if (!response.ok) return [] as ReturnType<typeof useStore.getState>['projectHierarchy'];

      const data = await response.json();
      if (data.projects) {
        const hierarchy = data.projects.map((project: any) => ({
          name: project.name,
          environments: project.environments.map((env: any) => ({
            name: env.name,
            latestRun: (env.latestRun && String(env.latestRun.protocolVersion ?? '') === '1.0')
              ? makeRunState(env.latestRun as TestRunV1)
              : undefined,
            historyCount: env.historyCount,
            history: env.history || [],
          })),
        }));
        setProjectHierarchy(hierarchy);
        return hierarchy;
      }
      return [] as ReturnType<typeof useStore.getState>['projectHierarchy'];
    } catch (error) {
      console.error('Failed to fetch project hierarchy:', error);
      return [] as ReturnType<typeof useStore.getState>['projectHierarchy'];
    }
  }, [setProjectHierarchy]);

  const selectBestAvailableView = useCallback(() => {
    const state = useStore.getState();
    const groups = state.getRunGroups();
    if (state.projectGrouping.enabled && groups.length > 0) {
      if (state.selectedRunGroupId && groups.some((group) => group.group.id === state.selectedRunGroupId)) {
        return;
      }

      if (state.selectedRunId) {
        const containingGroup = groups.find((group) =>
          group.group.runs.some((run) => run.runId === state.selectedRunId)
        );
        if (containingGroup) selectRunGroup(containingGroup.group.id);
        return;
      }

      selectRunGroup(groups[0].group.id);
      return;
    }

    const newestRun = latestRun(state.runs.filter(hasRunDocuments));
    if (!state.selectedRunId && newestRun) selectRun(newestRun.run.runId);
  }, [selectRun, selectRunGroup]);

  // Fetch initial data via REST API
  const fetchInitialData = useCallback(async () => {
    try {
      await fetchDiagnostics();
      const hierarchy = await fetchProjectHierarchy();

      if (hierarchy.length > 0) {
        for (const proj of hierarchy) {
          for (const env of proj.environments) {
            if (env.latestRun && hasRunDocuments(env.latestRun)) addRun(env.latestRun);
          }
        }

        if (useStore.getState().runs.length > 0) {
          selectBestAvailableView();
          return;
        }
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
        return;
      }

      const fullRuns = await Promise.all(
        v1RunsList.map(async (run: any) => {
          return fetchRunById(run.runId);
        })
      );

      const validRuns = fullRuns.filter((r): r is Run => r !== null);
      // vx-3: upsert each run instead of replacing entire array
      validRuns.forEach(r => addRun(r));

      if (validRuns.length > 0) {
        selectBestAvailableView();
      }
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
    }
  }, [fetchDiagnostics, fetchProjectHierarchy, fetchRunById, selectBestAvailableView, addRun]);

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

    selectBestAvailableView();
    fetchProjectHierarchy();
  }, [addRun, fetchProjectHierarchy, fetchRunById, selectBestAvailableView, updateRun]);

  const handleMessage = useCallback((message: any) => {
    const type = String(message?.type ?? '');

    switch (type) {
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
        const state = useStore.getState();
        if (!state.selectedRunGroupId && !state.selectedRunId) {
          selectRun(evt.runId);
        }
        selectBestAvailableView();
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
  }, [addRun, fetchProjectHierarchy, handleRunCompleted, patchTestExecution, selectBestAvailableView, selectRun, upsertOutlineExampleResults, upsertTest, upsertTestCase]);

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

      // On reconnect, refresh hierarchy so missed run completions are recovered.
      if (hasConnectedRef.current) {
        void fetchProjectHierarchy();
      }
      hasConnectedRef.current = true;

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
  }, [setConnectionStatus, handleMessage, fetchProjectHierarchy]);

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
