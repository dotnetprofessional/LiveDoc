import type {
  AnyTest,
  CoverageReport,
  ExecutionResult,
  Statistics,
  Status,
  TestCase,
  TestRunV1,
} from '@swedevtools/livedoc-schema';
import { V1CoverageReportSchema, V1TestRunSchema } from '@swedevtools/livedoc-schema';
import { promises as fs } from 'fs';
import path from 'path';
import { composeTestRun } from './run-composition.js';

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
}

function formatHistoryFilename(completedAt: string, runId: string): string {
  const dateStr = new Date(completedAt).toISOString().replace(/[:.]/g, '-');
  return `${dateStr}_${sanitizeName(runId)}`;
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
    history: Array<{
      runId: string;
      timestamp: string;
      status: string;
      summary?: Statistics;
      runType: 'full' | 'partial';
      baselineRunId?: string;
    }>;
  }>;
}>;

interface RunRecord {
  run: TestRunV1;
  testCasesById: Map<string, TestCase>;
  testsById: Map<string, AnyTest>;
  outlineResultsByKey: Map<string, ExecutionResult>;
}

export interface RunStoreDiagnostic {
  severity: 'warning' | 'error';
  code: 'invalid-json' | 'unsupported-model' | 'invalid-model' | 'invalid-coverage';
  message: string;
  filePath: string;
  project?: string;
  environment?: string;
  details?: string[];
}

export type RunStoreErrorCode =
  | 'no-baseline'
  | 'run-active'
  | 'framework-mismatch'
  | 'run-cancelled'
  | 'run-not-active'
  | 'dependent-run';

