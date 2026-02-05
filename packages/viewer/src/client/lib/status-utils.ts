import type { Statistics, Status } from '@livedoc/schema';

/**
 * Computes aggregate status from statistics.
 * Priority: failed > pending > skipped > passed
 */
export function statusFromStats(stats: Statistics | undefined): Status | undefined {
  if (!stats) return undefined;
  if (stats.failed > 0) return 'failed';
  if (stats.pending > 0) return 'pending';
  if (stats.total > 0 && stats.skipped === stats.total) return 'skipped';
  if (stats.total > 0 && stats.passed === stats.total) return 'passed';
  return 'pending';
}

/**
 * Determines if a test item should allow drill-down navigation.
 * - Scenarios and Outlines always have sub-content to display
 * - Rules and standard Tests only allow drill-down if failed (to view exception details)
 */
export function shouldAllowDrillDown(kind: string, status: Status | undefined): boolean {
  // Outlines always have drill-down (examples as sub-tests)
  if (kind === 'ScenarioOutline' || kind === 'RuleOutline') {
    return true;
  }

  // Scenarios always have drill-down (GTW steps to display)
  if (kind === 'Scenario') {
    return true;
  }

  // Rules and standard Tests: only allow drill-down if failed (to see exception)
  if (kind === 'Rule' || kind === 'Test') {
    return status === 'failed' || status === 'timedOut';
  }

  // Default: allow drill-down for containers and unknown types
  return true;
}

/**
 * Formats duration in milliseconds to human-readable string.
 */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.floor(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
