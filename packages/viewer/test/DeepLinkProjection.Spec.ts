import { expect } from 'vitest';
import { specification, rule } from '@swedevtools/livedoc-vitest';
import type { TestRunV1 } from '@swedevtools/livedoc-schema';
import { makeRunState } from '../src/client/store';
import { buildHash, resolveHashAgainstCandidates, type DeepLinkCandidate } from '../src/client/lib/deep-link';

function partialRun(): TestRunV1 {
  return {
    protocolVersion: '1.0',
    runId: 'partial-2',
    runType: 'partial',
    baselineRunId: 'full-1',
    project: 'Demo.Tests',
    environment: 'ci',
    framework: 'vitest',
    timestamp: '2026-06-01T00:00:00.000Z',
    duration: 10,
    status: 'passed',
    summary: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
    documents: [
      {
        id: 'doc-1',
        kind: 'Feature',
        title: 'Checkout flow',
        tests: [
          { id: 'test-1', kind: 'Scenario', title: 'Card payment succeeds', tests: [], steps: [], statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 } } as any,
        ],
        statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
      },
    ],
  };
}

specification(`Viewer Deep Link Context Round Trip
  Project, environment, run or logical group, projection, and current page must round-trip through
  the URL while existing node-only links remain backward compatible.
  `, () => {
  rule("Building a hash for a node view without a runView omits the projection suffix (backward compatible)", () => {
    const run = makeRunState(partialRun());
    const hash = buildHash({ type: 'node', id: 'test-1' }, run);

    expect(hash).toBe('#/checkout-flow/card-payment-succeeds');
    expect(hash).not.toContain('?view=');
  });

  rule("Building a hash with runView 'combined' also omits the suffix, since combined is the default", () => {
    const run = makeRunState(partialRun());
    const hash = buildHash({ type: 'node', id: 'test-1' }, run, 'combined');

    expect(hash).toBe('#/checkout-flow/card-payment-succeeds');
  });

  rule("Building a hash with runView 'physical' appends a '?view=physical' suffix", () => {
    const run = makeRunState(partialRun());
    const hash = buildHash({ type: 'node', id: 'test-1' }, run, 'physical');

    expect(hash).toBe('#/checkout-flow/card-payment-succeeds?view=physical');
  });

  rule("Resolving a hash with no '?view=' suffix defaults to no explicit runView (callers default to combined)", () => {
    const run = makeRunState(partialRun());
    const candidates: DeepLinkCandidate[] = [{ run, runId: 'partial-2' }];

    const resolved = resolveHashAgainstCandidates('#/checkout-flow/card-payment-succeeds', candidates);

    expect(resolved).not.toBeNull();
    expect(resolved!.runId).toBe('partial-2');
    expect(resolved!.view).toEqual({ type: 'node', id: 'test-1' });
    expect(resolved!.runView).toBeUndefined();
  });

  rule("Resolving a hash with '?view=physical' recovers 'physical' as the runView alongside the resolved node", () => {
    const run = makeRunState(partialRun());
    const candidates: DeepLinkCandidate[] = [{ run, runId: 'partial-2' }];

    const resolved = resolveHashAgainstCandidates('#/checkout-flow/card-payment-succeeds?view=physical', candidates);

    expect(resolved).not.toBeNull();
    expect(resolved!.runId).toBe('partial-2');
    expect(resolved!.view).toEqual({ type: 'node', id: 'test-1' });
    expect(resolved!.runView).toBe('physical');
  });

  rule("A build-then-resolve round trip for a physical projection recovers the exact same node and runView", () => {
    const run = makeRunState(partialRun());
    const candidates: DeepLinkCandidate[] = [{ run, runId: 'partial-2' }];

    const hash = buildHash({ type: 'node', id: 'test-1' }, run, 'physical');
    const resolved = resolveHashAgainstCandidates(hash, candidates);

    expect(resolved).not.toBeNull();
    expect(resolved!.view).toEqual({ type: 'node', id: 'test-1' });
    expect(resolved!.runView).toBe('physical');
  });

  rule("An unrecognized query value other than 'physical' resolves as no explicit runView (defaults to combined)", () => {
    const run = makeRunState(partialRun());
    const candidates: DeepLinkCandidate[] = [{ run, runId: 'partial-2' }];

    const resolved = resolveHashAgainstCandidates('#/checkout-flow/card-payment-succeeds?view=bogus', candidates);

    expect(resolved).not.toBeNull();
    expect(resolved!.runView).toBeUndefined();
  });

  rule("The summary (home) view never carries a projection suffix, even when runView is 'physical'", () => {
    const run = makeRunState(partialRun());
    const hash = buildHash({ type: 'summary' }, run, 'physical');

    expect(hash).toBe('');
  });

  rule("A contextual node link preserves project 'Demo.Tests', environment 'ci', run 'partial-2', and view 'physical'", (ctx) => {
    const [project, environment, runId, runView] = ctx.rule.values as [string, string, string, 'physical'];
    const run = makeRunState(partialRun());

    const hash = buildHash(
      { type: 'node', id: 'test-1' },
      run,
      { project, environment, runId, runView }
    );

    expect(hash).toBe(
      '#/checkout-flow/card-payment-succeeds?project=Demo.Tests&environment=ci&run=partial-2&view=physical'
    );
  });

  rule("A summary link preserves run 'partial-2' instead of returning an empty hash", (ctx) => {
    const [runId] = ctx.rule.values as [string];
    const run = makeRunState(partialRun());

    const hash = buildHash(
      { type: 'summary' },
      run,
      { project: run.run.project, environment: run.run.environment, runId }
    );

    expect(hash).toBe('#/?project=Demo.Tests&environment=ci&run=partial-2');
  });

  rule("A run-qualified link selects 'partial-2' when '2' candidates contain the same node", (ctx) => {
    const [expectedRunId, expectedCandidates] = ctx.rule.values as [string, number];
    const selected = makeRunState(partialRun());
    const other = makeRunState({ ...partialRun(), runId: 'partial-1' });
    const candidates: DeepLinkCandidate[] = [
      { run: other, runId: other.run.runId },
      { run: selected, runId: selected.run.runId },
    ];
    expect(candidates).toHaveLength(expectedCandidates);

    const hash = buildHash(
      { type: 'node', id: 'test-1' },
      selected,
      {
        project: selected.run.project,
        environment: selected.run.environment,
        runId: selected.run.runId,
      }
    );
    const resolved = resolveHashAgainstCandidates(hash, candidates);

    expect(resolved?.runId).toBe(expectedRunId);
    expect(resolved?.view).toEqual({ type: 'node', id: 'test-1' });
  });

  rule("A grouped link preserves group 'group:ci:demo:integration-1+unit-1' and '2' source runs", (ctx) => {
    const [groupId, expectedSourceRuns] = ctx.rule.values as [string, number];
    const run = makeRunState({ ...partialRun(), runId: groupId, project: 'Demo' });
    const sourceRunIds = ['integration-1', 'unit-1'];
    expect(sourceRunIds).toHaveLength(expectedSourceRuns);

    const hash = buildHash(
      { type: 'coverage' },
      run,
      {
        project: 'Demo',
        environment: 'ci',
        runGroupId: groupId,
        sourceRunIds,
      }
    );
    const resolved = resolveHashAgainstCandidates(hash, [{ run, runGroupId: groupId }]);

    expect(hash).toContain(`group=${encodeURIComponent(groupId)}`);
    expect(hash.match(/sourceRun=/g)).toHaveLength(expectedSourceRuns);
    expect(resolved?.runGroupId).toBe(groupId);
    expect(resolved?.view).toEqual({ type: 'coverage' });
  });
});
