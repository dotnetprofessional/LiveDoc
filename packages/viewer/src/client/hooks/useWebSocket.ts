import { useEffect, useRef, useCallback } from 'react';
import { makeRunState, useStore, type DataDiagnostic, type Run } from '../store';
import { getApiBaseUrl, getWsBaseUrl } from '../config';
import type { CoverageReport, V1WebSocketEvent, TestRunV1 } from '@swedevtools/livedoc-schema';

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

export interface CoverageEventDependencies {
  fetchRunById: (runId: string) => Promise<Run | null>;
  addRun: (run: Run) => void;
  attachCoverage: (runId: string, coverage: CoverageReport) => void;
  getRun: (runId: string) => Run | undefined;
  logInfo?: (message: string) => void;
  logError?: (message: string) => void;
}

export async function applyCoverageEvent(
  runId: string,
  coverage: CoverageReport,
  dependencies: CoverageEventDependencies
): Promise<boolean> {
  const logInfo = dependencies.logInfo ?? console.info;
  const logError = dependencies.logError ?? console.error;

  if (!dependencies.getRun(runId)) {
    const hydrated = await dependencies.fetchRunById(runId);
    if (!hydrated) {
      logError(
        `[LiveDoc] LD-COV-091 viewer-coverage-application-failed: runId=${runId}; ` +
        'stage=rest-hydration; reason=run-unavailable'
      );
      return false;
    }
    dependencies.addRun(hydrated);
  }

  dependencies.attachCoverage(runId, coverage);
  const storedCoverage = dependencies.getRun(runId)?.run.coverage;
  if (!storedCoverage) {
    logError(
      `[LiveDoc] LD-COV-091 viewer-coverage-application-failed: runId=${runId}; ` +
      'stage=store-application; reason=coverage-not-present'
    );
    return false;
  }

  logInfo(
    `[LiveDoc] LD-COV-090 viewer-coverage-applied: runId=${runId}; ` +
    `status=${storedCoverage.status ?? 'unknown'}`
  );
  return true;
}

