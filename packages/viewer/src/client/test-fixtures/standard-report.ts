import type { StandardTest, TestRunV1 } from '@swedevtools/livedoc-schema';

const passedFact: StandardTest = {
  id: 'plain-fact',
  kind: 'Test',
  title: 'Adding one and one returns two',
  tags: ['@native'],
  execution: { status: 'passed', duration: 12 },
};

const detailedTests: StandardTest[] = [
  {
    ...passedFact,
    execution: {
      ...passedFact.execution,
      attachments: [{
        id: 'stdout', kind: 'file', title: 'stdout.txt', mimeType: 'text/plain',
        base64: btoa('Fact output: 1 + 1 = 2'),
      }],
    },
  },
  {
    id: 'failed-fact', kind: 'Test', title: 'A failing Fact', tags: ['@native'],
    execution: {
      status: 'failed', duration: 23,
      error: { message: 'Expected 2 but received 3', stack: 'at PlainTests.FailingFact()' },
    },
  },
  {
    id: 'skipped-fact', kind: 'Test', title: 'A skipped Fact', tags: ['@native'],
    execution: { status: 'skipped', duration: 0, error: { message: 'Requires an unavailable service' } },
  },
  {
    id: 'theory-one', kind: 'Test', title: 'Addition(left: 1, right: 2, expected: 3)', tags: ['@theory'],
    execution: { status: 'passed', duration: 34 },
    dataTables: [{
      name: 'Arguments', headers: ['left', 'right', 'expected'],
      rows: [{ rowId: 0, values: [
        { type: 'number', value: 1 }, { type: 'number', value: 2 }, { type: 'number', value: 3 },
      ] }],
    }],
  },
  {
    id: 'theory-two', kind: 'Test', title: 'Addition(left: 2, right: 2, expected: 5)', tags: ['@theory'],
    execution: {
      status: 'failed', duration: 45,
      error: { message: 'Expected 5 but received 4', stack: 'at PlainTests.Addition(2, 2, 5)' },
      attachments: [{
        id: 'theory-output', kind: 'file', title: 'theory.txt', mimeType: 'text/plain',
        base64: btoa('Theory output: 2 + 2 = 4'),
      }],
    },
  },
];

export function standardRun(detailed = false, kind: 'Standard' | 'Container' = 'Standard'): TestRunV1 {
  const tests = structuredClone(detailed ? detailedTests : [passedFact]);
  return {
    protocolVersion: '1.0',
    runId: 'native-tests-fixture',
    runType: 'full',
    project: 'livedoc.xunit.unittests',
    environment: 'local',
    framework: 'xunit',
    timestamp: '2026-10-01T00:00:00Z',
    duration: detailed ? 114 : 13,
    status: detailed ? 'failed' : 'passed',
    summary: detailed
      ? { total: 6, passed: 3, failed: 2, skipped: 1, pending: 0 }
      : { total: 2, passed: 2, failed: 0, skipped: 0, pending: 0 },
    documents: [
      {
        id: 'plain-tests', kind, path: detailed ? 'Arithmetic/Native/PlainTests.cs' : 'PlainTests.cs', title: 'Plain Tests',
        tests,
        statistics: detailed
          ? { total: 5, passed: 2, failed: 2, skipped: 1, pending: 0 }
          : { total: 1, passed: 1, failed: 0, skipped: 0, pending: 0 },
      },
      {
        id: 'arithmetic', kind: 'Specification', path: detailed ? 'Arithmetic/ArithmeticSpec.cs' : 'ArithmeticSpec.cs', title: 'Arithmetic',
        tests: [{
          id: 'addition-rule', kind: 'Rule', title: 'Adding 1 and 1 returns 2',
          execution: { status: 'passed', duration: 1 },
        }],
        statistics: { total: 1, passed: 1, failed: 0, skipped: 0, pending: 0 },
      },
    ],
  };
}
