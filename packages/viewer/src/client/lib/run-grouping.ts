import type { AnyTest, Statistics, Status, TestCase, TestRunV1 } from '@swedevtools/livedoc-schema';

export const DEFAULT_PROJECT_GROUPING_WINDOW_MS = 60_000;

export interface ProjectGroupingSettings {
  enabled: boolean;
  windowMs: number;
  hideSourceProjects: boolean;
}

export interface LogicalRunGroup {
  id: string;
  name: string;
  environment: string;
  startTime: number;
  endTime: number;
  runs: TestRunV1[];
  run: TestRunV1;
}

function emptyStats(): Statistics {
  return { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
}

function addStats(a: Statistics, b: Statistics | undefined | null): Statistics {
  const rhs = b ?? emptyStats();
  return {
    total: a.total + rhs.total,
    passed: a.passed + rhs.passed,
    failed: a.failed + rhs.failed,
    pending: a.pending + rhs.pending,
    skipped: a.skipped + rhs.skipped,
  };
}

function statusRank(status: Status): number {
  switch (status) {
    case 'failed':
    case 'timedOut':
      return 6;
    case 'running':
      return 5;
    case 'pending':
      return 4;
    case 'cancelled':
      return 3;
    case 'skipped':
      return 2;
    case 'passed':
      return 1;
    default:
      return 0;
  }
}

function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>((best, status) => (
    statusRank(status) > statusRank(best) ? status : best
  ), 'passed');
}

function timestampMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function runStartMs(run: TestRunV1): number {
  return timestampMs(run.timestamp);
}

function runEndMs(run: TestRunV1): number {
  const start = runStartMs(run);
  if (run.status === 'running') return Math.max(start, Date.now());
  const duration = Number(run.duration);
  return start + (Number.isFinite(duration) && duration > 0 ? duration : 0);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
}

