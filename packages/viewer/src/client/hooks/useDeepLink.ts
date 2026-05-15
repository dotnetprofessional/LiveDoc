import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { isEmbedded } from '../config';
import { buildHash, resolveHashAgainstCandidates, type DeepLinkCandidate, type DeepLinkResolution } from '../lib/deep-link';

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
    selectedRunId,
    selectedRunGroupId,
    selectRun,
    selectRunGroup,
    projectGrouping,
    unresolvedDeepLink,
    setUnresolvedDeepLink,
  } = useStore();
  const suppressHashUpdate = useRef(false);
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
      const selectedRun = runs.find((run) => run.run.runId === selectedRunId);
      if (selectedRun) {
        addCandidate({ run: selectedRun, runId: selectedRun.run.runId }, `run:${selectedRun.run.runId}`);
      }
    }

    for (const group of groups) {
      addCandidate({ run: group, runGroupId: group.group.id }, `group:${group.group.id}`);
    }

    for (const run of runs) {
      addCandidate({ run, runId: run.run.runId }, `run:${run.run.runId}`);
    }

    return candidates;
  }, [getRunGroups, projectGrouping, runs, selectedRunGroupId, selectedRunId]);

  const applyDeepLinkResolution = useCallback((resolution: DeepLinkResolution) => {
    suppressHashUpdate.current = true;

    if (resolution.runGroupId) {
      if (selectedRunGroupId !== resolution.runGroupId) {
        selectRunGroup(resolution.runGroupId);
      }
    } else if (resolution.runId) {
      if (selectedRunId !== resolution.runId || selectedRunGroupId) {
        selectRun(resolution.runId);
      }
    }

    navigate(resolution.view.type, resolution.view.id);
  }, [navigate, selectRun, selectRunGroup, selectedRunGroupId, selectedRunId]);

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
    const hash = buildHash(currentView, run);
    const currentHash = window.location.hash;

    if (unresolvedDeepLink && currentHash === unresolvedDeepLink.hash) {
      return;
    }

    // Only update if hash actually changed (avoid pushing duplicate history)
    if (hash !== currentHash && !(hash === '' && currentHash === '')) {
      window.history.pushState(null, '', hash || window.location.pathname + window.location.search);
    }
  }, [embedded, currentView, getCurrentRun, unresolvedDeepLink]);

  // ── Resolve initial hash when run data becomes available ──────
  useEffect(() => {
    if (embedded || !initialHash.current || initialResolved.current) return;

    const candidates = getDeepLinkCandidates();
    if (candidates.length === 0) return; // Data not loaded yet — wait

    const resolved = resolveHashAgainstCandidates(initialHash.current, candidates);
    if (!resolved) {
      reportUnresolvedHash(initialHash.current);
      return;
    }
    initialResolved.current = true;

    applyDeepLinkResolution(resolved);
  }, [applyDeepLinkResolution, embedded, getDeepLinkCandidates, reportUnresolvedHash]);

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
