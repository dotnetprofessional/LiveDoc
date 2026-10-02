import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect } from 'vitest';
import { rule, ruleOutline, specification } from '@swedevtools/livedoc-vitest';
import { SummaryView } from '../src/client/components/SummaryView';
import type { RunLike } from '../src/client/store';

function renderSummary(timestamp: string, status: RunLike['run']['status']): string {
  return renderToStaticMarkup(createElement(SummaryView, {
    run: {
      run: {
        timestamp,
        status,
        project: 'Summary',
        environment: 'local',
        duration: 0,
        summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
      },
      itemById: {},
    },
  }));
}

specification(`Viewer Summary Verification Timestamp
  Readers can distinguish executions on different days without losing the local verification time.
`, () => {
  ruleOutline(`Environment Last verified shows the local date and time including seconds for <timestamp> with status <status>
    Examples:
    | timestamp                | status  |
    | 2026-10-01T00:40:00.000Z | passed  |
    | 2026-10-01T00:40:00.000Z | running |
  `, (ctx) => {
    const { timestamp, status } = ctx.example as { timestamp: string; status: RunLike['run']['status'] };
    const markup = renderSummary(timestamp, status);
    const verified = markup.match(/<span[^>]*>Last verified<\/span><span[^>]*>([^<]*)<\/span>/)?.[1];
    const expected = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    }).format(new Date(timestamp));

    expect(verified).toBe(expected);
  });

  rule("A running dashboard without a timestamp retains 'Run in progress — results are updating live'", (ctx) => {
    const [expectedMessage] = ctx.rule.values as [string];
    expect(renderSummary('', 'running')).toContain(expectedMessage);
  });
});