export function inferProjectRootPrefix(project: string): string {
  const parts = project.split(/[._-]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return project.trim() || 'Test Results';

  const testTypeTokens = new Set([
    'acceptance',
    'api',
    'browser',
    'component',
    'contract',
    'e2e',
    'endtoend',
    'functional',
    'integration',
    'integrations',
    'sample',
    'samples',
    'system',
    'ui',
    'unit',
  ]);

  const suffixWithTests = /^(?:acceptance|api|browser|component|contract|e2e|endtoend|functional|integration|integrations|sample|samples|system|ui|unit)?(?:tests?|specs?)$/i;
  const copy = [...parts];
  while (copy.length > 1) {
    const last = copy[copy.length - 1].toLowerCase();
    if (last === 'tests' || last === 'test' || last === 'specs' || last === 'spec' || testTypeTokens.has(last) || suffixWithTests.test(last)) {
      copy.pop();
      continue;
    }
    break;
  }

  return copy.length > 0 ? copy.join('.') : project;
}

function prefixId(prefix: string, id: string | undefined): string | undefined {
  return id ? `${prefix}:${id}` : id;
}

function cloneTestWithPrefix(test: AnyTest, prefix: string): AnyTest {
  const clone: any = {
    ...(test as any),
    id: prefixId(prefix, (test as any).id),
  };

  if (Array.isArray(clone.steps)) {
    clone.steps = clone.steps.map((step: AnyTest) => cloneTestWithPrefix(step, prefix));
  }

  if (Array.isArray(clone.exampleResults)) {
    clone.exampleResults = clone.exampleResults.map((entry: any) => ({
      ...entry,
      testId: prefixId(prefix, entry.testId),
    }));
  }

  if (clone.template) {
    clone.template = cloneTestWithPrefix(clone.template, prefix);
  }

  return clone as AnyTest;
}

function projectFolderName(project: string | undefined, groupName: string): string {
  const value = project?.trim();
  if (!value) return 'Test Project';

  if (value.length > groupName.length && value.toLowerCase().startsWith(groupName.toLowerCase())) {
    const separator = value[groupName.length];
    if (separator === '.' || separator === '_' || separator === '-') {
      const suffix = value.slice(groupName.length + 1).trim();
      if (suffix) return suffix;
    }
  }

  return value;
}

function cloneDocumentWithProjectFolder(run: TestRunV1, groupName: string, document: TestCase): TestCase {
  const prefix = `run:${run.runId}`;
  const projectFolder = projectFolderName(run.project, groupName);
  const rawPath = String((document as any).path ?? document.title ?? document.id).replace(/^[/\\]+/, '');
  const normalizedPath = rawPath.replace(/\\/g, '/');

  return {
    ...(document as any),
    id: prefixId(prefix, document.id),
    path: `${projectFolder}/${normalizedPath}`,
    background: document.background ? cloneTestWithPrefix(document.background, prefix) : undefined,
    tests: (document.tests ?? []).map((test) => cloneTestWithPrefix(test, prefix)),
  } as TestCase;
}

function createSyntheticRun(name: string, environment: string, runs: TestRunV1[]): TestRunV1 {
  const sorted = [...runs].sort((a, b) => runStartMs(a) - runStartMs(b));
  const start = Math.min(...sorted.map(runStartMs));
  const end = Math.max(...sorted.map(runEndMs));
  const latest = [...runs].sort((a, b) => runStartMs(b) - runStartMs(a))[0];
  const frameworks = Array.from(new Set(runs.map((run) => run.framework).filter(Boolean)));

  return {
    protocolVersion: '1.0',
    runId: `group:${slug(environment)}:${slug(name)}:${runs.map((run) => run.runId).sort().join('+')}`,
    project: name,
    environment,
    framework: frameworks.length === 1 ? frameworks[0]! : 'mixed',
    timestamp: latest?.timestamp ?? new Date(start).toISOString(),
    duration: Math.max(0, end - start),
    status: worstStatus(runs.map((run) => run.status)),
    summary: runs.reduce((summary, run) => addStats(summary, run.summary), emptyStats()),
    documents: sorted.flatMap((run) => (run.documents ?? []).map((doc) => cloneDocumentWithProjectFolder(run, name, doc))),
  };
}

function hasDistinctProjects(runs: TestRunV1[]): boolean {
  return new Set(runs.map((run) => run.project)).size > 1;
}

function projectIdentity(run: TestRunV1): string {
  return run.project.trim().toLowerCase();
}

function createGroup(name: string, environment: string, runs: TestRunV1[]): LogicalRunGroup {
  const startTime = Math.min(...runs.map(runStartMs));
  const endTime = Math.max(...runs.map(runEndMs));
  const run = createSyntheticRun(name, environment, runs);

  return {
    id: run.runId,
    name,
    environment,
    startTime,
    endTime,
    runs: [...runs].sort((a, b) => runStartMs(b) - runStartMs(a)),
    run,
  };
}

export function buildLogicalRunGroups(runs: TestRunV1[], settings: ProjectGroupingSettings): LogicalRunGroup[] {
  if (!settings.enabled) return [];

  const buckets = new Map<string, { name: string; environment: string; runs: TestRunV1[] }>();
  for (const run of runs) {
    const name = inferProjectRootPrefix(run.project);
    const key = `${name}\u0000${run.environment}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.runs.push(run);
    else buckets.set(key, { name, environment: run.environment, runs: [run] });
  }

  const groups: LogicalRunGroup[] = [];
  for (const bucket of buckets.values()) {
    const sorted = bucket.runs.slice().sort((a, b) => runStartMs(a) - runStartMs(b));
    let current: TestRunV1[] = [];
    let currentProjectIds = new Set<string>();
    let currentEnd = 0;

    const flush = () => {
      if (current.length > 1 && hasDistinctProjects(current)) {
        groups.push(createGroup(bucket.name, bucket.environment, current));
      }
      current = [];
      currentProjectIds = new Set<string>();
      currentEnd = 0;
    };

    for (const run of sorted) {
      const start = runStartMs(run);
      const end = runEndMs(run);
      const identity = projectIdentity(run);
      if (current.length === 0) {
        current = [run];
        currentProjectIds.add(identity);
        currentEnd = end;
        continue;
      }

      if (start <= currentEnd + settings.windowMs && !currentProjectIds.has(identity)) {
        current.push(run);
        currentProjectIds.add(identity);
        currentEnd = Math.max(currentEnd, end);
        continue;
      }

      flush();
      current = [run];
      currentProjectIds.add(identity);
      currentEnd = end;
    }

    flush();
  }

  return groups.sort((a, b) => b.startTime - a.startTime);
}

export function latestLogicalRunGroups(groups: LogicalRunGroup[]): LogicalRunGroup[] {
  const latestByProjectEnvironment = new Map<string, LogicalRunGroup>();

  for (const group of groups) {
    const key = `${group.name.toLocaleLowerCase()}\u0000${group.environment.toLocaleLowerCase()}`;
    const existing = latestByProjectEnvironment.get(key);
    if (!existing || group.startTime > existing.startTime) {
      latestByProjectEnvironment.set(key, group);
    }
  }

  return Array.from(latestByProjectEnvironment.values())
    .sort((left, right) => right.startTime - left.startTime);
}

export function findContainingGroup(groups: LogicalRunGroup[], runId: string): LogicalRunGroup | undefined {
  return groups.find((group) => group.runs.some((run) => run.runId === runId));
}
