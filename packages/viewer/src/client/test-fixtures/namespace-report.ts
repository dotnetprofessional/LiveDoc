import type { TestCase, TestRunV1 } from '@swedevtools/livedoc-schema';
import { standardRun } from './standard-report';

export const SHARED_NAMESPACE = 'Acme/Commerce/Quotes/Services/Transactor/UnitTests';
export const PROVIDER_BRANCHES = [
  'Billing', 'BillingBenefits', 'ErrorMapping', 'RepositoryRegistration',
  'ResponseNormalization', 'SaaSHub', 'TestHost', 'TransactingLines',
];

export function namespaceRun(count = 401): TestRunV1 {
  const run = standardRun();
  const kinds = ['Standard', 'Container', 'Feature', 'Specification'];
  run.runId = 'namespace-navigation-fixture';
  run.project = 'NamespaceDemo';
  run.documents = Array.from({ length: count }, (_, index): TestCase => {
    const branch = index < 4 ? 'Authentication' : `ResourceProviders/${PROVIDER_BRANCHES[(index - 4) % PROVIDER_BRANCHES.length]}`;
    const kind = kinds[index % kinds.length]!;
    const id = `namespace-doc-${index}`;
    const tests: TestCase['tests'] = [{
      id: `${id}-test`,
      kind: kind === 'Feature' ? 'Scenario' : kind === 'Specification' ? 'Rule' : 'Test',
      title: `Check ${index + 1} passes`,
      tags: [index < 4 ? '@authentication' : '@providers'],
      execution: { status: 'passed', duration: 1 },
    }];
    return {
      id, kind, tests,
      title: `Check ${String(index + 1).padStart(3, '0')}`,
      path: `${SHARED_NAMESPACE}/${branch}/Check${index + 1}.cs`,
      tags: tests[0]!.tags,
      statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
    };
  });
  run.summary = { total: count, passed: count, failed: 0, pending: 0, skipped: 0 };
  return run;
}
