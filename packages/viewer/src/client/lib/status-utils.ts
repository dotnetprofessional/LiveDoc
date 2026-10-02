import type { AnyTest, Statistics, Status } from '@swedevtools/livedoc-schema';
import { isNativeTestKind } from './kind-presentation';

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
 * - Native Tests only drill down when there are details beyond list metadata
 * - Rules only allow drill-down if failed (to view exception details)
 */
export function shouldAllowDrillDown(kind: string, status: Status | undefined, node?: AnyTest): boolean {
  // Outlines always have drill-down (examples as sub-tests)
  if (kind === 'ScenarioOutline' || kind === 'RuleOutline') {
    return true;
  }

  // Scenarios always have drill-down (GTW steps to display)
  if (kind === 'Scenario') {
    return true;
  }

  if (isNativeTestKind(kind)) {
    return Boolean(
      node?.description?.trim() ||
      node?.dataTables?.length ||
      node?.execution.error?.message?.trim() ||
      node?.execution.error?.stack?.trim() ||
      node?.execution.error?.code?.trim() ||
      node?.execution.error?.lineNumber !== undefined ||
      node?.execution.attachments?.length ||
      node?.ruleViolations?.length
    ) || status === 'failed' || status === 'timedOut';
  }

  // Preserve the existing compact Rule listing.
  if (kind === 'Rule') {
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
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}
