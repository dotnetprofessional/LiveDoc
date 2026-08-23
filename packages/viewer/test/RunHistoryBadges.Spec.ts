import { expect } from 'vitest';
import { specification, rule } from '@swedevtools/livedoc-vitest';
import {
  deriveRunBadges,
  formatRunBadge,
  mergeRunHistoryEntries,
  type RunHistoryEntry,
} from '../src/client/lib/run-history';

const baseTime = Date.parse('2026-06-01T00:00:00.000Z');

function entry(runId: string, offsetMs: number, runType?: 'full' | 'partial'): RunHistoryEntry {
  return {
    runId,
    timestamp: new Date(baseTime + offsetMs).toISOString(),
    status: 'passed',
    runType,
  };
}

specification(`Viewer Run History Badges
  Deriving 'Full' / 'Partial n' badges for the chronological run dropdown has no stored sequence
  field — the badge is purely a function of chronological order since the most recent full run.
  `, () => {
  rule("A full run followed by '3' partial reruns is badged 'Full, Partial 1, Partial 2, Partial 3' in order", (ctx) => {
    const [expectedPartialCount] = ctx.rule.values as [number];
    const badged = deriveRunBadges([
      entry('partial-3', 3_000, 'partial'),
      entry('partial-2', 2_000, 'partial'),
      entry('partial-1', 1_000, 'partial'),
      entry('full-1', 0, 'full'),
    ]);

    const partials = badged.filter((b) => b.badge.kind === 'partial');
    expect(partials).toHaveLength(expectedPartialCount);
    expect(badged.find((b) => b.runId === 'full-1')!.badge).toEqual({ kind: 'full' });
    expect(badged.find((b) => b.runId === 'partial-1')!.badge).toEqual({ kind: 'partial', sequence: 1 });
    expect(badged.find((b) => b.runId === 'partial-2')!.badge).toEqual({ kind: 'partial', sequence: 2 });
    expect(badged.find((b) => b.runId === 'partial-3')!.badge).toEqual({ kind: 'partial', sequence: 3 });
  });

  rule("A second full baseline resets the partial sequence back to '1' for the next partial", (ctx) => {
    const [expectedSequence] = ctx.rule.values as [number];
    const badged = deriveRunBadges([
      entry('partial-2', 3_000, 'partial'),
      entry('full-2', 2_000, 'full'),
      entry('partial-1', 1_000, 'partial'),
      entry('full-1', 0, 'full'),
    ]);

    expect(badged.find((b) => b.runId === 'full-1')!.badge).toEqual({ kind: 'full' });
    expect(badged.find((b) => b.runId === 'full-2')!.badge).toEqual({ kind: 'full' });
    expect(badged.find((b) => b.runId === 'partial-2')!.badge).toEqual({ kind: 'partial', sequence: expectedSequence });
  });

  rule("Entries missing a runType are treated as 'full', preserving pre-partial-support history", () => {
    const badged = deriveRunBadges([
      entry('legacy-2', 1_000, undefined),
      entry('legacy-1', 0, undefined),
    ]);

    expect(badged.every((b) => b.badge.kind === 'full')).toBe(true);
  });

  rule("Server history order yields partial sequence '2' even when producer timestamps are out of order", (ctx) => {
    const [expectedSequence] = ctx.rule.values as [number];
    const newestFirst = [
      entry('partial-2', -1_000, 'partial'),
      entry('partial-1', 5_000, 'partial'),
      entry('full-1', 10_000, 'full'),
    ];

    const badgedFromNewestFirst = deriveRunBadges(newestFirst);

    expect(badgedFromNewestFirst.find((b) => b.runId === 'partial-2')!.badge).toEqual({ kind: 'partial', sequence: expectedSequence });
    expect(badgedFromNewestFirst.map((b) => b.runId)).toEqual(newestFirst.map((e) => e.runId));
  });

  rule("formatRunBadge renders 'Full' and 'Partial 2' for the respective badge kinds", () => {
    expect(formatRunBadge({ kind: 'full' })).toBe('Full');
    expect(formatRunBadge({ kind: 'partial', sequence: 2 })).toBe('Partial 2');
  });

  rule("Merging history with a live in-progress entry prefers the live entry's fresher status", () => {
    const history: RunHistoryEntry[] = [entry('full-1', 0, 'full')];
    const live: RunHistoryEntry[] = [
      { ...entry('partial-1', 1_000, 'partial'), status: 'running' },
    ];

    const merged = mergeRunHistoryEntries(history, live);

    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.runId === 'partial-1')!.status).toBe('running');
    // Newest-first ordering.
    expect(merged[0]!.runId).toBe('partial-1');
  });

  rule("Merging de-duplicates by runId, preferring the live/loaded entry over stale history metadata", () => {
    const history: RunHistoryEntry[] = [
      { ...entry('run-1', 0, 'full'), status: 'passed' },
    ];
    const live: RunHistoryEntry[] = [
      { ...entry('run-1', 0, 'full'), status: 'failed' },
    ];

    const merged = mergeRunHistoryEntries(history, live);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.status).toBe('failed');
  });

  rule("Merging duplicate Combined and physical live entries keeps only '1' run menu entry", (ctx) => {
    const [expectedCount] = ctx.rule.values as [number];
    const combined = entry('partial-1', 1_000, 'partial');
    const physical = { ...combined, status: 'running' as const };

    const merged = mergeRunHistoryEntries([], [combined, physical]);

    expect(merged).toHaveLength(expectedCount);
    expect(merged[0]?.status).toBe('running');
  });
});
