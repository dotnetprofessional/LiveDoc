import type { RunType, Statistics, Status } from '@swedevtools/livedoc-schema';

/**
 * A single run entry as exposed by the project hierarchy (completed physical runs) or a
 * currently-active run tracked in the viewer store. Missing `runType` means 'full' — history
 * predates partial run support.
 */
export interface RunHistoryEntry {
  runId: string;
  timestamp: string;
  status: Status;
  summary?: Statistics;
  runType?: RunType;
  baselineRunId?: string;
}

export type RunBadge = { kind: 'full' } | { kind: 'partial'; sequence: number };

export interface BadgedRunHistoryEntry extends RunHistoryEntry {
  badge: RunBadge;
}

/**
 * Formats a RunBadge as compact display text, e.g. 'Full' or 'Partial 2'.
 */
export function formatRunBadge(badge: RunBadge): string {
  return badge.kind === 'full' ? 'Full' : `Partial ${badge.sequence}`;
}

/**
 * Derives a `Full` / `Partial N` badge for each entry in a project/environment's run history.
 *
 * There is no stored sequence field — the badge is purely derived from chronological order:
 * every 'full' run resets the counter to 0, and each subsequent 'partial' run increments it
 * relative to the most recent 'full' run in the same list. Callers pass the server-authored
 * newest-first history order; producer timestamps are display metadata and never determine lineage.
 */
export function deriveRunBadges(entries: RunHistoryEntry[]): BadgedRunHistoryEntry[] {
  const oldestFirst = [...entries].reverse();

  const badgeByRunId = new Map<string, RunBadge>();
  let sequence = 0;
  for (const entry of oldestFirst) {
    const runType = entry.runType ?? 'full';
    if (runType === 'full') {
      sequence = 0;
      badgeByRunId.set(entry.runId, { kind: 'full' });
    } else {
      sequence += 1;
      badgeByRunId.set(entry.runId, { kind: 'partial', sequence });
    }
  }

  return entries.map((entry) => ({
    ...entry,
    badge: badgeByRunId.get(entry.runId) ?? { kind: 'full' },
  }));
}

/**
 * Merges completed history entries with any currently-loaded/active entries (e.g. a run still in
 * progress that hasn't reached history yet), de-duplicating by runId and preferring the loaded
 * entry's (fresher) data. Server history order remains authoritative; live entries not yet present
 * in completed history are prepended.
 */
export function mergeRunHistoryEntries(
  historyEntries: RunHistoryEntry[],
  liveEntries: RunHistoryEntry[]
): RunHistoryEntry[] {
  const liveById = new Map(liveEntries.map((entry) => [entry.runId, entry]));
  const historyIds = new Set(historyEntries.map((entry) => entry.runId));
  const liveOnly = Array.from(liveById.values()).filter((entry) => !historyIds.has(entry.runId));
  const history = historyEntries.map((entry) => liveById.get(entry.runId) ?? entry);
  return [...liveOnly, ...history];
}