export function useWebSocket(skip = false) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasConnectedRef = useRef(false);

  const {
    setConnectionStatus,
    addRun,
    updateRun,
    removeRun,
    selectRun,
    selectRunGroup,
    followRunIfEnabled,
    upsertPhysicalRun,
    removePhysicalRun,
    setProjectHierarchy,
    setDiagnostics,
    addDiagnostic,
    upsertTestCase,
    upsertTest,
    patchTestExecution,
    upsertOutlineExampleResults,
    attachCoverage
  } = useStore();

  const fetchRunById = useCallback(async (runId: string, view?: 'combined' | 'physical'): Promise<Run | null> => {
    try {
      const query = view ? `?view=${view}` : '';
      const response = await fetch(`${getApiBaseUrl()}/api/v1/runs/${runId}${query}`, {
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

  const fetchActiveRuns = useCallback(async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/v1/runs`, { cache: 'no-store' });
      if (!response.ok) return;
      const entries = await response.json();
      const activeEntries = Array.isArray(entries)
        ? entries.filter((entry: any) => entry?.status === 'running')
        : [];
      const activeRuns = await Promise.all(
        activeEntries.map((entry: any) => fetchRunById(String(entry.runId), 'physical'))
      );
      for (const run of activeRuns) {
        if (!run) continue;
        if ((run.run.runType ?? 'full') === 'partial') {
          upsertPhysicalRun(run.run.runId, run);
        } else {
          addRun(run);
        }
      }
    } catch (error) {
      console.error('Failed to hydrate active runs:', error);
    }
  }, [addRun, fetchRunById, upsertPhysicalRun]);

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
      await fetchActiveRuns();

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
          return fetchRunById(run.runId, 'combined');
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
  }, [fetchActiveRuns, fetchDiagnostics, fetchProjectHierarchy, fetchRunById, selectBestAvailableView, addRun]);

  const handleRunCompleted = useCallback(async (runId: string, completedStatus?: string) => {
    if (completedStatus === 'cancelled') {
      removePhysicalRun(runId);
      removeRun(runId);
      if (useStore.getState().selectedRunId === runId) {
        selectRun(null);
        selectBestAvailableView();
      }
      fetchProjectHierarchy();
      return;
    }

    // Server default (no ?view=) is the physical projection; for full runs physical === combined.
    let physical = await fetchRunById(runId, 'physical');
    if (!physical) {
      addDiagnostic({
        severity: 'error',
        code: 'LD-RUN-096',
        message: `Failed to load the completed run '${runId}'. The server may be unavailable.`,
        runId,
      });
      return;
    }

    // The server told us this run is complete. Ensure the status is terminal
    // so the RunProgressBanner transitions from "running" → "completing" → idle.
    // The server may still store the raw status as 'running'; derive the final
    // status from test results.
    if (physical.run.status === 'running') {
      const hasFailed = (physical.run.documents ?? []).some(
        (d) => (d.tests ?? []).some((t: any) => t.execution?.status === 'failed')
      );
      physical = makeRunState({ ...physical.run, status: hasFailed ? 'failed' : 'passed' });
    }

    const isPartial = (physical.run.runType ?? 'full') === 'partial';

    // Always refresh the physical cache so the 'This partial' toggle stays accurate post-completion.
    upsertPhysicalRun(runId, physical);

    if (isPartial) {
      const combined = await fetchRunById(runId, 'combined');
      if (!combined) {
        addDiagnostic({
          severity: 'error',
          code: 'LD-RUN-096',
          message: `Partial run '${runId}' completed, but its combined view could not be loaded.`,
          runId,
        });
        return;
      }

      const existing = useStore.getState().runs.some((r) => r.run.runId === runId);
      if (existing) updateRun(runId, combined); else addRun(combined);
      followRunIfEnabled(runId);

    } else {
      const existing = useStore.getState().runs.some((r) => r.run.runId === runId);
      if (existing) {
        updateRun(runId, physical);
      } else {
        addRun(physical);
      }
      followRunIfEnabled(runId);
      selectBestAvailableView();
    }

    fetchProjectHierarchy();
  }, [addDiagnostic, addRun, fetchProjectHierarchy, fetchRunById, followRunIfEnabled, removePhysicalRun, removeRun, selectBestAvailableView, selectRun, updateRun, upsertPhysicalRun]);

  const reconcileCompletedPartials = useCallback(async () => {
    const state = useStore.getState();
    const completedRunIds = new Set(
      state.projectHierarchy.flatMap((project) =>
        project.environments.flatMap((environment) =>
          environment.history.map((entry) => entry.runId)
        )
      )
    );

    const stalePhysicalPartials = Object.values(state.physicalRuns)
      .filter((run) =>
        run.run.runType === 'partial' &&
        run.run.status === 'running' &&
        completedRunIds.has(run.run.runId)
      );

    await Promise.all(
      stalePhysicalPartials.map((run) => handleRunCompleted(run.run.runId))
    );
  }, [handleRunCompleted]);

  const handleMessage = useCallback((message: any) => {
    const type = String(message?.type ?? '');

    switch (type) {
      case 'run:v1:started': {
        const evt = message as V1WebSocketEvent & { type: 'run:v1:started' };
        if (!evt.runId) return;

        const runType = evt.runType ?? 'full';
        const run: TestRunV1 = {
          protocolVersion: '1.0',
          runId: evt.runId,
          runType,
          ...(evt.baselineRunId ? { baselineRunId: evt.baselineRunId } : {}),
          project: evt.project ?? 'Test Results',
          environment: evt.environment ?? 'default',
          framework: evt.framework ?? 'vitest',
          timestamp: evt.timestamp ?? new Date().toISOString(),
          status: 'running',
          duration: 0,
          summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
          documents: [],
        };

        if (runType === 'partial') {
          // Partial runs never replace the combined 'latest' — track them only in the physical
          // cache so they never leak into grouping/logical-run inputs (which read `runs`).
          upsertPhysicalRun(evt.runId, makeRunState(run));
          followRunIfEnabled(evt.runId, 'physical');
          const state = useStore.getState();
          if (!state.selectedRunGroupId && !state.selectedRunId) {
            selectRun(evt.runId, 'physical');
          }
        } else {
          addRun(makeRunState(run));
          followRunIfEnabled(evt.runId);
          const state = useStore.getState();
          if (!state.selectedRunGroupId && !state.selectedRunId) {
            selectRun(evt.runId);
          }
          selectBestAvailableView();
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
          void handleRunCompleted(evt.runId, evt.status);
        }
        break;
      }

      case 'run:v1:coverage': {
        const evt = message as V1WebSocketEvent & { type: 'run:v1:coverage' };
        if (evt.runId && evt.coverage) {
          void applyCoverageEvent(evt.runId, evt.coverage, {
            fetchRunById,
            addRun: (run) => {
              if ((run.run.runType ?? 'full') === 'partial') {
                upsertPhysicalRun(run.run.runId, run);
              } else {
                addRun(run);
              }
            },
            attachCoverage,
            getRun: (runId) => {
              const state = useStore.getState();
              const physical = state.physicalRuns[runId];
              if (physical) return physical;
              const combined = state.runs.find((run) => run.run.runId === runId);
              return combined?.run.runType === 'partial' ? undefined : combined;
            },
          });
        }
        break;
      }

      case 'pong':
        break;

      default:
        // Ignore unknown messages (future-proof)
        break;
    }
  }, [addRun, attachCoverage, fetchProjectHierarchy, fetchRunById, followRunIfEnabled, handleRunCompleted, patchTestExecution, selectBestAvailableView, selectRun, upsertOutlineExampleResults, upsertPhysicalRun, upsertTest, upsertTestCase]);

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
        void (async () => {
          await fetchProjectHierarchy();
          await Promise.all([fetchActiveRuns(), reconcileCompletedPartials()]);
        })();
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
  }, [setConnectionStatus, handleMessage, fetchActiveRuns, fetchProjectHierarchy, reconcileCompletedPartials]);

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
