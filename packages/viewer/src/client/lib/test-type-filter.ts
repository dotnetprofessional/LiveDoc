import type { AnyTest, Statistics, TestCase, TestRunV1 } from '@swedevtools/livedoc-schema';

export const TEST_TYPES = ['features', 'specifications', 'tests'] as const;
export type TestType = typeof TEST_TYPES[number];
export type TestTypeSettings = Record<TestType, boolean>;
export const DEFAULT_TEST_TYPES: TestTypeSettings = { features: true, specifications: true, tests: true };
export const TEST_TYPES_KEY = 'livedoc.viewer.testTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getInitialTestTypes(): TestTypeSettings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(TEST_TYPES_KEY) ?? 'null');
    if (isRecord(stored)) {
      const settings = { ...DEFAULT_TEST_TYPES };
      for (const type of TEST_TYPES) {
        const value = stored[type];
        if (typeof value === 'boolean') settings[type] = value;
      }
      return settings;
    }
  } catch (error) {
    if (!(error instanceof ReferenceError)) console.warn('Could not read Viewer test-type preferences.', error);
  }
  return { ...DEFAULT_TEST_TYPES };
}

export function nativeTestDisplayTitle(title: string): string {
  return title.replace(
    /^(?:[\p{L}_$][\p{L}\p{N}_$`+]*\.)+([\p{L}_$][\p{L}\p{N}_$`]*)(?=\s*(?:\(|$))/u,
    '$1'
  );
}

export function withDisplayTestTitles(run: TestRunV1): TestRunV1 {
  let changed = false;
  const documents = run.documents.map(document => {
    let documentChanged = false;
    const tests = document.tests.map(test => {
      if (test.kind !== 'Test') return test;
      const title = nativeTestDisplayTitle(test.title);
      if (title === test.title) return test;
      changed = documentChanged = true;
      return { ...test, title };
    });
    return documentChanged ? { ...document, tests } : document;
  });
  return changed ? { ...run, documents } : run;
}

function testType(test: AnyTest, document: TestCase): TestType {
  if (test.kind === 'Test') return 'tests';
  if (test.kind === 'Scenario' || test.kind === 'ScenarioOutline') return 'features';
  if (test.kind === 'Rule' || test.kind === 'RuleOutline') return 'specifications';
  return documentType(document);
}

function documentType(document: TestCase): TestType {
  return document.kind === 'Feature' ? 'features'
    : document.kind === 'Specification' ? 'specifications' : 'tests';
}

function emptyStatistics(): Statistics {
  return { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
}

function addStatistics(target: Statistics, source: Statistics): void {
  for (const key of ['total', 'passed', 'failed', 'pending', 'skipped'] as const) target[key] += source[key];
}

function summarizeTests(tests: AnyTest[]): Statistics {
  const statistics = emptyStatistics();
  for (const test of tests) {
    if ('statistics' in test) {
      addStatistics(statistics, test.statistics);
      continue;
    }
    statistics.total += 1;
    const status = test.execution.status;
    if (status === 'passed') statistics.passed += 1;
    else if (status === 'failed' || status === 'timedOut') statistics.failed += 1;
    else if (status === 'skipped' || status === 'cancelled') statistics.skipped += 1;
    else statistics.pending += 1;
  }
  return statistics;
}

/** Display projection only: source reports, identities, and invocation evidence stay intact. */
export function filterRunByTestTypes(run: TestRunV1, settings: TestTypeSettings): TestRunV1 {
  if (TEST_TYPES.every(type => settings[type])) return run;
  const documents: TestCase[] = [];
  for (const document of run.documents) {
    const tests = document.tests.filter(test => settings[testType(test, document)]);
    if (document.tests.length > 0 && tests.length === 0) continue;
    if (document.tests.length === 0 && !settings[documentType(document)]) continue;
    if (tests.length === document.tests.length && (settings.features || !document.background)) {
      documents.push(document);
    } else {
      documents.push({
        ...document, tests,
        statistics: tests.length === document.tests.length ? document.statistics : summarizeTests(tests),
        background: settings.features ? document.background : undefined,
      });
    }
  }
  if (documents.length === run.documents.length && documents.every((document, index) => document === run.documents[index])) return run;
  const summary = emptyStatistics();
  for (const document of documents) addStatistics(summary, document.statistics ?? summarizeTests(document.tests));
  const status = summary.failed > 0 ? 'failed'
    : summary.pending > 0 ? 'pending'
      : summary.total === 0 ? 'pending'
        : summary.skipped === summary.total ? 'skipped' : 'passed';
  return {
    ...run, documents, summary,
    status: run.status === 'running' ? 'running' : status,
  };
}
