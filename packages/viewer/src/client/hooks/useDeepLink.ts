import { useCallback, useEffect, useRef, useState } from 'react';
import { makeRunState, useStore } from '../store';
import { getApiBaseUrl, isEmbedded } from '../config';
import {
  buildHash,
  parseDeepLinkContext,
  resolveHashAgainstCandidates,
  type DeepLinkCandidate,
  type DeepLinkResolution,
} from '../lib/deep-link';

/**
 * Syncs the browser URL hash with the viewer's navigation state.
 * - Store → URL: navigation changes update the hash
 * - URL → Store: hash changes (back/forward, direct link) trigger navigation
 * - Skipped in embedded mode (VS Code controls navigation via postMessage)
 */
export function useDeepLink(): void {
  const {
    currentView,
    navigate,
    getCurrentRun,
    getRunGroups,
    runs,
    physicalRuns,
    selectedRunId,
    selectedRunGroupId,
    selectedRunView,
    selectRun,
    selectRunGroup,
    addRun,
    addDiagnostic,
    projectGrouping,
    unresolvedDeepLink,
    setUnresolvedDeepLink,
  } = useStore();
  const suppressHashUpdate = useRef(false);
  const hydratingSourceRuns = useRef(new Set<string>());
  const [embedded] = useState(() => isEmbedded());

  // Capture the initial hash synchronously before any effects run
  const initialHash = useRef<string | undefined>(undefined);
  const initialResolved = useRef(false);
  if (initialHash.current === undefined) {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    initialHash.current = (hash && hash !== '#' && hash !== '#/') ? hash : '';
  }

  const getDeepLinkCandidates = useCallback((): DeepLinkCandidate[] => {
    const candidates: DeepLinkCandidate[] = [];
    const seen = new Set<string>();
    const groups = getRunGroups();
    const physicalRequested = parseDeepLinkContext(window.location.hash).runView === 'physical';

    const addCandidate = (candidate: DeepLinkCandidate, key: string) => {
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(candidate);
    };

    if (selectedRunGroupId) {
      const selectedGroup = groups.find((group) => group.group.id === selectedRunGroupId);
      if (selectedGroup) {
        addCandidate({ run: selectedGroup, runGroupId: selectedGroup.group.id }, `group:${selectedGroup.group.id}`);
      }
    }

    if (selectedRunId) {
      const selectedRun = physicalRequested
        ? physicalRuns[selectedRunId] ?? runs.find((run) => run.run.runId === selectedRunId)
        : runs.find((run) => run.run.runId === selectedRunId) ?? physicalRuns[selectedRunId];
      if (selectedRun) {
        addCandidate({ run: selectedRun, runId: selectedRunId }, `run:${selectedRunId}`);
      }
    }

    for (const group of groups) {
      addCandidate({ run: group, runGroupId: group.group.id }, `group:${group.group.id}`);
    }

    const addCombinedRuns = () => {
      for (const run of runs) {
        addCandidate({ run, runId: run.run.runId }, `run:${run.run.runId}`);
      }
    };
    const addPhysicalRuns = () => {
      for (const [runId, run] of Object.entries(physicalRuns)) {
        addCandidate({ run, runId }, `run:${runId}`);
      }
    };
    if (physicalRequested) {
      addPhysicalRuns();
      addCombinedRuns();
    } else {
      addCombinedRuns();
      addPhysicalRuns();
    }

    return candidates;
  }, [getRunGroups, physicalRuns, projectGrouping, runs, selectedRunGroupId, selectedRunId]);

  const initialContextRef = useRef<ReturnType<typeof parseDeepLinkContext> | null>(null);
  if (initialContextRef.current === null) {
    initialContextRef.current = parseDeepLinkContext(initialHash.current ?? '');
  }
  const initialContext = initialContextRef.current;

  useEffect(() => {
    if (embedded || !initialHash.current || initialResolved.current) return;

    if (
      initialContext.runId &&
      !runs.some((run) => run.run.runId === initialContext.runId) &&
      !physicalRuns[initialContext.runId]
    ) {
      selectRun(initialContext.runId, initialContext.runView ?? 'combined');
    }

    const missingSourceRunIds = (initialContext.sourceRunIds ?? []).filter(
      (runId) =>
        !runs.some((run) => run.run.runId === runId) &&
        !hydratingSourceRuns.current.has(runId)
    );
    for (const runId of missingSourceRunIds) {
      hydratingSourceRuns.current.add(runId);
      void fetch(`${getApiBaseUrl()}/api/v1/runs/${runId}?view=combined`, { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          addRun(makeRunState(await response.json()));
        })
        .catch((error) => {
          addDiagnostic({
            severity: 'error',
            code: 'LD-RUN-095',
            message: `Failed to load source run '${runId}' for a grouped deep link: ${
              error instanceof Error ? error.message : String(error)
            }`,
            runId,
          });
        })
        .finally(() => {
          hydratingSourceRuns.current.delete(runId);
        });
    }
  }, [
    addDiagnostic,
    addRun,
    embedded,
    initialContext.runId,
    initialContext.runView,
    initialContext.sourceRunIds,
    physicalRuns,
    runs,
    selectRun,
  ]);

  const applyDeepLinkResolution = useCallback((resolution: DeepLinkResolution) => {
    suppressHashUpdate.current = true;

    if (resolution.runGroupId) {
      if (selectedRunGroupId !== resolution.runGroupId) {
        selectRunGroup(resolution.runGroupId);
      }
    } else if (resolution.runId) {
      const view = resolution.runView ?? 'combined';
      if (selectedRunId !== resolution.runId || selectedRunGroupId || selectedRunView !== view) {
        selectRun(resolution.runId, view);
      }
    }

    navigate(resolution.view.type, resolution.view.id);
  }, [navigate, selectRun, selectRunGroup, selectedRunGroupId, selectedRunId, selectedRunView]);

  const reportUnresolvedHash = useCallback((hash: string) => {
    initialResolved.current = true;
    setUnresolvedDeepLink(hash);
  }, [setUnresolvedDeepLink]);

  // ── Store → URL: update hash when navigation changes ──────────
  useEffect(() => {
    if (embedded) return;
    // Don't overwrite URL until the initial hash has been resolved
    if (initialHash.current && !initialResolved.current) return;

    if (suppressHashUpdate.current) {
      suppressHashUpdate.current = false;
      return;
    }

    const run = getCurrentRun();
    const selectedGroup = selectedRunGroupId
      ? getRunGroups().find((group) => group.group.id === selectedRunGroupId)
      : undefined;
    const hash = buildHash(currentView, run, {
      project: run?.run.project,
      environment: run?.run.environment,
      runId: !selectedRunGroupId ? selectedRunId ?? undefined : undefined,
      runGroupId: selectedRunGroupId ?? undefined,
      sourceRunIds: selectedGroup?.group.runs.map((sourceRun) => sourceRun.runId),
      runView: !selectedRunGroupId ? selectedRunView : undefined,
    });
    const currentHash = window.location.hash;

    if (unresolvedDeepLink && currentHash === unresolvedDeepLink.hash) {
      return;
    }

    // Only update if hash actually changed (avoid pushing duplicate history)
    if (hash !== currentHash && !(hash === '' && currentHash === '')) {
      window.history.pushState(null, '', hash || window.location.pathname + window.location.search);
    }
  }, [
    embedded,
    currentView,
    getCurrentRun,
    getRunGroups,
    selectedRunGroupId,
    selectedRunId,
    selectedRunView,
    unresolvedDeepLink,
  ]);

  // ── Resolve initial hash when run data becomes available ──────
  useEffect(() => {
    if (embedded || !initialHash.current || initialResolved.current) return;

    const candidates = getDeepLinkCandidates();
    if (candidates.length === 0) return; // Data not loaded yet — wait
    if (
      initialContext.runId &&
      !candidates.some((candidate) => candidate.runId === initialContext.runId)
    ) return;
    if (
      initialContext.runGroupId &&
      (initialContext.sourceRunIds ?? []).some(
        (runId) => !runs.some((run) => run.run.runId === runId)
      )
    ) return;

    const resolved = resolveHashAgainstCandidates(initialHash.current, candidates);
    if (!resolved) {
      reportUnresolvedHash(initialHash.current);
      return;
    }
    initialResolved.current = true;

    applyDeepLinkResolution(resolved);
  }, [
    applyDeepLinkResolution,
    embedded,
    getDeepLinkCandidates,
    initialContext.runGroupId,
    initialContext.runId,
    initialContext.sourceRunIds,
    reportUnresolvedHash,
    runs,
  ]);

  // ── Retry unresolved hashes when more run/group data becomes available ─
  useEffect(() => {
    if (embedded || !unresolvedDeepLink) return;
    if (window.location.hash !== unresolvedDeepLink.hash) return;

    const resolved = resolveHashAgainstCandidates(unresolvedDeepLink.hash, getDeepLinkCandidates());
    if (resolved) {
      applyDeepLinkResolution(resolved);
    }
  }, [applyDeepLinkResolution, embedded, getDeepLinkCandidates, unresolvedDeepLink]);

  // ── Handle browser back/forward ───────────────────────────────
  useEffect(() => {
    if (embedded) return;

    function onHashNavigation() {
      const hash = window.location.hash;
      const resolved = resolveHashAgainstCandidates(hash, getDeepLinkCandidates());

      if (resolved) {
        applyDeepLinkResolution(resolved);
      } else if (hash && hash !== '#' && hash !== '#/') {
        reportUnresolvedHash(hash);
      }
    }

    window.addEventListener('popstate', onHashNavigation);
    window.addEventListener('hashchange', onHashNavigation);
    return () => {
      window.removeEventListener('popstate', onHashNavigation);
      window.removeEventListener('hashchange', onHashNavigation);
    };
  }, [applyDeepLinkResolution, embedded, getDeepLinkCandidates, reportUnresolvedHash]);
}
