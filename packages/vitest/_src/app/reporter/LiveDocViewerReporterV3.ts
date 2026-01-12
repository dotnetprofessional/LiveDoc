import * as path from 'path';
import type { IPostReporter } from './IPostReporter';
import type {
  AnyTest,
  ExecutionResult,
  Framework,
  Statistics,
  Status,
  StepKeyword,
  StepTest,
  TestCase,
} from '@livedoc/schema';
import { generateStabilityId } from '@livedoc/schema';
import {
  ExecutionResults,
  Feature as SDKFeature,
  Scenario as SDKScenario,
  ScenarioOutline as SDKScenarioOutline,
  ScenarioExample as SDKScenarioExample,
  StepDefinition as SDKStepDefinition,
  SpecStatus,
  Specification as SDKSpecification,
  Rule as SDKRule,
  RuleOutline as SDKRuleOutline,
  VitestSuite as SDKVitestSuite,
} from '../model/index';

interface V3StartRunResponse {
  protocolVersion: '3.0';
  runId: string;
  websocketUrl: string;
}

interface V3CompleteRunRequest {
  status: Status;
  duration: number;
  summary?: Statistics;
}

export interface LiveDocViewerOptions {
  server?: string;
  project?: string;
  environment?: string;
  timeout?: number;
  silent?: boolean;
}

export class LiveDocViewerReporter implements IPostReporter {
  private options: Required<LiveDocViewerOptions>;

  constructor(options?: LiveDocViewerOptions) {
    this.options = {
      server: options?.server || 'http://localhost:3000',
      project: options?.project || 'default',
      environment: options?.environment || 'local',
      timeout: options?.timeout || 10000,
      silent: options?.silent ?? true,
    };
  }

  public async execute(results: ExecutionResults, rawOptions?: any): Promise<void> {
    this.applyRawOptions(rawOptions);

    try {
      const runId = await this.startRun();
      if (!runId) {
        if (!this.options.silent) {
          console.error(`LiveDocViewerReporter: Failed to connect to server at ${this.options.server}`);
        }
        return;
      }

      const pathContext = this.buildPathContext(results);

      for (const feature of results.features) {
        const testCase = this.buildFeatureTestCase(feature, pathContext);
        await this.upsertTestCase(runId, testCase);
      }

      for (const spec of ((results as any).specifications || []) as SDKSpecification[]) {
        const testCase = this.buildSpecificationTestCase(spec, pathContext);
        await this.upsertTestCase(runId, testCase);
      }

      for (const suite of ((results as any).suites || []) as SDKVitestSuite[]) {
        const testCase = this.buildSuiteTestCase(suite, pathContext);
        await this.upsertTestCase(runId, testCase);
      }

      await this.completeRun(runId, results);
    } catch (error) {
      if (!this.options.silent) {
        console.error('LiveDocViewerReporter error:', error);
      }
    }
  }

  public async startRunSession(rawOptions?: any): Promise<string | null> {
    this.applyRawOptions(rawOptions);

    try {
      return await this.startRun();
    } catch {
      return null;
    }
  }

  public async postResultsToRun(runId: string, results: ExecutionResults): Promise<void> {
    const pathContext = this.buildPathContext(results);

    for (const feature of results.features) {
      const testCase = this.buildFeatureTestCase(feature, pathContext);
      await this.upsertTestCase(runId, testCase);
    }

    for (const spec of ((results as any).specifications || []) as SDKSpecification[]) {
      const testCase = this.buildSpecificationTestCase(spec, pathContext);
      await this.upsertTestCase(runId, testCase);
    }

    for (const suite of ((results as any).suites || []) as SDKVitestSuite[]) {
      const testCase = this.buildSuiteTestCase(suite, pathContext);
      await this.upsertTestCase(runId, testCase);
    }
  }

  public async completeRunFromResults(runId: string, results: ExecutionResults): Promise<void> {
    await this.completeRun(runId, results);
  }

  private applyRawOptions(rawOptions?: any): void {
    if (rawOptions?.['viewer-server']) {
      this.options.server = rawOptions['viewer-server'];
    }
    if (rawOptions?.['viewer-project']) {
      this.options.project = rawOptions['viewer-project'];
    }
    if (rawOptions?.['viewer-environment']) {
      this.options.environment = rawOptions['viewer-environment'];
    }
    if (rawOptions?.['viewer-timeout'] !== undefined) {
      const parsed = Number(rawOptions['viewer-timeout']);
      if (Number.isFinite(parsed) && parsed > 0) {
        this.options.timeout = parsed;
      }
    }
  }

