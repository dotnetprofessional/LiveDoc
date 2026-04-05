import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { isEmbedded } from '../config';
import { buildHash, resolveHash } from '../lib/deep-link';

/**
 * Syncs the browser URL hash with the viewer's navigation state.
 * - Store → URL: navigation changes update the hash
 * - URL → Store: hash changes (back/forward, direct link) trigger navigation
 * - Skipped in embedded mode (VS Code controls navigation via postMessage)
 */
export function useDeepLink(): void {
  const { currentView, navigate, getCurrentRun, runs } = useStore();
  const suppressHashUpdate = useRef(false);
  const [embedded] = useState(() => isEmbedded());

  // Capture the initial hash synchronously before any effects run
  const initialHash = useRef<string | undefined>(undefined);
  const initialResolved = useRef(false);
  if (initialHash.current === undefined) {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    initialHash.current = (hash && hash !== '#' && hash !== '#/') ? hash : '';
  }

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

    // Only update if hash actually changed (avoid pushing duplicate history)
    if (hash !== currentHash && !(hash === '' && currentHash === '')) {
      window.history.pushState(null, '', hash || window.location.pathname + window.location.search);
    }
  }, [embedded, currentView, getCurrentRun]);

  // ── Resolve initial hash when run data becomes available ──────
  useEffect(() => {
    if (embedded || !initialHash.current || initialResolved.current) return;

    const run = getCurrentRun();
    if (!run) return; // Data not loaded yet — wait

    const resolved = resolveHash(initialHash.current, run);
    initialResolved.current = true;

    if (resolved) {
      suppressHashUpdate.current = true;
      navigate(resolved.type, resolved.id);
    }
  }, [embedded, runs, getCurrentRun, navigate]);

  // ── Handle browser back/forward ───────────────────────────────
  useEffect(() => {
    if (embedded) return;

    function onPopState() {
      const hash = window.location.hash;
      const run = getCurrentRun();
      const resolved = resolveHash(hash, run);

      if (resolved) {
        suppressHashUpdate.current = true;
        navigate(resolved.type, resolved.id);
      }
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [embedded, getCurrentRun, navigate]);
}
