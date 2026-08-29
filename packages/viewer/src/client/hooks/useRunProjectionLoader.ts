import { useEffect, useRef } from 'react';
import { makeRunState, useStore } from '../store';
import { getApiBaseUrl } from '../config';

/**
 * Lazily fetches the projection (combined or physical) needed by the current selection when it
 * isn't already cached. This keeps initial load from downloading every historical run's document
 * tree — the Sidebar's run list is built from lightweight project-hierarchy history metadata, and
 * the full TestRunV1 for a given run/projection is only fetched once the user actually selects it.
 *
 * Skipped for grouped-run selections (grouping only ever consumes the already-loaded `runs`
 * collection) and static/embedded mode (all data is provided up front).
 */
export function useRunProjectionLoader(skip = false): void {
  const {
    selectedRunId,
    selectedRunGroupId,
    selectedRunView,
    addRun,
    upsertPhysicalRun,
    addDiagnostic,
    clearRunDiagnostics,
    setPendingRunFetch,
  } = useStore();

  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (skip || selectedRunGroupId || !selectedRunId) return;

    const currentState = useStore.getState();
    const haveCombined = currentState.runs.some((r) => r.run.runId === selectedRunId);
    const havePhysical = Boolean(currentState.physicalRuns[selectedRunId]);
    const needsFetch = selectedRunView === 'physical' ? !havePhysical : !haveCombined;
    if (!needsFetch) return;

    const runId = selectedRunId;
    const view = selectedRunView;
    const key = `${runId}:${view}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    setPendingRunFetch(key);

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/runs/${runId}?view=${view}`, {
          cache: 'no-store',
        });
        if (cancelled) return;

        if (!response.ok) {
          addDiagnostic({
            severity: 'error',
            code: 'LD-RUN-095',
            message: `Failed to load the ${view} view for run '${runId}' (HTTP ${response.status}). ` +
              'The run may have been deleted, or the server may be unavailable.',
            runId,
          });
          return;
        }

        const json = await response.json();
        const run = makeRunState(json);
        if (view === 'physical') upsertPhysicalRun(runId, run);
        else addRun(run);
        clearRunDiagnostics(runId);
      } catch (error) {
        if (cancelled) return;
        addDiagnostic({
          severity: 'error',
          code: 'LD-RUN-095',
          message: `Failed to load the ${view} view for run '${runId}': ${error instanceof Error ? error.message : String(error)}`,
          runId,
        });
      } finally {
        inFlightRef.current.delete(key);
        if (useStore.getState().pendingRunFetch === key) setPendingRunFetch(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [skip, selectedRunId, selectedRunGroupId, selectedRunView, addRun, upsertPhysicalRun, addDiagnostic, clearRunDiagnostics, setPendingRunFetch]);
}
