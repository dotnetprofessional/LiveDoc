import type { Statistics, Status } from '@livedoc/schema';

export function statusFromStats(stats: Statistics | undefined): Status | undefined {
  if (!stats) return undefined;
  if (stats.failed > 0) return 'failed';
  if (stats.pending > 0) return 'pending';
  if (stats.total > 0 && stats.skipped === stats.total) return 'skipped';
  if (stats.total > 0 && stats.passed === stats.total) return 'passed';
  return 'pending';
}
