import { expect } from 'vitest';
import { rule, specification } from '@swedevtools/livedoc-vitest';
import { formatDuration } from '../src/client/lib/status-utils';

specification("Viewer Duration Formatting", () => {
  rule("A duration of '999' milliseconds displays as '999ms'", (ctx) => {
    expect(formatDuration(ctx.rule.values[0])).toBe(ctx.rule.values[1]);
  });

  rule("A duration of '1500' milliseconds displays as '1.50s'", (ctx) => {
    expect(formatDuration(ctx.rule.values[0])).toBe(ctx.rule.values[1]);
  });

  rule("A duration of '60000' milliseconds displays as '1m'", (ctx) => {
    expect(formatDuration(ctx.rule.values[0])).toBe(ctx.rule.values[1]);
  });

  rule("A duration of '65000' milliseconds displays as '1m 5s'", (ctx) => {
    expect(formatDuration(ctx.rule.values[0])).toBe(ctx.rule.values[1]);
  });

  rule("A duration of '3661000' milliseconds displays as '1h 1m 1s'", (ctx) => {
    expect(formatDuration(ctx.rule.values[0])).toBe(ctx.rule.values[1]);
  });
});
