import { expect, vi } from 'vitest';
import { specification, rule, ruleOutline } from '@swedevtools/livedoc-vitest';
import type { TestCase, TestRunV1 } from '@swedevtools/livedoc-schema';
import {
  DEFAULT_TEST_TYPES, filterRunByTestTypes, getInitialTestTypes,
  nativeTestDisplayTitle, TEST_TYPES_KEY, withDisplayTestTitles,
} from '../src/client/lib/test-type-filter';
import { standardRun } from '../src/client/test-fixtures/standard-report';
import { makeRunState, useStore } from '../src/client/store';
import { shouldAllowDrillDown } from '../src/client/lib/status-utils';

function mixedRun(): TestRunV1 {
  const source = standardRun(true);
  const feature: TestCase = {
    id: 'feature', kind: 'Feature', title: 'Feature', path: 'Features/Feature.Spec.ts',
    statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
    tests: [{ id: 'scenario', kind: 'Scenario', title: 'Scenario', steps: [], execution: { status: 'passed', duration: 1 } }],
  };
  return {
    ...source, documents: [...source.documents, feature],
    summary: { total: 7, passed: 4, failed: 2, pending: 0, skipped: 1 },
  };
}

specification(`Included Test Types
  @test-types
  Readers can focus on authored documentation without losing the original reports or native test evidence.
`, () => {
  ruleOutline(`Including Features <features>, Specifications <specifications>, and Tests <tests> leaves <documents> documents, <total> tests, <passed> passed, <failed> failed, <skipped> skipped, and status <status>
    Examples:
    | features | specifications | tests | documents | total | passed | failed | skipped | status  |
    | true     | true           | true  | 3         | 7     | 4      | 2      | 1       | failed  |
    | true     | true           | false | 2         | 2     | 2      | 0      | 0       | passed  |
    | true     | false          | false | 1         | 1     | 1      | 0      | 0       | passed  |
    | false    | true           | false | 1         | 1     | 1      | 0      | 0       | passed  |
    | false    | false          | true  | 1         | 5     | 2      | 2      | 1       | failed  |
    | false    | false          | false | 0         | 0     | 0      | 0      | 0       | pending |
  `, (ctx) => {
    const row = ctx.example;
    const source = mixedRun();
    const snapshot = structuredClone(source);
    const visible = filterRunByTestTypes(source, {
      features: row.features, specifications: row.specifications, tests: row.tests,
    });
    expect(visible.documents).toHaveLength(row.documents);
    expect(visible.summary).toEqual({ total: row.total, passed: row.passed, failed: row.failed, pending: 0, skipped: row.skipped });
    expect(visible.status).toBe(row.status);
    expect(source).toEqual(snapshot);
  });

  ruleOutline(`A legacy <kind> containing native Tests hides its native document when Tests are excluded, leaving '1' Specification and '1' passed test
    Examples:
    | kind          |
    | Standard      |
    | Container     |
    | Feature       |
    | Specification |
  `, (ctx) => {
    const [documents, passed] = ctx.rule.values as [number, number];
    const source = standardRun();
    source.documents[0]!.kind = ctx.example.kind;
    const visible = filterRunByTestTypes(source, { ...DEFAULT_TEST_TYPES, tests: false });
    expect(visible.documents).toHaveLength(documents);
    expect(visible.documents[0]!.id).toBe(source.documents[1]!.id);
    expect(visible.summary).toMatchObject({ total: passed, passed });
  });

  rule("A mixed Specification excludes '2' failed native tests but retains '1' passed Rule", (ctx) => {
    const [excluded, retained] = ctx.rule.values as [number, number];
    const source = standardRun(true);
    const document = source.documents[1]!;
    document.tests.push(...source.documents[0]!.tests.filter(test => test.execution.status === 'failed'));
    document.statistics = { total: excluded + retained, passed: retained, failed: excluded, pending: 0, skipped: 0 };
    source.documents = [document];
    const visible = filterRunByTestTypes(source, { ...DEFAULT_TEST_TYPES, tests: false });
    expect(visible.documents[0]!.tests).toHaveLength(retained);
    expect(visible.documents[0]!.statistics).toEqual({ total: retained, passed: retained, failed: 0, pending: 0, skipped: 0 });
    expect(visible.summary).toEqual(visible.documents[0]!.statistics);
  });

  rule("A running invocation stays 'running' when Tests are excluded and '1' passed Specification remains", (ctx) => {
    const [status, passed] = ctx.rule.values as ['running', number];
    const source = standardRun();
    source.status = status;
    const visible = filterRunByTestTypes(source, { ...DEFAULT_TEST_TYPES, tests: false });
    expect(visible.status).toBe(status);
    expect(visible.summary.passed).toBe(passed);
  });

  rule("Excluding Features from a report without Features preserves its invocation status 'failed' and original report", (ctx) => {
    const [status] = ctx.rule.values as ['failed'];
    const source = standardRun();
    source.status = status;
    const visible = filterRunByTestTypes(source, { ...DEFAULT_TEST_TYPES, features: false });
    expect(visible).toBe(source);
    expect(visible.status).toBe(status);
  });

  rule("A mixed Specification retains a Rule Outline with '3' examples, including '1' failure, when its native Test is excluded", (ctx) => {
    const [total, failed] = ctx.rule.values as [number, number];
    const source = standardRun();
    const outlineStatistics = { total, passed: total - failed, failed, pending: 0, skipped: 0 };
    source.documents = [{
      ...source.documents[1]!,
      tests: [{
        id: 'outline', kind: 'RuleOutline', title: 'Each example',
        examples: [], exampleResults: [], statistics: outlineStatistics,
        execution: { status: 'failed', duration: 1 },
      }, source.documents[0]!.tests[0]!],
      statistics: { ...outlineStatistics, total: total + 1, passed: total - failed + 1 },
    }];
    const visible = filterRunByTestTypes(source, { ...DEFAULT_TEST_TYPES, tests: false });
    expect(visible.summary).toEqual(outlineStatistics);
    expect(visible.documents[0]!.statistics).toEqual(outlineStatistics);
  });

  rule("Excluding Features removes background 'background' and its Step 'setup' from a retained legacy Feature with native Tests", (ctx) => {
    const [backgroundId, stepId] = ctx.rule.values as [string, string];
    const source = standardRun();
    source.documents[0]!.kind = 'Feature';
    source.documents[0]!.background = {
      id: backgroundId, kind: 'Background', title: 'Setup',
      execution: { status: 'passed', duration: 1 },
      steps: [{ id: stepId, kind: 'Step', keyword: 'Given', title: 'Setup', execution: { status: 'passed', duration: 1 } }],
    };
    const visible = filterRunByTestTypes(source, { ...DEFAULT_TEST_TYPES, features: false });
    expect(visible.documents[0]!.background).toBeUndefined();
    expect(makeRunState(visible).itemById[backgroundId]).toBeUndefined();
    expect(makeRunState(visible).itemById[stepId]).toBeUndefined();
    expect(source.documents[0]!.background.id).toBe(backgroundId);
  });

  ruleOutline(`Excluded Tests in a <projection> partial-run view leave '1' passed Specification while source inventory retains '6' tests
    Examples:
    | projection |
    | combined   |
    | physical   |
  `, (ctx) => {
    const [passed, total] = ctx.rule.values as [number, number];
    const previous = useStore.getState();
    try {
      const source = standardRun(true);
      source.runType = 'partial';
      const state = useStore.getState();
      state.setRuns([makeRunState(source)]);
      state.upsertPhysicalRun(source.runId, makeRunState(source));
      state.selectRun(source.runId, ctx.example.projection);
      useStore.setState({ testTypes: { ...DEFAULT_TEST_TYPES, tests: false } });
      expect(useStore.getState().getCurrentViewData()!.run.summary).toMatchObject({ total: passed, passed, failed: 0 });
      expect(useStore.getState().getCurrentRun()!.run.summary.total).toBe(total);
    } finally {
      useStore.setState(previous, true);
    }
  });

  rule("A grouped run from 'Demo.UnitTests' and 'Demo.IntegrationTests' excludes native Tests from its '2' passed results and leaves each source with '1' passed result", (ctx) => {
    const [unitProject, integrationProject, total, sourceTotal] = ctx.rule.values as [string, string, number, number];
    const previous = useStore.getState();
    try {
      const first = { ...standardRun(true), project: unitProject };
      const second = { ...standardRun(true), runId: 'integration', project: integrationProject };
      const state = useStore.getState();
      state.setRuns([makeRunState(first), makeRunState(second)]);
      useStore.setState({
        projectGrouping: { ...state.projectGrouping, enabled: true },
        testTypes: { ...DEFAULT_TEST_TYPES, tests: false },
      });
      const group = state.getRunGroups()[0]!;
      expect(group).toBeDefined();
      state.selectRunGroup(group.group.id);
      const visible = useStore.getState().getCurrentViewData()!;
      expect(visible.run.summary).toMatchObject({ total, passed: total, failed: 0 });
      expect(visible.run.sourceRuns!.map(source => source.summary.total)).toEqual([sourceTotal, sourceTotal]);
      expect(Object.values(visible.itemById).some(item => item.kind === 'Test')).toBe(false);
    } finally {
      useStore.setState(previous, true);
    }
  });

  ruleOutline(`Native display title <title> becomes <display> without changing arguments or authored prose
    Examples:
    | title                                                  | display                             |
    | Example.Tests.PlainTests.Adds_two                       | Adds_two                            |
    | Example.Tests.PlainTests.Add(left: 1, name: "a.b")       | Add(left: 1, name: "a.b")             |
    | Example.Tests.PlainTests.Add(System.Decimal: 1.5)        | Add(System.Decimal: 1.5)             |
    | Adds_two                                               | Adds_two                            |
    | Adds two numbers in Example.Tests                      | Adds two numbers in Example.Tests   |
    | Version 1.2 should pass                                | Version 1.2 should pass              |
  `, (ctx) => {
    expect(nativeTestDisplayTitle(ctx.example.title)).toBe(ctx.example.display);
  });

  rule("A native qualified title 'Example.Tests.Add' displays 'Add' while its canonical title and the authored Rule title remain unchanged", (ctx) => {
    const [title, display] = ctx.rule.values as [string, string];
    const source = standardRun();
    source.documents[0]!.tests[0]!.title = title;
    source.documents[1]!.tests[0]!.title = title;
    const visible = withDisplayTestTitles(source);
    expect(visible.documents[0]!.tests[0]!.title).toBe(display);
    expect(visible.documents[1]!.tests[0]!.title).toBe(title);
    expect(source.documents[0]!.tests[0]!.title).toBe(title);
  });

  ruleOutline(`A native test with <details> details allows drill-down <allowed>
    Examples:
    | details     | allowed |
    | none        | false   |
    | description | true    |
    | attachment  | true    |
    | arguments   | true    |
    | skip-reason | true    |
    | failure     | true    |
  `, (ctx) => {
    const source = standardRun(true);
    const test = structuredClone(source.documents[0]!.tests[0]!);
    test.execution = { status: 'passed', duration: 12 };
    if (ctx.example.details === 'description') test.description = 'Description';
    if (ctx.example.details === 'attachment') test.execution.attachments = source.documents[0]!.tests[0]!.execution.attachments;
    if (ctx.example.details === 'arguments') test.dataTables = source.documents[0]!.tests[3]!.dataTables;
    if (ctx.example.details === 'skip-reason') test.execution = source.documents[0]!.tests[2]!.execution;
    if (ctx.example.details === 'failure') test.execution.status = 'failed';
    expect(shouldAllowDrillDown(test.kind, test.execution.status, test)).toBe(ctx.example.allowed);
  });

  rule("Excluding Tests persists 'false', hides selected 'plain-fact', returns to 'summary', and restoring Tests restores '6' results without changing the source", (ctx) => {
    const [included, testId, viewType, total] = ctx.rule.values as [boolean, string, string, number];
    const previous = useStore.getState();
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    try {
      const source = makeRunState(standardRun(true));
      const state = useStore.getState();
      useStore.setState({ testTypes: { ...DEFAULT_TEST_TYPES } });
      state.setRuns([source]);
      state.selectRun(source.run.runId);
      state.navigate('node', testId);
      state.setTestTypeIncluded('tests', included);
      expect(getInitialTestTypes().tests).toBe(included);
      expect(JSON.parse(storage.get(TEST_TYPES_KEY)!)).toMatchObject({ tests: included });
      expect(useStore.getState().getVisibleRun()!.itemById[testId]).toBeUndefined();
      expect(useStore.getState().currentView.type).toBe(viewType);
      expect(useStore.getState().getCurrentRun()).toBe(source);
      state.setTestTypeIncluded('tests', !included);
      expect(useStore.getState().getCurrentViewData()!.run.summary.total).toBe(total);
      expect(useStore.getState().getCurrentNode()).toBeUndefined();
    } finally {
      useStore.setState(previous, true);
      vi.unstubAllGlobals();
    }
  });
});
