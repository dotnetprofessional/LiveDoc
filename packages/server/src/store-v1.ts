import type {
  AnyTest,
  ExecutionResult,
  Statistics,
  Status,
  TestCase,
  TestRunV1,
} from '@swedevtools/livedoc-schema';
import { promises as fs } from 'fs';
import path from 'path';
import { sessionManager } from './session-manager.js';

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
}

function formatHistoryFilename(timestamp: string, runId: string): string {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${dateStr}_${runId.slice(-8)}`;
}

function emptyStats(): Statistics {
  return { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
}

function statusToStatsBucket(status: Status): keyof Omit<Statistics, 'total'> {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
    case 'timedOut':
      return 'failed';
    case 'skipped':
    case 'cancelled':
      return 'skipped';
    case 'pending':
    case 'running':
    default:
      return 'pending';
  }
}

function mergePatchObject<T extends Record<string, any>>(existing: T, patch: Record<string, any>): T {
  const out: Record<string, any> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) {
      delete out[key];
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value;
      continue;
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = mergePatchObject(out[key], value);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

type ProjectHierarchy = Array<{
  name: string;
  environments: Array<{
    name: string;
    latestRun?: TestRunV1;
    historyCount: number;
    history: Array<{ runId: string; timestamp: string; status: string; summary?: Statistics }>;
  }>;
}>;

interface RunRecord {
  run: TestRunV1;
  testCasesById: Map<string, TestCase>;
  testsById: Map<string, AnyTest>;
  outlineResultsByKey: Map<string, ExecutionResult>;
}

function makeOutlineKey(outlineId: string, rowId: number, testId: string): string {
  return `${outlineId}|${rowId}|${testId}`;
}

function isScenario(test: AnyTest): test is AnyTest & { kind: 'Scenario'; steps: AnyTest[] } {
  return String((test as any)?.kind) === 'Scenario' && Array.isArray((test as any).steps);
}

function isScenarioOutline(test: AnyTest): boolean {
  return String((test as any)?.kind) === 'ScenarioOutline';
}

function isRuleOutline(test: AnyTest): boolean {
  return String((test as any)?.kind) === 'RuleOutline';
}

function getAllRowsCountFromExamples(examples: Array<{ rows?: Array<{ rowId: number }> }>): number {
  let count = 0;
  for (const t of examples) {
    if (Array.isArray(t?.rows)) count += t.rows.length;
  }
  return count;
}

function computeAggregateStatus(statuses: Status[]): Status {
  const s = new Set(statuses);
  if (s.has('failed') || s.has('timedOut')) return 'failed';
  if (s.has('cancelled')) return 'cancelled';
  if (s.has('running')) return 'running';
  if (s.has('pending')) return 'pending';
  if (s.has('skipped')) return 'skipped';
  if (s.has('passed')) return 'passed';
  return 'pending';
}

function computeScenarioExecutionFromSteps(steps: Array<{ execution?: ExecutionResult }>): ExecutionResult {
  const statuses = steps.map((s) => (s.execution?.status ?? 'pending') as Status);
  const status = computeAggregateStatus(statuses);
  const duration = steps.reduce((sum, s) => sum + (Number(s.execution?.duration) || 0), 0);
  return { status, duration };
}

function computeOutlineRowStatus(
  outlineId: string,
  rowId: number,
  templateTestIds: string[],
  outlineResultsByKey: Map<string, ExecutionResult>
): Status {
  const statuses: Status[] = [];
  for (const testId of templateTestIds) {
    const r = outlineResultsByKey.get(makeOutlineKey(outlineId, rowId, testId));
    if (r?.status) statuses.push(r.status);
  }

  if (statuses.length === 0) return 'pending';
  return computeAggregateStatus(statuses);
}

function computeOutlineExecutionAndStats(
  outline: AnyTest,
  outlineResultsByKey: Map<string, ExecutionResult>
): { execution: ExecutionResult; statistics: Statistics } {
  const outlineId = outline.id;
  const examples = ((outline as any).examples ?? []) as Array<{ rows?: Array<{ rowId: number }> }>;
  const totalRows = getAllRowsCountFromExamples(examples);

  const templateIds: string[] = [];
  if (Array.isArray((outline as any).steps)) {
    for (const s of (outline as any).steps as Array<{ id?: string }>) {
      if (s?.id) templateIds.push(String(s.id));
    }
  } else {
    templateIds.push(outlineId);
  }

  const stats = emptyStats();
  stats.total = totalRows;

  const rowStatuses: Status[] = [];
  let totalDuration = 0;

  for (const t of examples) {
    for (const row of t?.rows ?? []) {
      const rowId = row.rowId;
      const rowStatus = computeOutlineRowStatus(outlineId, rowId, templateIds, outlineResultsByKey);
      rowStatuses.push(rowStatus);
      stats[statusToStatsBucket(rowStatus)] += 1;

      for (const testId of templateIds) {
        const r = outlineResultsByKey.get(makeOutlineKey(outlineId, rowId, testId));
        totalDuration += Number(r?.duration) || 0;
      }
    }
  }

  const executionStatus = rowStatuses.length === 0 ? 'pending' : computeAggregateStatus(rowStatuses);
  return { execution: { status: executionStatus, duration: totalDuration }, statistics: stats };
}

function buildIndexes(run: TestRunV1): Omit<RunRecord, 'run'> {
  const testCasesById = new Map<string, TestCase>();
  const testsById = new Map<string, AnyTest>();
  const outlineResultsByKey = new Map<string, ExecutionResult>();

  const addTest = (test: AnyTest) => {
    testsById.set(test.id, test);

    if (isScenario(test)) {
      for (const step of ((test as any).steps ?? []) as AnyTest[]) addTest(step);
    }

    if (isScenarioOutline(test) || isRuleOutline(test)) {
      const outlineId = test.id;

      if (Array.isArray((test as any).steps)) {
        for (const step of ((test as any).steps ?? []) as AnyTest[]) addTest(step);
      }

      const results = ((test as any).exampleResults ?? []) as Array<{ testId: string; result: ExecutionResult }>;
      for (const entry of results) {
        const rowId = Number(entry?.result?.rowId);
        if (!Number.isFinite(rowId)) continue;
        outlineResultsByKey.set(makeOutlineKey(outlineId, rowId, entry.testId), entry.result);
      }
    }
  };

  for (const doc of run.documents ?? []) {
    testCasesById.set(doc.id, doc);

    if (doc.background) addTest(doc.background);
    for (const test of doc.tests ?? []) addTest(test);
  }

  return { testCasesById, testsById, outlineResultsByKey };
}

export class RunStore {
  private runs: Map<string, RunRecord> = new Map();
  private runsByProject: Map<string, string[]> = new Map();

  private historyLimit: number;
  private dataDir: string;
  private initialized: boolean = false;

  private runSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(historyLimit: number = 50, dataDir?: string) {
    this.historyLimit = historyLimit;
    this.dataDir = dataDir || path.join(process.cwd(), '.livedoc', 'data');
  }

  getDataDir(): string {
    return this.dataDir;
  }

  private getProjectEnvDir(project: string, environment: string): string {
    return path.join(this.dataDir, sanitizeName(project), sanitizeName(environment));
  }

  private getLastRunPath(project: string, environment: string): string {
    return path.join(this.getProjectEnvDir(project, environment), 'lastrun.json');
  }

  private getHistoryDir(project: string, environment: string): string {
    return path.join(this.getProjectEnvDir(project, environment), 'history');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Initialize session manager
      await sessionManager.initialize();

      let projects: string[] = [];
      try {
        projects = await fs.readdir(this.dataDir);
      } catch {
        // empty
      }

      for (const project of projects) {
        const projectDir = path.join(this.dataDir, project);
        const stat = await fs.stat(projectDir).catch(() => null);
        if (!stat?.isDirectory()) continue;

        const environments = await fs.readdir(projectDir);
        for (const environment of environments) {
          const envDir = path.join(projectDir, environment);
          const envStat = await fs.stat(envDir).catch(() => null);
          if (!envStat?.isDirectory()) continue;

          const key = `${project}/${environment}`;
          const runIds: string[] = [];

          const lastRunPath = path.join(envDir, 'lastrun.json');
          try {
            const content = await fs.readFile(lastRunPath, 'utf-8');
            const run = JSON.parse(content) as TestRunV1;
            this.runs.set(run.runId, { run, ...buildIndexes(run) });
            runIds.push(run.runId);
          } catch {
            // no lastrun
          }

          const historyDir = path.join(envDir, 'history');
          try {
            const historyFiles = await fs.readdir(historyDir);
            historyFiles.sort().reverse();

            for (const file of historyFiles) {
              if (!file.endsWith('.json')) continue;
              try {
                const content = await fs.readFile(path.join(historyDir, file), 'utf-8');
                const run = JSON.parse(content) as TestRunV1;
                if (!this.runs.has(run.runId)) {
                  this.runs.set(run.runId, { run, ...buildIndexes(run) });
                  runIds.push(run.runId);
                }
              } catch {
                // skip corrupted
              }
            }
          } catch {
            // no history
          }

          if (runIds.length > 0) {
            this.runsByProject.set(key, runIds);
          }
        }
      }

      console.log(`📂 Loaded ${this.runs.size} runs from ${this.dataDir}`);
    } catch (err) {
      console.error('Failed to initialize store:', err);
    } finally {
      this.initialized = true;
    }
  }

  private async saveRun(run: TestRunV1, isLatest: boolean = false): Promise<void> {
    try {
      const envDir = this.getProjectEnvDir(run.project, run.environment);
      await fs.mkdir(envDir, { recursive: true });

      if (isLatest) {
        const lastRunPath = this.getLastRunPath(run.project, run.environment);
        await fs.writeFile(lastRunPath, JSON.stringify(run, null, 2), 'utf-8');
      }

      if (run.status === 'passed' || run.status === 'failed') {
        const historyDir = this.getHistoryDir(run.project, run.environment);
        await fs.mkdir(historyDir, { recursive: true });

        const filename = formatHistoryFilename(run.timestamp, run.runId);
        const historyPath = path.join(historyDir, `${filename}.json`);
        await fs.writeFile(historyPath, JSON.stringify(run, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error(`Failed to save run ${run.runId}:`, err);
    }
  }

  private async enforceHistoryLimit(project: string, environment: string): Promise<void> {
    const key = `${project}/${environment}`;
    const projectRuns = this.runsByProject.get(key) || [];

    while (projectRuns.length > this.historyLimit) {
      const oldRunId = projectRuns.pop()!;
      const oldRecord = this.runs.get(oldRunId);

      if (oldRecord) {
        const historyDir = this.getHistoryDir(project, environment);
        try {
          const historyFiles = await fs.readdir(historyDir);
          for (const file of historyFiles) {
            if (file.includes(oldRunId.slice(-8))) {
              await fs.unlink(path.join(historyDir, file)).catch(() => {});
            }
          }
        } catch {
          // ignore
        }
      }

      this.runs.delete(oldRunId);
    }

    this.runsByProject.set(key, projectRuns);
  }

  private scheduleSaveRun(run: TestRunV1): void {
    const existing = this.runSaveTimers.get(run.runId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      void this.saveRun(run, true);
      this.runSaveTimers.delete(run.runId);
    }, 500);

    this.runSaveTimers.set(run.runId, timer);
  }

  createRun(runId: string, project: string, environment: string, framework: string, timestamp: string): TestRunV1 {
    // Assign session
    const sessionId = sessionManager.assignSession(project, environment, runId, timestamp);
    
    const run: TestRunV1 = {
      protocolVersion: '1.0',
      runId,
      sessionId,
      project,
      environment,
      framework,
      timestamp,
      duration: 0,
      status: 'running',
      summary: emptyStats(),
      documents: [],
    };

    const record: RunRecord = { run, ...buildIndexes(run) };
    this.runs.set(runId, record);

    const key = `${project}/${environment}`;
    const projectRuns = this.runsByProject.get(key) || [];
    projectRuns.unshift(runId);
    this.runsByProject.set(key, projectRuns);

    void this.saveRun(run, true);
    void this.enforceHistoryLimit(project, environment);

    return run;
  }

  getAllRuns(): TestRunV1[] {
    return Array.from(this.runs.values()).map((r) => r.run);
  }

  getRun(runId: string): TestRunV1 | undefined {
    return this.runs.get(runId)?.run;
  }

  private getRecord(runId: string): RunRecord | undefined {
    return this.runs.get(runId);
  }

  async deleteRun(runId: string): Promise<boolean> {
    const record = this.runs.get(runId);
    this.runs.delete(runId);

    if (!record) return false;

    const run = record.run;

    const key = `${run.project}/${run.environment}`;
    const projectRuns = this.runsByProject.get(key) || [];
    const newProjectRuns = projectRuns.filter((id) => id !== runId);

    if (newProjectRuns.length === 0) this.runsByProject.delete(key);
    else this.runsByProject.set(key, newProjectRuns);

    try {
      const historyDir = this.getHistoryDir(run.project, run.environment);
      const historyFiles = await fs.readdir(historyDir).catch(() => []);
      for (const file of historyFiles) {
        if (file.includes(runId.slice(-8))) {
          await fs.unlink(path.join(historyDir, file)).catch(() => {});
        }
      }

      const latestRunPath = this.getLastRunPath(run.project, run.environment);
      try {
        const lastRunContent = await fs.readFile(latestRunPath, 'utf-8');
        const lastRun = JSON.parse(lastRunContent) as TestRunV1;
        if (lastRun.runId === runId) {
          if (newProjectRuns.length > 0) {
            const next = this.runs.get(newProjectRuns[0])?.run;
            if (next) {
              await fs.writeFile(latestRunPath, JSON.stringify(next, null, 2), 'utf-8');
            }
          } else {
            await fs.unlink(latestRunPath).catch(() => {});
          }
        }
      } catch {
        // ignore
      }

      return true;
    } catch (err) {
      console.error(`Failed to delete run ${runId} from disk:`, err);
      return true;
    }
  }

  getProjectHierarchy(): ProjectHierarchy {
    const projectMap = new Map<string, Map<string, string[]>>();

    for (const [key, runIds] of this.runsByProject.entries()) {
      const [project, environment] = key.split('/');
      if (!projectMap.has(project)) projectMap.set(project, new Map());
      projectMap.get(project)!.set(environment, runIds);
    }

    const result: ProjectHierarchy = [];

    for (const [projectName, environments] of projectMap.entries()) {
      const envList: ProjectHierarchy[number]['environments'] = [];

      for (const [envName, runIds] of environments.entries()) {
        const latestRun = runIds[0] ? this.runs.get(runIds[0])?.run : undefined;

        const history = runIds.slice(1).map((id) => {
          const run = this.runs.get(id)?.run;
          return {
            runId: id,
            timestamp: run?.timestamp || '',
            status: run?.status || 'unknown',
            summary: run?.summary,
          };
        });

        envList.push({ name: envName, latestRun, historyCount: runIds.length, history });
      }

      result.push({ name: projectName, environments: envList });
    }

    return result;
  }

  getRunsForProject(project: string, environment: string): TestRunV1[] {
    const key = `${project}/${environment}`;
    const runIds = this.runsByProject.get(key) || [];
    return runIds.map((id) => this.runs.get(id)?.run).filter((r): r is TestRunV1 => !!r);
  }

  getLatestRun(project: string, environment: string): TestRunV1 | undefined {
    const key = `${project}/${environment}`;
    const runIds = this.runsByProject.get(key) || [];
    if (runIds.length === 0) return undefined;
    return this.runs.get(runIds[0])?.run;
  }

  private rebuildIndexes(record: RunRecord): void {
    const rebuilt = buildIndexes(record.run);
    record.testCasesById = rebuilt.testCasesById;
    record.testsById = rebuilt.testsById;
    record.outlineResultsByKey = rebuilt.outlineResultsByKey;
  }

  private recomputeAggregates(record: RunRecord): void {
    for (const doc of record.run.documents) {
      const allTopLevel: AnyTest[] = [];
      if (doc.background) allTopLevel.push(doc.background);
      allTopLevel.push(...doc.tests);

      for (const t of allTopLevel) {
        if (isScenario(t)) {
          (t as any).execution = computeScenarioExecutionFromSteps(((t as any).steps ?? []) as any[]);
        }

        if (isScenarioOutline(t) || isRuleOutline(t)) {
          const computed = computeOutlineExecutionAndStats(t, record.outlineResultsByKey);
          (t as any).execution = computed.execution;
          (t as any).statistics = computed.statistics;
        }
      }

      const stats = emptyStats();

      const addOne = (status: Status) => {
        stats.total += 1;
        stats[statusToStatsBucket(status)] += 1;
      };

      for (const t of doc.tests) {
        if (isScenarioOutline(t) || isRuleOutline(t)) {
          const s = (t as any).statistics as Statistics | undefined;
          if (s) {
            stats.total += s.total;
            stats.passed += s.passed;
            stats.failed += s.failed;
            stats.pending += s.pending;
            stats.skipped += s.skipped;
          } else {
            addOne((t.execution?.status ?? 'pending') as Status);
          }
          continue;
        }

        addOne((t.execution?.status ?? 'pending') as Status);
      }

      doc.statistics = stats;
    }

    const runStats = emptyStats();
    for (const doc of record.run.documents) {
      const s = doc.statistics ?? emptyStats();
      runStats.total += s.total;
      runStats.passed += s.passed;
      runStats.failed += s.failed;
      runStats.pending += s.pending;
      runStats.skipped += s.skipped;
    }

    record.run.summary = runStats;

    if (runStats.failed > 0) record.run.status = 'failed';
    else if (runStats.pending > 0) record.run.status = 'running';
    else if (runStats.total > 0 && runStats.passed + runStats.skipped === runStats.total) record.run.status = 'passed';
    else record.run.status = 'pending';
  }

  upsertTestCase(runId: string, testCase: TestCase): void {
    const record = this.getRecord(runId);
    if (!record) return;

    const existing = record.testCasesById.get(testCase.id);
    if (existing) {
      const merged = mergePatchObject(existing as any, testCase as any) as TestCase;
      const idx = record.run.documents.findIndex((d) => d.id === testCase.id);
      if (idx >= 0) record.run.documents[idx] = merged;
      record.testCasesById.set(testCase.id, merged);
    } else {
      record.run.documents.push(testCase);
      record.testCasesById.set(testCase.id, testCase);
    }

    this.rebuildIndexes(record);
    this.recomputeAggregates(record);
    this.scheduleSaveRun(record.run);
  }

  upsertTest(runId: string, testCaseId: string, test: AnyTest): void {
    const record = this.getRecord(runId);
    if (!record) return;

    const doc = record.testCasesById.get(testCaseId);
    if (!doc) return;

    const existingIdx = doc.tests.findIndex((t) => t.id === test.id);
    if (existingIdx >= 0) {
      doc.tests[existingIdx] = mergePatchObject(doc.tests[existingIdx] as any, test as any) as AnyTest;
    } else {
      doc.tests.push(test);
    }

    this.rebuildIndexes(record);
    this.recomputeAggregates(record);
    this.scheduleSaveRun(record.run);
  }

  replaceScenarioSteps(runId: string, scenarioId: string, steps: AnyTest[]): void {
    const record = this.getRecord(runId);
    if (!record) return;

    const scenario = record.testsById.get(scenarioId);
    if (!scenario) return;

    (scenario as any).steps = steps as any;

    this.rebuildIndexes(record);
    this.recomputeAggregates(record);
    this.scheduleSaveRun(record.run);
  }

  patchTestExecution(
    runId: string,
    testId: string,
    patch: {
      status?: ExecutionResult['status'];
      duration?: ExecutionResult['duration'];
      error?: ExecutionResult['error'] | null;
      attachments?: ExecutionResult['attachments'] | null;
    }
  ): void {
    const record = this.getRecord(runId);
    if (!record) return;

    const test = record.testsById.get(testId);
    if (!test) return;

    (test as any).execution = mergePatchObject((test as any).execution ?? {}, patch);

    this.rebuildIndexes(record);
    this.recomputeAggregates(record);
    this.scheduleSaveRun(record.run);
  }

  upsertOutlineExampleResults(
    runId: string,
    outlineId: string,
    results: Array<{ testId: string; result: ExecutionResult }>
  ): void {
    const record = this.getRecord(runId);
    if (!record) return;

    const outline = record.testsById.get(outlineId);
    if (!outline) return;

    if (!Array.isArray((outline as any).exampleResults)) {
      (outline as any).exampleResults = [];
    }

    const arr = (outline as any).exampleResults as Array<{ testId: string; result: ExecutionResult }>;

    for (const entry of results) {
      const rowId = Number(entry?.result?.rowId);
      if (!Number.isFinite(rowId)) continue;

      const idx = arr.findIndex((x) => x.testId === entry.testId && Number(x.result?.rowId) === rowId);
      if (idx >= 0) arr[idx] = entry;
      else arr.push(entry);

      record.outlineResultsByKey.set(makeOutlineKey(outlineId, rowId, entry.testId), entry.result);
    }

    this.rebuildIndexes(record);
    this.recomputeAggregates(record);
    this.scheduleSaveRun(record.run);
  }

  completeRun(runId: string, status: Status, duration: number, summary?: Statistics): void {
    const record = this.getRecord(runId);
    if (!record) return;

    record.run.duration = duration;
    record.run.status = status;
    if (summary) record.run.summary = summary;

    void this.saveRun(record.run, true);
    
    // Update session
    const sessionId = record.run.sessionId;
    if (sessionId) {
      const sessionRuns = this.getRunsForSession(sessionId);
      sessionManager.onRunCompleted(sessionId, record.run, sessionRuns);
      
      // Rebuild session with all runs from this session
      const session = sessionManager.getSession(sessionId);
      if (session) {
        sessionManager.rebuildSessionFromRuns(sessionId, sessionRuns);
        sessionManager.mergeDocuments(session, sessionRuns);
      }
    }
  }
  
  private getRunsForSession(sessionId: string): TestRunV1[] {
    const runs: TestRunV1[] = [];
    for (const record of this.runs.values()) {
      if (record.run.sessionId === sessionId) {
        runs.push(record.run);
      }
    }
    return runs;
  }

  async flush(): Promise<void> {
    for (const [runId, timer] of this.runSaveTimers.entries()) {
      clearTimeout(timer);
      const record = this.runs.get(runId);
      if (record) await this.saveRun(record.run, true);
    }
    this.runSaveTimers.clear();
  }
}

export const runStore = new RunStore();
export { sessionManager } from './session-manager.js';