export class RunStoreError extends Error {
  constructor(public readonly code: RunStoreErrorCode, message: string) {
    super(message);
  }
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

function computeScenarioExecutionFromSteps(
  steps: Array<{ execution?: ExecutionResult }>,
  existing?: ExecutionResult
): ExecutionResult {
  if (steps.length === 0) return existing ?? { status: 'pending', duration: 0 };

  const statuses = steps.map((s) => (s.execution?.status ?? 'pending') as Status);
  const status = computeAggregateStatus(statuses);
  const duration = steps.reduce((sum, s) => sum + (Number(s.execution?.duration) || 0), 0);
  const error = steps.find((step) =>
    (step.execution?.status === 'failed' || step.execution?.status === 'timedOut') &&
    step.execution.error
  )?.execution?.error ?? (status === 'failed' ? existing?.error : undefined);

  return {
    status,
    duration,
    ...(error ? { error } : {}),
    ...(existing?.attachments ? { attachments: existing.attachments } : {}),
  };
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
  /** Completed physical runs only. */
  private runs: Map<string, RunRecord> = new Map();
  /** In-flight physical runs are deliberately never part of completed indexes. */
  private activeRuns: Map<string, RunRecord> = new Map();
  private activeRunIdsByProject: Map<string, string> = new Map();
  private completingRunIds: Set<string> = new Set();
  private cancelledRunIds: Set<string> = new Set();
  private completedAtByRunId: Map<string, string> = new Map();
  private historyPathByRunId: Map<string, string> = new Map();
  private latestCombinedByProject: Map<string, TestRunV1> = new Map();
  private pendingPersistence: Set<Promise<unknown>> = new Set();
  private runsByProject: Map<string, string[]> = new Map();
  private diagnostics: RunStoreDiagnostic[] = [];

  private historyLimit: number;
  private dataDir: string;
  private initialized: boolean = false;

  constructor(historyLimit: number = 50, dataDir?: string) {
    this.historyLimit = historyLimit;
    this.dataDir = dataDir || path.join(process.cwd(), '.livedoc', 'data');
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getDiagnostics(): RunStoreDiagnostic[] {
    return [...this.diagnostics];
  }

  private addDiagnostic(diagnostic: RunStoreDiagnostic): void {
    this.diagnostics.push(diagnostic);
    const details = diagnostic.details && diagnostic.details.length > 0
      ? ` (${diagnostic.details.join('; ')})`
      : '';
    console.warn(`[LiveDoc] ${diagnostic.message}${details}`);
  }

  private validateStoredRun(
    content: string,
    filePath: string,
    project?: string,
    environment?: string
  ): TestRunV1 | undefined {
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (error) {
      this.addDiagnostic({
        severity: 'error',
        code: 'invalid-json',
        message: `Could not load ${path.basename(filePath)} because it is not valid JSON.`,
        filePath,
        project,
        environment,
        details: [error instanceof Error ? error.message : String(error)],
      });
      return undefined;
    }

    if (!data || typeof data !== 'object') {
      this.addDiagnostic({
        severity: 'error',
        code: 'invalid-model',
        message: `Could not load ${path.basename(filePath)} because it is not a LiveDoc run object.`,
        filePath,
        project,
        environment,
      });
      return undefined;
    }

    const record = data as Record<string, unknown>;
    if (record.protocolVersion !== '1.0') {
      const legacyHint =
        Array.isArray(record.features) ||
        Array.isArray(record.suites) ||
        Array.isArray(record.children) ||
        Array.isArray(record.nodes);

      this.addDiagnostic({
        severity: 'error',
        code: 'unsupported-model',
        message:
          `Could not load ${path.basename(filePath)} because it is not a LiveDoc TestRunV1 file. ` +
          `Expected protocolVersion '1.0' but found '${String(record.protocolVersion ?? 'missing')}'.`,
        filePath,
        project,
        environment,
        details: legacyHint
          ? ['This looks like an older LiveDoc model. Re-run tests with the current LiveDoc reporter.']
          : undefined,
      });
      return undefined;
    }

    const coverage = record.coverage;
    let dataToParse = data;
    if (coverage !== undefined) {
      const coverageParsed = V1CoverageReportSchema.safeParse(coverage);
      if (!coverageParsed.success) {
        this.addDiagnostic({
          severity: 'warning',
          code: 'invalid-coverage',
          message:
            `Loaded ${path.basename(filePath)} without coverage because the coverage block does not match the LiveDoc coverage model.`,
          filePath,
          project,
          environment,
          details: coverageParsed.error.issues
            .slice(0, 5)
            .map((issue) => `coverage.${issue.path.join('.') || '<root>'}: ${issue.message}`),
        });

        const copy = { ...record };
        delete copy.coverage;
        dataToParse = copy;
      }
    }

    const parsed = V1TestRunSchema.safeParse(dataToParse);
    if (!parsed.success) {
      this.addDiagnostic({
        severity: 'error',
        code: 'invalid-model',
        message: `Could not load ${path.basename(filePath)} because it does not match the LiveDoc TestRunV1 model.`,
        filePath,
        project,
        environment,
        details: parsed.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`),
      });
      return undefined;
    }

    return parsed.data as TestRunV1;
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

  private projectKey(project: string, environment: string): string {
    return `${project}/${environment}`;
  }

  private isFull(run: TestRunV1): boolean {
    return (run.runType ?? 'full') === 'full';
  }

  private isCompleted(run: TestRunV1): boolean {
    return run.status !== 'running' && run.status !== 'pending' && run.status !== 'cancelled';
  }

  private historyPath(run: TestRunV1, completedAt: string): string {
    return path.join(this.getHistoryDir(run.project, run.environment), `${formatHistoryFilename(completedAt, run.runId)}.json`);
  }

  private async writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    const handle = await fs.open(tempPath, 'w');
    try {
      await handle.writeFile(JSON.stringify(value, null, 2), 'utf-8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fs.rename(tempPath, filePath);
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });

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

          const key = this.projectKey(project, environment);
          const runIds: string[] = [];
          const historyDir = path.join(envDir, 'history');
          try {
            const historyFiles = await fs.readdir(historyDir);
            historyFiles.sort();

            for (const file of historyFiles) {
              if (!file.endsWith('.json')) continue;
              try {
                const historyPath = path.join(historyDir, file);
                const content = await fs.readFile(historyPath, 'utf-8');
                const run = this.validateStoredRun(content, historyPath, project, environment);
                if (!run) continue;
                if (this.runs.has(run.runId)) continue;
                run.runType ??= 'full';
                this.runs.set(run.runId, { run, ...buildIndexes(run) });
                runIds.unshift(run.runId);
                this.historyPathByRunId.set(run.runId, historyPath);
                this.completedAtByRunId.set(run.runId, run.timestamp);
              } catch (error) {
                this.addDiagnostic({
                  severity: 'warning',
                  code: 'invalid-model',
                  message: `Could not read history run ${file}.`,
                  filePath: path.join(historyDir, file),
                  project,
                  environment,
                  details: [error instanceof Error ? error.message : String(error)],
                });
              }
            }
          } catch {
            // no history
          }

          // Older servers only persisted lastrun. Treat it as a physical full run
          // only when history does not already provide that run.
          const lastRunPath = path.join(envDir, 'lastrun.json');
          try {
            const content = await fs.readFile(lastRunPath, 'utf-8');
            const run = this.validateStoredRun(content, lastRunPath, project, environment);
            if (run && !this.runs.has(run.runId) && this.isFull(run) && this.isCompleted(run)) {
              run.runType = 'full';
              this.runs.set(run.runId, { run, ...buildIndexes(run) });
              runIds.unshift(run.runId);
              this.completedAtByRunId.set(run.runId, run.timestamp);
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
              this.addDiagnostic({
                severity: 'error',
                code: 'invalid-model',
                message: `Could not read ${path.basename(lastRunPath)}.`,
                filePath: lastRunPath,
                project,
                environment,
                details: [error instanceof Error ? error.message : String(error)],
              });
            }
          }

          if (runIds.length > 0) {
            this.runsByProject.set(key, runIds);
            const combined = await this.rebuildLatestCombined(project, environment);
            if (combined) {
              await this.writeJsonAtomically(this.getLastRunPath(project, environment), combined);
            }
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

  private getLineage(run: TestRunV1): { baseline: TestRunV1; partials: TestRunV1[] } | undefined {
    const runIds = this.runsByProject.get(this.projectKey(run.project, run.environment)) ?? [];
    const position = runIds.indexOf(run.runId);
    if (position < 0) return undefined;
    const chronological = runIds.slice(position).reverse();
    const baselineId = this.isFull(run) ? run.runId : run.baselineRunId;
    if (!baselineId) return undefined;
    const baselineIndex = chronological.findIndex((id) => id === baselineId);
    const baseline = baselineIndex >= 0 ? this.runs.get(baselineId)?.run : undefined;
    if (!baseline) return undefined;
    const partials = chronological
      .slice(baselineIndex + 1)
      .map((id) => this.runs.get(id)?.run)
      .filter((candidate): candidate is TestRunV1 =>
        Boolean(candidate) && (candidate!.runType ?? 'full') === 'partial' && candidate!.baselineRunId === baseline.runId);
    return { baseline, partials };
  }

  getCombinedRun(runId: string): TestRunV1 | undefined {
    const run = this.runs.get(runId)?.run;
    if (!run) return undefined;
    const lineage = this.getLineage(run);
    return lineage ? composeTestRun(lineage.baseline, lineage.partials).run : undefined;
  }

  private computeLatestCombined(project: string, environment: string): TestRunV1 | undefined {
    const key = this.projectKey(project, environment);
    const latestPhysical = (this.runsByProject.get(key) ?? [])
      .map((id) => this.runs.get(id)?.run)
      .find((run): run is TestRunV1 => Boolean(run));
    return latestPhysical ? this.getCombinedRun(latestPhysical.runId) ?? latestPhysical : undefined;
  }

  private async rebuildLatestCombined(project: string, environment: string): Promise<TestRunV1 | undefined> {
    const key = this.projectKey(project, environment);
    const combined = this.computeLatestCombined(project, environment);
    if (combined) this.latestCombinedByProject.set(key, combined);
    else this.latestCombinedByProject.delete(key);
    return combined;
  }

  private async persistCompletedRun(run: TestRunV1, completedAt: string): Promise<string[]> {
    const historyPath = this.historyPath(run, completedAt);
    await this.writeJsonAtomically(historyPath, run);
    this.historyPathByRunId.set(run.runId, historyPath);
    const combined = this.computeLatestCombined(run.project, run.environment);
    const paths = [historyPath];
    if (combined) {
      const latestPath = this.getLastRunPath(run.project, run.environment);
      await this.writeJsonAtomically(latestPath, combined);
      paths.push(latestPath);
      this.latestCombinedByProject.set(this.projectKey(run.project, run.environment), combined);
    }
    return paths;
  }

  createRun(
    runId: string,
    project: string,
    environment: string,
    framework: string,
    timestamp: string,
    runType: 'full' | 'partial' = 'full'
  ): TestRunV1 {
    const key = this.projectKey(project, environment);
    if (this.activeRunIdsByProject.has(key)) {
      throw new RunStoreError('run-active', `A run is already active for '${project}/${environment}'.`);
    }

    let baselineRunId: string | undefined;
    if (runType === 'partial') {
      const latest = (this.runsByProject.get(key) ?? [])
        .map((id) => this.runs.get(id)?.run)
        .find((candidate): candidate is TestRunV1 => Boolean(candidate));
      const fullRun = latest && this.isFull(latest)
        ? latest
        : latest?.baselineRunId
          ? this.runs.get(latest.baselineRunId)?.run
          : undefined;
      if (!fullRun) {
        throw new RunStoreError('no-baseline', `No completed full baseline exists for '${project}/${environment}'.`);
      }
      if (fullRun.framework !== framework) {
        throw new RunStoreError('framework-mismatch', `Baseline framework '${fullRun.framework}' does not match '${framework}'.`);
      }
      baselineRunId = fullRun.runId;
    }

    const run: TestRunV1 = {
      protocolVersion: '1.0',
      runId,
      runType,
      ...(baselineRunId ? { baselineRunId } : {}),
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
    this.activeRuns.set(runId, record);
    this.activeRunIdsByProject.set(key, runId);
    this.cancelledRunIds.delete(runId);

    return run;
  }

  getAllRuns(): TestRunV1[] {
    return [
      ...Array.from(this.activeRuns.values()).map((r) => r.run),
      ...Array.from(this.runs.values()).map((r) => r.run),
    ];
  }

  getRun(runId: string): TestRunV1 | undefined {
    return this.activeRuns.get(runId)?.run ?? this.runs.get(runId)?.run;
  }

  private getRecord(runId: string): RunRecord | undefined {
    return this.activeRuns.get(runId);
  }

  assertMutable(runId: string): TestRunV1 {
    if (this.completingRunIds.has(runId)) {
      throw new RunStoreError('run-not-active', `Run '${runId}' is completing and no longer accepts updates.`);
    }
    const active = this.activeRuns.get(runId)?.run;
    if (active) return active;
    if (this.cancelledRunIds.has(runId)) {
      throw new RunStoreError('run-cancelled', `Run '${runId}' was cancelled.`);
    }
    throw new RunStoreError('run-not-active', `Run '${runId}' is not active.`);
  }

  cancelRun(runId: string): boolean {
    if (this.completingRunIds.has(runId)) return false;
    const record = this.activeRuns.get(runId);
    if (!record) return false;
    this.activeRuns.delete(runId);
    this.activeRunIdsByProject.delete(this.projectKey(record.run.project, record.run.environment));
    this.cancelledRunIds.add(runId);
    return true;
  }

  async deleteRun(runId: string): Promise<boolean> {
    const record = this.runs.get(runId);
    if (!record) return false;

    const run = record.run;

    if (this.hasDependents(runId)) {
      throw new RunStoreError('dependent-run', `Run '${runId}' has dependent partial runs.`);
    }

    this.runs.delete(runId);

    const key = this.projectKey(run.project, run.environment);
    const projectRuns = this.runsByProject.get(key) || [];
    const newProjectRuns = projectRuns.filter((id) => id !== runId);

    if (newProjectRuns.length === 0) this.runsByProject.delete(key);
    else this.runsByProject.set(key, newProjectRuns);

    try {
      const historyPath = this.historyPathByRunId.get(runId);
      if (historyPath) await fs.unlink(historyPath).catch(() => undefined);
      this.historyPathByRunId.delete(runId);
      this.completedAtByRunId.delete(runId);
      const latest = await this.rebuildLatestCombined(run.project, run.environment);
      const latestRunPath = this.getLastRunPath(run.project, run.environment);
      if (latest) await this.writeJsonAtomically(latestRunPath, latest);
      else await fs.unlink(latestRunPath).catch(() => undefined);

      return true;
    } catch (err) {
      console.error(`Failed to delete run ${runId} from disk:`, err);
      return true;
    }
  }

  hasDependents(runId: string): boolean {
    const run = this.runs.get(runId)?.run;
    if (!run) return false;

    const runIds = this.runsByProject.get(this.projectKey(run.project, run.environment)) ?? [];
    const position = runIds.indexOf(runId);
    if (position < 0) return false;

    const baselineRunId = this.isFull(run) ? run.runId : run.baselineRunId;
    const completedDependent = runIds
      .slice(0, position)
      .map((id) => this.runs.get(id)?.run)
      .some((candidate) =>
        candidate?.runType === 'partial' &&
        candidate.baselineRunId === baselineRunId);
    if (completedDependent) return true;

    return Array.from(this.activeRuns.values())
      .map((record) => record.run)
      .some((candidate) =>
        candidate.runType === 'partial' &&
        candidate.baselineRunId === baselineRunId);
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
        const latestRun = this.latestCombinedByProject.get(this.projectKey(projectName, envName));

        const history = runIds.map((id) => {
          const run = this.runs.get(id)?.run;
          return {
            runId: id,
            timestamp: run?.timestamp || '',
            status: run?.status || 'unknown',
            summary: run?.summary,
            runType: run?.runType ?? 'full',
            ...(run?.baselineRunId ? { baselineRunId: run.baselineRunId } : {}),
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
    return this.latestCombinedByProject.get(this.projectKey(project, environment));
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
          (t as any).execution = computeScenarioExecutionFromSteps(
            ((t as any).steps ?? []) as any[],
            (t as any).execution
          );
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
  }

  replaceScenarioSteps(runId: string, scenarioId: string, steps: AnyTest[]): void {
    const record = this.getRecord(runId);
    if (!record) return;

    const scenario = record.testsById.get(scenarioId);
    if (!scenario) return;

    (scenario as any).steps = steps as any;

    this.rebuildIndexes(record);
    this.recomputeAggregates(record);
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
  }

  async completeRun(
    runId: string,
    status: Status,
    duration: number,
    summary?: Statistics,
    coverage?: CoverageReport
  ): Promise<TestRunV1> {
    const record = this.activeRuns.get(runId);
    if (!record) {
      if (this.cancelledRunIds.has(runId)) {
        throw new RunStoreError('run-cancelled', `Run '${runId}' was cancelled.`);
      }
      const completed = this.runs.get(runId)?.run;
      if (completed) return completed;
      throw new RunStoreError('run-not-active', `Run '${runId}' is not active.`);
    }

    const previousRunState = {
      duration: record.run.duration,
      status: record.run.status,
      summary: record.run.summary,
      coverage: record.run.coverage,
    };

    record.run.duration = duration;
    record.run.status = status;
    if (summary) record.run.summary = summary;
    if (coverage) record.run.coverage = coverage;

    if (status === 'cancelled') {
      this.activeRuns.delete(runId);
      this.activeRunIdsByProject.delete(this.projectKey(record.run.project, record.run.environment));
      this.cancelledRunIds.add(runId);
      return record.run;
    }

    if (this.completingRunIds.has(runId)) {
      throw new RunStoreError('run-not-active', `Run '${runId}' is already completing.`);
    }
    this.completingRunIds.add(runId);

    const completedAt = new Date().toISOString();
    const key = this.projectKey(record.run.project, record.run.environment);
    // Index before building the combined view, but do not expose it as complete
    // until both physical history and combined latest have been persisted.
    this.runs.set(runId, record);
    const completedIds = this.runsByProject.get(key) ?? [];
    completedIds.unshift(runId);
    this.runsByProject.set(key, completedIds);
    this.completedAtByRunId.set(runId, completedAt);
    const persistence = this.persistCompletedRun(record.run, completedAt);
    this.pendingPersistence.add(persistence);
    try {
      await persistence;
    } catch (error) {
      this.runs.delete(runId);
      this.runsByProject.set(key, completedIds.filter((id) => id !== runId));
      this.completedAtByRunId.delete(runId);
      const historyPath = this.historyPathByRunId.get(runId);
      if (historyPath) await fs.unlink(historyPath).catch(() => undefined);
      this.historyPathByRunId.delete(runId);
      record.run.duration = previousRunState.duration;
      record.run.status = previousRunState.status;
      record.run.summary = previousRunState.summary;
      record.run.coverage = previousRunState.coverage;
      await this.rebuildLatestCombined(record.run.project, record.run.environment);
      throw error;
    } finally {
      this.pendingPersistence.delete(persistence);
      this.completingRunIds.delete(runId);
    }
    this.activeRuns.delete(runId);
    this.activeRunIdsByProject.delete(key);
    await this.enforceHistoryLimit(record.run.project, record.run.environment);
    return record.run;
  }

  async attachCoverage(runId: string, coverage: CoverageReport): Promise<{ completed: true; paths: string[] }> {
    const activeRecord = this.activeRuns.get(runId);
    if (activeRecord) {
      const previousCoverage = activeRecord.run.coverage;
      activeRecord.run.coverage = coverage;
      try {
        // Coverage producers may arrive immediately before completion. Verify
        // storage is writable without publishing active run data as lastrun.
        await fs.mkdir(this.getProjectEnvDir(activeRecord.run.project, activeRecord.run.environment), { recursive: true });
        return { completed: true, paths: [] };
      } catch (error) {
        activeRecord.run.coverage = previousCoverage;
        throw error;
      }
    }

    const record = this.runs.get(runId);
    if (!record) {
      if (this.cancelledRunIds.has(runId)) {
        throw new RunStoreError('run-cancelled', `Run '${runId}' was cancelled.`);
      }
      throw new RunStoreError('run-not-active', `Run ${runId} is not completed.`);
    }

    const previousCoverage = record.run.coverage;
    record.run.coverage = coverage;
    try {
      const historyPath = this.historyPathByRunId.get(runId);
      if (!historyPath) throw new Error(`Run ${runId} has no persisted history path.`);
      await this.writeJsonAtomically(historyPath, record.run);
      const combined = this.computeLatestCombined(record.run.project, record.run.environment);
      const paths = [historyPath];
      if (combined) {
        const latestPath = this.getLastRunPath(record.run.project, record.run.environment);
        await this.writeJsonAtomically(latestPath, combined);
        paths.push(latestPath);
        this.latestCombinedByProject.set(this.projectKey(record.run.project, record.run.environment), combined);
      }
      return { completed: true, paths };
    } catch (error) {
      record.run.coverage = previousCoverage;
      throw error;
    }
  }

  async flush(): Promise<void> {
    // Active runs are intentionally not persisted. Completed invocations are
    // synchronously persisted by completeRun and coverage attachment.
    await Promise.all([...this.pendingPersistence]);
  }

  private async enforceHistoryLimit(project: string, environment: string): Promise<void> {
    const key = this.projectKey(project, environment);
    const runIds = this.runsByProject.get(key) ?? [];
    // Preserve the current full lineage even when it exceeds the configured
    // limit. Only whole older lineages can be safely evicted.
    while (runIds.length > this.historyLimit) {
      const oldestFullIndex = (() => {
        for (let index = runIds.length - 1; index >= 0; index--) {
          if (this.isFull(this.runs.get(runIds[index]!)!.run)) return index;
        }
        return -1;
      })();
      const nextFullIndex = (() => {
        for (let index = oldestFullIndex - 1; index >= 0; index--) {
          if (this.isFull(this.runs.get(runIds[index]!)!.run)) return index;
        }
        return -1;
      })();
      if (oldestFullIndex < 0 || nextFullIndex < 0) break;
      const evicted = runIds.splice(nextFullIndex + 1);
      for (const runId of evicted) {
        const historyPath = this.historyPathByRunId.get(runId);
        if (historyPath) await fs.unlink(historyPath).catch(() => undefined);
        this.runs.delete(runId);
        this.historyPathByRunId.delete(runId);
        this.completedAtByRunId.delete(runId);
      }
    }
    this.runsByProject.set(key, runIds);
  }
}

export const runStore = new RunStore();