  private async startRun(): Promise<string | null> {
    const request = {
      project: this.options.project,
      environment: this.options.environment,
      framework: 'vitest' as Framework,
    };

    const response = await this.post<V3StartRunResponse>('/api/v3/runs/start', request);
    return response?.runId || null;
  }

  private async upsertTestCase(runId: string, testCase: TestCase): Promise<void> {
    await this.post(`/api/v3/runs/${runId}/testcases`, { testCase });
  }

  private buildPathContext(results: ExecutionResults): { rootPath: string } {
    const filenames: string[] = [];
    for (const f of results.features || []) {
      if ((f as any)?.filename) filenames.push((f as any).filename);
    }
    for (const s of ((results as any).specifications || []) as SDKSpecification[]) {
      if ((s as any)?.filename) filenames.push((s as any).filename);
    }
    for (const s of ((results as any).suites || []) as SDKVitestSuite[]) {
      if ((s as any)?.filename) filenames.push((s as any).filename);
    }

    const abs = filenames
      .filter(Boolean)
      .map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)))
      .map((p) => p.replace(/\\/g, '/'));

    const rootPath = this.findCommonRootPath(abs);
    return { rootPath };
  }

  private findCommonRootPath(absoluteFilenames: string[]): string {
    if (absoluteFilenames.length === 0) return '';
    const dirSegments = absoluteFilenames.map((f) => {
      const parts = f.split('/').filter(Boolean);
      parts.pop();
      return parts;
    });

    const first = dirSegments[0];
    let end = 0;
    while (end < first.length) {
      const seg = first[end];
      if (!dirSegments.every((s) => s[end] === seg)) break;
      end++;
    }
    return first.slice(0, end).join('/');
  }

  private buildFileInfo(filename: string | undefined, rootPath: string): { filename: string; path: string } {
    const raw = filename || '';
    const abs = raw ? (path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)) : '';
    const normalized = abs.replace(/\\/g, '/');
    const root = (rootPath || '').replace(/\\/g, '/').replace(/\/+$/g, '');

    if (!normalized) {
      return { filename: '', path: '' };
    }

    let relative = normalized;
    if (root) {
      const rootParts = root.split('/').filter(Boolean);
      const fileParts = normalized.split('/').filter(Boolean);
      const matches = rootParts.every((seg, i) => fileParts[i] === seg);
      if (matches) {
        relative = fileParts.slice(rootParts.length).join('/');
      }
    }

    const parts = relative.split('/').filter(Boolean);
    const groupPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    return { filename: relative, path: groupPath };
  }

  private buildFeatureTestCase(sdkFeature: SDKFeature, pathContext: { rootPath: string }): TestCase {
    const fileInfo = this.buildFileInfo((sdkFeature as any).filename, pathContext.rootPath);

    const testCaseId = generateStabilityId({
      project: this.options.project,
      path: fileInfo.filename,
      title: sdkFeature.title,
      kind: 'Feature',
    });

    const background = sdkFeature.background
      ? this.buildScenarioLike(
          testCaseId,
          sdkFeature.background.title,
          sdkFeature.background.description,
          sdkFeature.background.tags,
          sdkFeature.background.steps
        )
      : undefined;

    const tests: AnyTest[] = [];
    for (const scenario of sdkFeature.scenarios) {
      const outline = scenario as unknown as SDKScenarioOutline;
      if (Array.isArray((outline as any).examples) && (outline as any).examples.length > 0) {
        tests.push(this.buildScenarioOutline(testCaseId, outline));
      } else {
        tests.push(this.buildScenario(testCaseId, scenario as SDKScenario));
      }
    }

    return {
      id: testCaseId,
      style: 'Feature',
      path: fileInfo.filename || undefined,
      title: sdkFeature.title,
      description: sdkFeature.description,
      tags: sdkFeature.tags,
      tests,
      background,
      statistics: this.computeStatisticsFromTests(tests),
      ruleViolations: this.mapRuleViolations(sdkFeature),
    };
  }

  private buildSpecificationTestCase(spec: SDKSpecification, pathContext: { rootPath: string }): TestCase {
    const fileInfo = this.buildFileInfo((spec as any).filename, pathContext.rootPath);

    const testCaseId = generateStabilityId({
      project: this.options.project,
      path: fileInfo.filename,
      title: spec.title,
      kind: 'Specification',
    });

    const tests: AnyTest[] = [];

    for (const rule of spec.rules || []) {
      const outline = rule as unknown as SDKRuleOutline;
      if (Array.isArray((outline as any).examples) && (outline as any).examples.length > 0) {
        tests.push(this.buildRuleOutline(testCaseId, outline));
      } else {
        tests.push(this.buildRule(testCaseId, rule as SDKRule));
      }
    }

    return {
      id: testCaseId,
      style: 'Specification',
      path: fileInfo.filename || undefined,
      title: spec.title,
      description: spec.description,
      tags: spec.tags,
      tests,
      statistics: this.computeStatisticsFromTests(tests),
      ruleViolations: this.mapRuleViolations(spec),
    };
  }

  private buildSuiteTestCase(suite: SDKVitestSuite, pathContext: { rootPath: string }): TestCase {
    const fileInfo = this.buildFileInfo((suite as any).filename, pathContext.rootPath);

    const testCaseId = generateStabilityId({
      project: this.options.project,
      path: fileInfo.filename,
      title: suite.title,
      kind: 'Container',
    });

    const flattenSuiteTests = (root: SDKVitestSuite): Array<{ title: string; status: SpecStatus; duration: number }> => {
      const out: Array<{ title: string; status: SpecStatus; duration: number }> = [];

      const visit = (s: SDKVitestSuite, prefix: string) => {
        const tests = Array.isArray((s as any).tests) ? ((s as any).tests as any[]) : [];
        for (const t of tests) {
          const rawTitle = typeof t?.title === 'string' ? t.title : '';
          const title = prefix ? `${prefix} > ${rawTitle}` : rawTitle;
          const status = (t?.status ?? SpecStatus.unknown) as SpecStatus;
          const duration = Number(t?.duration ?? 0) || 0;
          if (title.trim().length > 0) {
            out.push({ title, status, duration });
          }
        }

        const children = Array.isArray((s as any).children) ? ((s as any).children as SDKVitestSuite[]) : [];
        for (const child of children) {
          const childTitle = typeof (child as any)?.title === 'string' ? String((child as any).title) : '';
          const nextPrefix = prefix ? `${prefix} > ${childTitle}` : childTitle;
          visit(child, nextPrefix);
        }
      };

      visit(root, '');
      return out;
    };

    const flattened = flattenSuiteTests(suite);
    const tests: AnyTest[] = flattened.map((t) => {
      const id = generateStabilityId({
        project: this.options.project,
        title: t.title,
        kind: 'Test',
        parentId: testCaseId,
      });

      return {
        id,
        kind: 'Test',
        title: t.title,
        execution: { status: this.mapStatus(t.status), duration: t.duration },
      } as AnyTest;
    });

    // Preserve legacy behavior (visible container) when a suite has no runnable tests.
    const ensuredTests = tests.length > 0
      ? tests
      : ([{
          id: `${testCaseId}:root`,
          kind: 'Test',
          title: suite.title,
          execution: { status: 'pending', duration: 0 },
        }] as AnyTest[]);

    return {
      id: testCaseId,
      style: 'Container',
      path: fileInfo.filename || undefined,
      title: suite.title,
      tests: ensuredTests,
      statistics: this.computeStatisticsFromTests(ensuredTests),
      ruleViolations: this.mapRuleViolations(suite),
    };
  }

  private buildScenario(parentId: string, sdkScenario: SDKScenario): AnyTest {
    return this.buildScenarioLike(
      parentId,
      sdkScenario.title,
      sdkScenario.description,
      sdkScenario.tags,
      sdkScenario.steps
    );
  }

  private buildScenarioLike(
    parentId: string,
    title: string,
    description: string | undefined,
    tags: string[] | undefined,
    steps: SDKStepDefinition[]
  ): AnyTest {
    const scenarioId = generateStabilityId({
      project: this.options.project,
      title,
      kind: 'Scenario',
      parentId,
    });

    const stepTests: StepTest[] = steps.map((s, i) => this.buildStepTest(scenarioId, s, i));

    return {
      id: scenarioId,
      kind: 'Scenario',
      title,
      description,
      tags,
      steps: stepTests,
      execution: this.scenarioExecutionFromSteps(stepTests),
      ruleViolations: this.mapRuleViolations({ ruleViolations: (steps as any)?.ruleViolations }),
    } as any;
  }

  private buildScenarioOutline(parentId: string, sdkOutline: SDKScenarioOutline): AnyTest {
    const outlineId = generateStabilityId({
      project: this.options.project,
      title: sdkOutline.title,
      kind: 'ScenarioOutline',
      parentId,
    });

    const examples = this.mapMetaTablesToDataTables((sdkOutline as any).tables || []);

    const flatRowIds = examples.flatMap((t) => t.rows.map((r) => r.rowId));
    const executedExamples = Array.isArray((sdkOutline as any).examples) ? ((sdkOutline as any).examples as SDKScenarioExample[]) : [];

    // Some runs (notably certain RuleViolation specs) only populate docString-rich data on executed example steps,
    // leaving the outline template steps without `docString`/`docStringRaw`.
    // To keep the outline step list renderable in v3 (without changing UI), backfill missing rich fields from
    // the first executed example's steps.
    const exampleForStepDetails = executedExamples.find((e) => Array.isArray((e as any)?.steps) && (e as any).steps.length > 0);
    const fallbackSteps: SDKStepDefinition[] = ((exampleForStepDetails as any)?.steps || []) as SDKStepDefinition[];

    const mergedSdkSteps: SDKStepDefinition[] = (sdkOutline.steps || []).map((templateStep, i) => {
      const executedStep = fallbackSteps[i] as any;
      if (!executedStep) return templateStep;

      const merged: any = Object.assign({}, templateStep);

      const fillString = (key: string) => {
        const current = merged[key];
        if (typeof current === 'string' && current.trim().length > 0) return;
        const candidate = executedStep?.[key];
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          merged[key] = String(candidate);
        }
      };

      // Prefer *raw* docString fields. Do not backfill bound `docString`/`description` onto
      // template steps when we already have the raw template docString, otherwise the
      // v3 `StepTest.description` can end up containing both (example-bound + template).
      fillString('docStringRaw');

      // Only backfill `description` when we have no raw docString to represent the block.
      if (!(typeof merged.docStringRaw === 'string' && merged.docStringRaw.trim().length > 0)) {
        fillString('description');
      }

      if (!Array.isArray(merged.dataTable) || merged.dataTable.length === 0) {
        if (Array.isArray(executedStep?.dataTable) && executedStep.dataTable.length > 0) {
          merged.dataTable = executedStep.dataTable;
        }
      }

      if (!Array.isArray(merged.values) || merged.values.length === 0) {
        if (Array.isArray(executedStep?.values) && executedStep.values.length > 0) {
          merged.values = executedStep.values;
        }
      }

      if (!merged.code && typeof executedStep?.code === 'string' && executedStep.code.trim().length > 0) {
        merged.code = executedStep.code;
      }

      return merged as SDKStepDefinition;
    });

    const steps: StepTest[] = mergedSdkSteps.map((s, i) => this.buildStepTest(outlineId, s, i));

    const exampleResults = this.buildScenarioOutlineExampleResults(steps, executedExamples, flatRowIds);

    const outlineStats = this.computeOutlineStatistics(executedExamples, flatRowIds.length);

    return {
      id: outlineId,
      kind: 'ScenarioOutline',
      title: sdkOutline.title,
      description: sdkOutline.description,
      tags: sdkOutline.tags,
      steps,
      examples,
      exampleResults,
      statistics: outlineStats,
      execution: { status: this.mapStatus(this.calculateOutlineStatus(sdkOutline)), duration: (sdkOutline as any).executionTime || 0 },
      ruleViolations: this.mapRuleViolations(sdkOutline),
    } as any;
  }

  private buildRule(parentId: string, sdkRule: SDKRule): AnyTest {
    const ruleId = generateStabilityId({
      project: this.options.project,
      title: sdkRule.title,
      kind: 'Rule',
      parentId,
    });

    return {
      id: ruleId,
      kind: 'Rule',
      title: sdkRule.title,
      description: sdkRule.description,
      tags: sdkRule.tags,
      execution: { status: this.mapStatus((sdkRule as any).status ?? SpecStatus.pending), duration: (sdkRule as any).executionTime || 0 },
      ruleViolations: this.mapRuleViolations(sdkRule),
    } as any;
  }

  private buildRuleOutline(parentId: string, sdkOutline: SDKRuleOutline): AnyTest {
    const outlineId = generateStabilityId({
      project: this.options.project,
      title: sdkOutline.title,
      kind: 'RuleOutline',
      parentId,
    });

    const examples = this.mapMetaTablesToDataTables((sdkOutline as any).tables || []);
    const flatRowIds = examples.flatMap((t) => t.rows.map((r) => r.rowId));
    const executedExamples = Array.isArray((sdkOutline as any).examples) ? ((sdkOutline as any).examples as any[]) : [];
    const exampleResults = this.buildRuleOutlineExampleResults(outlineId, executedExamples, flatRowIds);
    const outlineStats = this.computeRuleOutlineStatistics(executedExamples, flatRowIds.length);

    return {
      id: outlineId,
      kind: 'RuleOutline',
      title: sdkOutline.title,
      description: sdkOutline.description,
      tags: sdkOutline.tags,
      examples,
      exampleResults,
      statistics: outlineStats,
      execution: { status: this.mapStatus((sdkOutline as any).status ?? SpecStatus.pending), duration: (sdkOutline as any).executionTime || 0 },
      ruleViolations: this.mapRuleViolations(sdkOutline),
    } as any;
  }

  private buildStepTest(
    parentId: string,
    sdkStep: SDKStepDefinition,
    index: number,
  ): StepTest {
    // IMPORTANT: v3 `StepTest.description` should represent the raw description block
    // (everything after the first line/title). That block may include a docString.
    // The parser stores prose in `sdkStep.description` and docStrings separately in `docStringRaw`.
    // We re-compose them here so the viewer can decide how/if to render docStrings later.
    const prose = typeof (sdkStep as any)?.description === 'string' ? String((sdkStep as any).description) : '';
    const proseTrimmed = prose.trim().length > 0 ? prose.trimEnd() : '';

    const docStringBody = (() => {
      const fromRaw = (sdkStep as any)?.docStringRaw;
      if (typeof fromRaw === 'string' && fromRaw.trim().length > 0) return String(fromRaw).trimEnd();
      return '';
    })();

    const descriptionParts: string[] = [];
    if (proseTrimmed) descriptionParts.push(proseTrimmed);
    if (docStringBody) descriptionParts.push(`"""\n${docStringBody}\n"""`);
    const mappedDescription = descriptionParts.length > 0 ? descriptionParts.join('\n') : undefined;

    const keyword = this.mapKeyword((sdkStep.type || 'and').toLowerCase());

    const dataTables = this.mapStepRichDataToDataTables(sdkStep);

    const stepId = generateStabilityId({
      project: this.options.project,
      title: sdkStep.rawTitle || sdkStep.title,
      kind: 'Step',
      parentId,
      keyword,
      index,
    });

    return {
      id: stepId,
      kind: 'Step',
      keyword,
      title: sdkStep.rawTitle || sdkStep.title,
      description: mappedDescription,
      dataTables: dataTables.length ? dataTables : undefined,
      execution: this.stepExecution(sdkStep),
      ruleViolations: this.mapRuleViolations(sdkStep),
    };
  }

  private mapStepRichDataToDataTables(
    sdkStep: SDKStepDefinition
  ): Array<{ name?: string; headers: string[]; rows: Array<{ rowId: number; values: Array<{ value: unknown; type: string }> }> }> {
    const mapped: Array<{ name?: string; headers: string[]; rows: Array<{ rowId: number; values: Array<{ value: unknown; type: string }> }> }> = [];

    const rawDataTable = (sdkStep as any).dataTable;
    if (Array.isArray(rawDataTable) && rawDataTable.length > 0) {
      mapped.push(this.mapStepDataTable(rawDataTable));
    }

    const rawValues = (sdkStep as any).values;
    if (Array.isArray(rawValues) && rawValues.length > 0) {
      mapped.push(this.mapStepValues(rawValues));
    }

    return mapped;
  }

  private mapStepDataTable(rawRows: any[]): { name?: string; headers: string[]; rows: Array<{ rowId: number; values: Array<{ value: unknown; type: string }> }> } {
    const first = rawRows[0];

    const looksLikeHeaderRow = Array.isArray(first) && first.every((c) => typeof c === 'string');
    const headers = looksLikeHeaderRow
      ? (first as string[]).map(String)
      : Array.isArray(first)
        ? first.map((_, idx) => `col${idx + 1}`)
        : first && typeof first === 'object'
          ? Object.keys(first)
          : [];

    const dataRows = looksLikeHeaderRow ? rawRows.slice(1) : rawRows;

    return {
      headers,
      rows: dataRows.map((r, idx) => ({
        rowId: idx,
        values: headers.map((h, hIdx) => this.toTypedValue(Array.isArray(r) ? r[hIdx] : (r as any)?.[h])),
      })),
    };
  }

  private mapStepValues(values: any[]): { name?: string; headers: string[]; rows: Array<{ rowId: number; values: Array<{ value: unknown; type: string }> }> } {
    const headers = values.map((_, idx) => `arg${idx + 1}`);
    return {
      name: 'values',
      headers,
      rows: [{ rowId: 0, values: values.map((v) => this.toTypedValue(v)) }],
    };
  }

  private mapKeyword(keyword: string): StepKeyword {
    switch (keyword) {
      case 'given':
      case 'when':
      case 'then':
      case 'and':
      case 'but':
        return keyword;
      default:
        return 'and';
    }
  }

  private stepExecution(step: SDKStepDefinition): ExecutionResult {
    const status = this.mapStatus(step.status);

    const error =
      step.status === SpecStatus.fail && (step as any).exception
        ? {
            message: (step as any).exception.message || 'Unknown error',
            stack: (step as any).exception.stackTrace,
            code:
              (step as any).exception.expected && (step as any).exception.actual
                ? `Expected: ${(step as any).exception.expected}\nActual: ${(step as any).exception.actual}`
                : undefined,
          }
        : undefined;

    return {
      status,
      duration: (step as any).duration || 0,
      error,
    };
  }

  private scenarioExecutionFromSteps(steps: StepTest[]): ExecutionResult {
    const statuses = steps.map((s) => s.execution.status);
    const status = this.aggregateStatus(statuses);
    const duration = steps.reduce((sum, s) => sum + (Number(s.execution.duration) || 0), 0);
    return { status, duration };
  }

  private aggregateStatus(statuses: Status[]): Status {
    const s = new Set(statuses);
    if (s.has('failed') || s.has('timedOut')) return 'failed';
    if (s.has('cancelled')) return 'cancelled';
    if (s.has('running')) return 'running';
    if (s.has('pending')) return 'pending';
    if (s.has('skipped')) return 'skipped';
    if (s.has('passed')) return 'passed';
    return 'pending';
  }

  private computeStatisticsFromTests(tests: AnyTest[]): Statistics {
    const stats: Statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };

    const add = (status: Status) => {
      stats.total += 1;
      if (status === 'passed') stats.passed += 1;
      else if (status === 'failed' || status === 'timedOut') stats.failed += 1;
      else if (status === 'skipped' || status === 'cancelled') stats.skipped += 1;
      else stats.pending += 1;
    };

    for (const t of tests) {
      add((t as any).execution?.status ?? 'pending');
    }

    return stats;
  }

  private mapMetaTablesToDataTables(tables: any[]): Array<{ name?: string; headers: string[]; rows: Array<{ rowId: number; values: any[] }> }> {
    const mapped: Array<{ name?: string; headers: string[]; rows: Array<{ rowId: number; values: any[] }> }> = [];

    let nextRowId = 0;

    for (const t of tables || []) {
      const rawRows = (t?.dataTable ?? []) as any[];

      const first = rawRows[0];
      const looksLikeHeaderRow = Array.isArray(first) && first.every((c) => typeof c === 'string');

      const headers = (() => {
        if (looksLikeHeaderRow) {
          return (first as string[]).map((h) => String(h ?? '').trim()).filter(Boolean);
        }
        if (first && typeof first === 'object' && !Array.isArray(first)) {
          return Object.keys(first);
        }
        if (Array.isArray(first)) {
          return first.map((_, idx) => `col${idx + 1}`);
        }
        return [] as string[];
      })();

      const dataRows = looksLikeHeaderRow ? rawRows.slice(1) : rawRows;

      const rows: Array<{ rowId: number; values: any[] }> = [];

      for (const r of dataRows) {
        const values = headers.map((h, idx) => this.toTypedValue(Array.isArray(r) ? r[idx] : (r as any)?.[h]));
        rows.push({ rowId: nextRowId++, values });
      }

      const name = typeof t?.name === 'string' && String(t.name).trim().length > 0 ? String(t.name) : undefined;
      mapped.push({ name, headers, rows });
    }

    return mapped;
  }

  private buildScenarioOutlineExampleResults(
    templateSteps: StepTest[],
    executedExamples: SDKScenarioExample[],
    rowIds: number[]
  ): Array<{ testId: string; result: ExecutionResult }> {
    const results: Array<{ testId: string; result: ExecutionResult }> = [];

    const count = Math.min(executedExamples.length, rowIds.length);
    for (let i = 0; i < count; i++) {
      const rowId = rowIds[i];
      if (!Number.isFinite(rowId)) continue;

      const ex = executedExamples[i] as any;
      const exSteps = Array.isArray(ex?.steps) ? (ex.steps as SDKStepDefinition[]) : [];

      for (let stepIndex = 0; stepIndex < templateSteps.length; stepIndex++) {
        const templateStepId = templateSteps[stepIndex]?.id;
        const sdkStep = exSteps[stepIndex];
        if (!templateStepId || !sdkStep) continue;

        const base = this.stepExecution(sdkStep);
        const withRowId = { ...base, rowId } as ExecutionResult;
        results.push({ testId: templateStepId, result: withRowId });
      }
    }

    return results;
  }

  private buildRuleOutlineExampleResults(
    outlineId: string,
    executedExamples: any[],
    rowIds: number[]
  ): Array<{ testId: string; result: ExecutionResult }> {
    const results: Array<{ testId: string; result: ExecutionResult }> = [];

    const count = Math.min(executedExamples.length, rowIds.length);
    for (let i = 0; i < count; i++) {
      const rowId = rowIds[i];
      if (!Number.isFinite(rowId)) continue;

      const ex = executedExamples[i] as any;
      const status = this.mapStatus(ex?.status ?? SpecStatus.unknown);
      const duration = Number(ex?.executionTime ?? ex?.duration ?? 0) || 0;
      const error = ex?.error?.message
        ? ({ message: String(ex.error.message), stack: typeof ex.error.stack === 'string' ? String(ex.error.stack) : undefined } as any)
        : undefined;

      results.push({
        testId: outlineId,
        result: { status, duration, error, rowId } as ExecutionResult,
      });
    }

    return results;
  }

  private computeOutlineStatistics(executedExamples: SDKScenarioExample[], total: number): Statistics {
    const stats: Statistics = { total, passed: 0, failed: 0, pending: 0, skipped: 0 };
    const mapped = executedExamples.map((ex) => this.mapStatus(this.calculateScenarioStatus(ex)));

    for (let i = 0; i < total; i++) {
      const status = mapped[i] ?? 'pending';
      if (status === 'passed') stats.passed += 1;
      else if (status === 'failed' || status === 'timedOut') stats.failed += 1;
      else if (status === 'skipped' || status === 'cancelled') stats.skipped += 1;
      else stats.pending += 1;
    }

    return stats;
  }

  private computeRuleOutlineStatistics(executedExamples: any[], total: number): Statistics {
    const stats: Statistics = { total, passed: 0, failed: 0, pending: 0, skipped: 0 };
    const mapped = executedExamples.map((ex) => this.mapStatus(ex?.status ?? SpecStatus.unknown));

    for (let i = 0; i < total; i++) {
      const status = mapped[i] ?? 'pending';
      if (status === 'passed') stats.passed += 1;
      else if (status === 'failed' || status === 'timedOut') stats.failed += 1;
      else if (status === 'skipped' || status === 'cancelled') stats.skipped += 1;
      else stats.pending += 1;
    }

    return stats;
  }

  private toTypedValue(value: unknown): { value: unknown; type: string } {
    if (value === null) return { value: null, type: 'null' };
    if (value === undefined) return { value: undefined, type: 'undefined' };
    if (typeof value === 'string') return { value, type: 'string' };
    if (typeof value === 'number') return { value, type: 'number' };
    if (typeof value === 'boolean') return { value, type: 'boolean' };
    if (value instanceof Date) return { value: value.toISOString(), type: 'date' };
    return { value, type: 'object' };
  }

  private async completeRun(runId: string, results: ExecutionResults): Promise<void> {
    const { summary, duration } = this.calculateSummary(results);
    const overallStatus = this.calculateOverallStatus(results);

    const request: V3CompleteRunRequest = {
      status: overallStatus,
      duration,
      summary,
    };

    await this.post(`/api/v3/runs/${runId}/complete`, request);
  }

  private mapStatus(status: SpecStatus): Status {
    switch (status) {
      case SpecStatus.pass:
        return 'passed';
      case SpecStatus.fail:
        return 'failed';
      case SpecStatus.pending:
      case SpecStatus.unknown:
      default:
        return 'pending';
    }
  }

  private calculateScenarioStatus(scenario: SDKScenario | SDKScenarioExample): SpecStatus {
    let hasFailure = false;
    let hasPending = false;

    for (const step of scenario.steps) {
      if (step.status === SpecStatus.fail) hasFailure = true;
      if (step.status === SpecStatus.pending || step.status === SpecStatus.unknown) hasPending = true;
    }

    if (hasFailure) return SpecStatus.fail;
    if (hasPending) return SpecStatus.pending;
    return SpecStatus.pass;
  }

  private calculateOutlineStatus(outline: SDKScenarioOutline): SpecStatus {
    let hasFailure = false;
    let hasPending = false;

    for (const example of outline.examples) {
      const status = this.calculateScenarioStatus(example);
      if (status === SpecStatus.fail) hasFailure = true;
      if (status === SpecStatus.pending) hasPending = true;
    }

    if (hasFailure) return SpecStatus.fail;
    if (hasPending) return SpecStatus.pending;
    return SpecStatus.pass;
  }

  private calculateOverallStatus(results: ExecutionResults): Status {
    const summary = this.calculateSummary(results).summary;
    if (summary.failed > 0) return 'failed';
    if (summary.pending > 0) return 'running';
    return 'passed';
  }

  private calculateSummary(results: ExecutionResults): { summary: Statistics; duration: number } {
    const summary: Statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };

    for (const feature of results.features || []) {
      for (const scenario of feature.scenarios || []) {
        const outline = scenario as SDKScenarioOutline;
        if ((outline as any).examples && (outline as any).examples.length > 0) {
          for (const example of outline.examples) {
            const status = this.calculateScenarioStatus(example);
            summary.total += 1;
            if (status === SpecStatus.pass) summary.passed += 1;
            else if (status === SpecStatus.fail) summary.failed += 1;
            else summary.pending += 1;
          }
        } else {
          const status = this.calculateScenarioStatus(scenario as SDKScenario);
          summary.total += 1;
          if (status === SpecStatus.pass) summary.passed += 1;
          else if (status === SpecStatus.fail) summary.failed += 1;
          else summary.pending += 1;
        }
      }
    }

    const duration = (results as any).executionTime ?? 0;

    return { summary, duration };
  }

  private mapRuleViolations(entity: any): Array<{ rule: string; message: string; title?: string; errorId?: number }> | undefined {
    const list = entity?.ruleViolations;
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list
      .map((v: any) => ({
        rule: String(v?.rule ?? ''),
        message: String(v?.message ?? v?.toString?.() ?? ''),
        title: typeof v?.title === 'string' ? v.title : undefined,
        errorId: typeof v?.errorId === 'number' ? v.errorId : undefined,
      }))
      .filter((v: any) => v.rule || v.message);
  }

  private async post<T>(p: string, body: any, method: 'POST' | 'PATCH' | 'PUT' = 'POST'): Promise<T | null> {
    const url = `${this.options.server}${p}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (!this.options.silent) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch {
            // ignore
          }
          console.error(`LiveDocViewerReporter: HTTP ${response.status} at ${p}. Error: ${errorText}`);
        }
        return null;
      }

      try {
        return (await (response as any).json()) as T;
      } catch {
        return null;
      }
    } catch (e) {
      if (!this.options.silent) {
        console.error(`LiveDocViewerReporter: Failed request to ${url}`, e);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
