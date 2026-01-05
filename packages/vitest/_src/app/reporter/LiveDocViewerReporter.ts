import { IPostReporter } from "./IPostReporter";
import * as path from 'path';
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
    LiveDocTest as SDKLiveDocTest
} from "../model/index";
import {
    Node,
    Feature,
    Scenario,
    ScenarioOutline,
    Step,
    Specification,
    Rule,
    RuleOutline,
    TestSuite,
    Test,
    Status,
    Framework,
    generateStabilityId,
    TypedValue,
    Binding,
    ExampleTable,
    Row,
    Statistics
} from "@livedoc/schema";

// =============================================================================
// Types from livedoc-viewer schema (vNext)
// =============================================================================

interface StartRunResponse {
    runId: string;
    websocketUrl: string;
}

interface CompleteRunRequest {
    status: Status;
    duration: number;
    summary: Statistics;
}

/**
 * Reporter options for LiveDocViewer
 */
export interface LiveDocViewerOptions {
    /** Server URL, e.g., 'http://localhost:3000' */
    server?: string;
    /** Project name (defaults to 'default') */
    project?: string;
    /** Environment name (defaults to 'local') */
    environment?: string;
    /** Timeout in milliseconds for HTTP requests */
    timeout?: number;
    /** Whether to fail silently if server is unavailable */
    silent?: boolean;
}

/**
 * Post-reporter that sends test results to the LiveDoc Viewer server
 * Enables live visualization of test execution in a web browser
 */
export class LiveDocViewerReporter implements IPostReporter {
    private options: Required<LiveDocViewerOptions>;

    constructor(options?: LiveDocViewerOptions) {
        this.options = {
            server: options?.server || 'http://localhost:3000',
            project: options?.project || 'default',
            environment: options?.environment || 'local',
            timeout: options?.timeout || 10000,
            silent: options?.silent ?? true
        };
    }

    public async execute(results: ExecutionResults, rawOptions?: any): Promise<void> {
        // Override with inline options if provided
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

        try {
            // 1. Start the run
            const runId = await this.startRun();
            if (!runId) {
                if (!this.options.silent) {
                    console.error(`LiveDocViewerReporter: Failed to connect to server at ${this.options.server}`);
                }
                return;
            }

            console.log(`LiveDoc Viewer: Connected to ${this.options.server}`);
            console.log(`  Project:     ${this.options.project}`);
            console.log(`  Environment: ${this.options.environment}`);

            const pathContext = this.buildPathContext(results);

            // 2. Post all features
            for (const feature of results.features) {
                await this.postFeature(runId, feature, pathContext);
            }

            // 2b. Post specifications and suites (first-class in vNext)
            for (const spec of (results as any).specifications || []) {
                await this.postSpecification(runId, spec as SDKSpecification, pathContext);
            }
            for (const suite of (results as any).suites || []) {
                await this.postTestSuite(runId, suite as SDKVitestSuite, pathContext);
            }

            // 3. Complete the run with summary
            await this.completeRun(runId, results);

            console.log(`LiveDoc Viewer: Results successfully posted to ${this.options.server}`);
        } catch (error) {
            if (!this.options.silent) {
                console.error('LiveDocViewerReporter error:', error);
            }
        }
    }

    private buildPathContext(results: ExecutionResults): { rootPath: string } {
        const filenames: string[] = [];
        for (const f of results.features || []) {
            if (f?.filename) filenames.push(f.filename);
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

    private async startRun(): Promise<string | null> {
        const request = {
            project: this.options.project,
            environment: this.options.environment,
            framework: 'vitest' as Framework
        };

        const response = await this.post<StartRunResponse>('/api/runs/start', request);
        return response?.runId || null;
    }

    private async postFeature(runId: string, sdkFeature: SDKFeature, pathContext: { rootPath: string }): Promise<void> {
        const fileInfo = this.buildFileInfo(sdkFeature.filename, pathContext.rootPath);
        
        const featureId = generateStabilityId({
            project: this.options.project,
            path: fileInfo.filename,
            title: sdkFeature.title,
            kind: 'Feature'
        });

        const feature: Feature = {
            id: featureId,
            kind: 'Feature',
            title: sdkFeature.title,
            description: sdkFeature.description,
            tags: sdkFeature.tags,
            execution: {
                status: this.mapStatus(this.calculateFeatureStatus(sdkFeature)),
                duration: 0
            },
            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            children: []
        };

        await this.postNode(runId, undefined, feature);

        // Post background if exists
        if (sdkFeature.background) {
            await this.postScenario(runId, featureId, sdkFeature.background, 'Scenario'); // Background is a Scenario in vNext
        }

        // Post all scenarios
        for (const sdkScenario of sdkFeature.scenarios) {
            if (sdkScenario instanceof SDKScenarioOutline || (sdkScenario as any).examples) {
                await this.postScenarioOutline(runId, featureId, sdkScenario as SDKScenarioOutline);
            } else {
                await this.postScenario(runId, featureId, sdkScenario as SDKScenario);
            }
        }
    }

    private async postScenario(
        runId: string,
        parentId: string,
        sdkScenario: SDKScenario,
        kind: 'Scenario' = 'Scenario'
    ): Promise<void> {
        const scenarioId = generateStabilityId({
            project: this.options.project,
            title: sdkScenario.title,
            kind,
            parentId
        });

        const scenario: Scenario = {
            id: scenarioId,
            kind,
            title: sdkScenario.title,
            description: sdkScenario.description,
            tags: sdkScenario.tags,
            execution: {
                status: this.mapStatus(this.calculateScenarioStatus(sdkScenario)),
                duration: sdkScenario.executionTime || 0
            },
            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            children: []
        };

        await this.postNode(runId, parentId, scenario);

        // Post all steps
        for (let i = 0; i < sdkScenario.steps.length; i++) {
            await this.postStep(runId, scenarioId, sdkScenario.steps[i], i);
        }
    }

    private async postScenarioOutline(
        runId: string,
        parentId: string,
        sdkOutline: SDKScenarioOutline
    ): Promise<void> {
        const outlineId = generateStabilityId({
            project: this.options.project,
            title: sdkOutline.title,
            kind: 'ScenarioOutline',
            parentId
        });

        // Template scenario
        const templateScenario: Scenario = {
            id: `${outlineId}:template`,
            kind: 'Scenario',
            title: sdkOutline.title,
            execution: { status: 'pending', duration: 0 },
            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            children: sdkOutline.examples[0]?.steps.map((s, i) => ({
                id: `${outlineId}:template:step:${i}`,
                kind: 'Step',
                title: s.rawTitle || s.title,
                keyword: s.type.toLowerCase() as any,
                execution: { status: 'pending', duration: 0 }
            })) || []
        };

        const outline: ScenarioOutline = {
            id: outlineId,
            kind: 'ScenarioOutline',
            title: sdkOutline.title,
            description: sdkOutline.description,
            tags: sdkOutline.tags,
            execution: {
                status: this.mapStatus(this.calculateOutlineStatus(sdkOutline)),
                duration: 0
            },
            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            template: templateScenario,
            examples: [],
            tables: [] // TODO: Map tables if available in SDK
        };

        await this.postNode(runId, parentId, outline);

        // Post each example
        for (let i = 0; i < sdkOutline.examples.length; i++) {
            const sdkExample = sdkOutline.examples[i];
            const exampleId = generateStabilityId({
                project: this.options.project,
                title: sdkOutline.title,
                kind: 'Scenario',
                parentId: outlineId,
                index: i
            });

            const example: Scenario = {
                id: exampleId,
                kind: 'Scenario',
                title: sdkOutline.title,
                binding: this.mapBinding(sdkExample.example || sdkExample.exampleRaw),
                execution: {
                    status: this.mapStatus(this.calculateScenarioStatus(sdkExample)),
                    duration: sdkExample.executionTime || 0
                },
                summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                children: []
            };

            await this.postNode(runId, outlineId, example);

            // Post steps for this example
            for (let j = 0; j < sdkExample.steps.length; j++) {
                await this.postStep(runId, exampleId, sdkExample.steps[j], j);
            }
        }
    }

    private async postStep(runId: string, parentId: string, sdkStep: SDKStepDefinition, index: number): Promise<void> {
        const stepId = generateStabilityId({
            project: this.options.project,
            title: sdkStep.rawTitle || sdkStep.title,
            kind: 'Step',
            parentId,
            keyword: sdkStep.type.toLowerCase(),
            index
        });

        const step: Step = {
            id: stepId,
            kind: 'Step',
            title: sdkStep.rawTitle || sdkStep.title,
            keyword: sdkStep.type.toLowerCase() as any,
            execution: {
                status: this.mapStatus(sdkStep.status),
                duration: sdkStep.duration || 0,
                error: sdkStep.status === SpecStatus.fail && sdkStep.exception ? {
                    message: sdkStep.exception.message || 'Unknown error',
                    stack: sdkStep.exception.stackTrace,
                    diff: sdkStep.exception.expected && sdkStep.exception.actual
                        ? `Expected: ${sdkStep.exception.expected}\nActual: ${sdkStep.exception.actual}`
                        : undefined
                } : undefined
            },
            docString: sdkStep.docString || undefined,
            dataTable: this.mapDataTableVNext(sdkStep.dataTable),
            values: this.mapTypedValues(sdkStep.values)
        };

        await this.postNode(runId, parentId, step);
    }

    private async postNode(runId: string, parentId: string | undefined, node: Node): Promise<void> {
        await this.post(`/api/runs/${runId}/nodes`, { parentId, node });
    }

    private mapBinding(example: any): Binding | undefined {
        if (!example) return undefined;
        const variables: Binding['variables'] = [];
        for (const [name, value] of Object.entries(example)) {
            variables.push({
                name,
                value: this.toTypedValue(value)
            });
        }
        return { variables };
    }

    private toTypedValue(value: any): TypedValue {
        const type = typeof value;
        let mappedType: TypedValue['type'] = 'string';
        if (type === 'number') mappedType = 'number';
        else if (type === 'boolean') mappedType = 'boolean';
        else if (value instanceof Date) mappedType = 'date';
        else if (type === 'object') mappedType = 'object';
        else if (value === null) mappedType = 'null';
        else if (value === undefined) mappedType = 'undefined';

        return {
            value,
            type: mappedType
        };
    }

    private mapTypedValues(values: any[] | undefined): TypedValue[] | undefined {
        if (!values) return undefined;
        return values.map(v => this.toTypedValue(v));
    }

    private mapDataTableVNext(dataTable: any[] | undefined): ExampleTable | undefined {
        if (!dataTable || dataTable.length < 2) return undefined;
        const headers = dataTable[0] as string[];
        const rows: Row[] = [];
        for (let i = 1; i < dataTable.length; i++) {
            const sdkRow = dataTable[i] as any[];
            rows.push({
                rowId: `row-${i}`,
                values: sdkRow.map(v => this.toTypedValue(v))
            });
        }
        return {
            name: 'Data Table',
            headers,
            rows
        };
    }

    private async completeRun(runId: string, results: ExecutionResults): Promise<void> {
        const { summary, duration } = this.calculateSummary(results);
        const overallStatus = this.calculateOverallStatus(results);

        const request: CompleteRunRequest = {
            status: overallStatus,
            duration,
            summary
        };

        await this.post(`/api/runs/${runId}/complete`, request);
    }

    // =========================================================================
    // Helper methods
    // =========================================================================

    private async post<T>(path: string, body: unknown): Promise<T | null> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

            const response = await fetch(`${this.options.server}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'No error body');
                if (!this.options.silent) {
                    console.error(`LiveDocViewerReporter: HTTP ${response.status} at ${path}. Error: ${errorText}`);
                }
                return null;
            }

            return await response.json() as T;
        } catch (error) {
            if (!this.options.silent) {
                console.error(`LiveDocViewerReporter: Failed to POST ${path}:`, error);
            }
            return null;
        }
    }

    private mapStatus(status: SpecStatus): Status {
        switch (status) {
            case SpecStatus.pass:
                return 'passed';
            case SpecStatus.fail:
                return 'failed';
            case SpecStatus.pending:
                return 'pending';
            case SpecStatus.unknown:
            default:
                return 'pending';
        }
    }

    private calculateFeatureStatus(feature: SDKFeature): SpecStatus {
        let hasFailure = false;
        let hasPending = false;

        for (const scenario of feature.scenarios) {
            // Check if it's a ScenarioOutline (has examples array) vs regular Scenario
            const outline = scenario as SDKScenarioOutline;
            const status = outline.examples && outline.examples.length > 0
                ? this.calculateOutlineStatus(outline)
                : this.calculateScenarioStatus(scenario as SDKScenario);
            if (status === SpecStatus.fail) hasFailure = true;
            if (status === SpecStatus.pending) hasPending = true;
        }

        if (hasFailure) return SpecStatus.fail;
        if (hasPending) return SpecStatus.pending;
        return SpecStatus.pass;
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

    private calculateOverallStatus(_results: ExecutionResults): Status {
        // The run status indicates whether the run completed, not the test results.
        // Individual test statuses (passed/failed/pending) are tracked separately.
        return 'passed';
    }

    private calculateSummary(results: ExecutionResults): { summary: Statistics; duration: number } {
        let total = 0;
        let passed = 0;
        let failed = 0;
        let pending = 0;
        let skipped = 0;
        let duration = 0;

        for (const feature of results.features) {
            for (const scenario of feature.scenarios) {
                if ((scenario as any).examples) {
                    // ScenarioOutline
                    const outline = scenario as SDKScenarioOutline;
                    for (const example of outline.examples) {
                        total++;
                        duration += example.executionTime || 0;
                        const status = this.calculateScenarioStatus(example);
                        if (status === SpecStatus.pass) passed++;
                        else if (status === SpecStatus.fail) failed++;
                        else if (status === SpecStatus.pending) pending++;
                    }
                } else {
                    // Regular Scenario
                    total++;
                    duration += (scenario as SDKScenario).executionTime || 0;
                    const status = this.calculateScenarioStatus(scenario as SDKScenario);
                    if (status === SpecStatus.pass) passed++;
                    else if (status === SpecStatus.fail) failed++;
                    else if (status === SpecStatus.pending) pending++;
                }
            }
        }

        // Specifications: count rules; RuleOutline counts examples (like ScenarioOutline)
        const specifications: SDKSpecification[] = (results as any).specifications || [];
        for (const spec of specifications) {
            for (const rule of spec.rules || []) {
                if (rule instanceof SDKRuleOutline) {
                    for (const ex of rule.examples || []) {
                        total++;
                        duration += ex.executionTime || 0;
                        const st = ex.status;
                        if (st === SpecStatus.pass) passed++;
                        else if (st === SpecStatus.fail) failed++;
                        else pending++;
                    }
                } else {
                    total++;
                    duration += (rule as SDKRule).executionTime || 0;
                    const st = (rule as SDKRule).status;
                    if (st === SpecStatus.pass) passed++;
                    else if (st === SpecStatus.fail) failed++;
                    else pending++;
                }
            }
        }

        // Suites: count tests
        const suites: SDKVitestSuite[] = (results as any).suites || [];
        const collectTests = (suite: SDKVitestSuite): SDKLiveDocTest<SDKVitestSuite>[] => {
            const all: SDKLiveDocTest<SDKVitestSuite>[] = [...(suite.tests || [])];
            for (const child of suite.children || []) {
                all.push(...collectTests(child));
            }
            return all;
        };
        for (const suite of suites) {
            for (const t of collectTests(suite)) {
                total++;
                duration += t.duration || 0;
                const st = t.status;
                if (st === SpecStatus.pass) passed++;
                else if (st === SpecStatus.fail) failed++;
                else pending++;
            }
        }

        return {
            summary: {
                total,
                passed,
                failed,
                pending,
                skipped
            },
            duration
        };
    }

    // =========================================================================
    // Specification / Suite mapping for viewer
    // =========================================================================

    private async postSpecification(runId: string, sdkSpec: SDKSpecification, pathContext: { rootPath: string }): Promise<void> {
        const fileInfo = this.buildFileInfo((sdkSpec as any).filename, pathContext.rootPath);
        const specId = generateStabilityId({
            project: this.options.project,
            path: fileInfo.filename,
            title: sdkSpec.title,
            kind: 'Specification'
        });

        const spec: Specification = {
            id: specId,
            kind: 'Specification',
            title: sdkSpec.title,
            description: sdkSpec.description,
            tags: sdkSpec.tags,
            execution: {
                status: this.mapStatus(this.calculateSpecificationStatus(sdkSpec)),
                duration: 0
            },
            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            children: []
        };

        await this.postNode(runId, undefined, spec);

        for (const sdkRule of sdkSpec.rules || []) {
            if (sdkRule instanceof SDKRuleOutline) {
                await this.postRuleOutline(runId, specId, sdkRule);
            } else {
                await this.postRule(runId, specId, sdkRule as SDKRule);
            }
        }
    }

    private async postRule(runId: string, parentId: string, sdkRule: SDKRule): Promise<void> {
        const ruleId = generateStabilityId({
            project: this.options.project,
            title: sdkRule.title,
            kind: 'Rule',
            parentId
        });

        const rule: Rule = {
            id: ruleId,
            kind: 'Rule',
            title: sdkRule.title,
            description: sdkRule.description,
            tags: sdkRule.tags,
            execution: {
                status: this.mapStatus(sdkRule.status),
                duration: sdkRule.executionTime || 0
            },
            code: (sdkRule as any).code
        };

        await this.postNode(runId, parentId, rule);
    }

    private async postRuleOutline(runId: string, parentId: string, sdkOutline: SDKRuleOutline): Promise<void> {
        const outlineId = generateStabilityId({
            project: this.options.project,
            title: sdkOutline.title,
            kind: 'RuleOutline',
            parentId
        });

        const templateRule: Rule = {
            id: `${outlineId}:template`,
            kind: 'Rule',
            title: sdkOutline.title,
            execution: { status: 'pending', duration: 0 }
        };

        const outline: RuleOutline = {
            id: outlineId,
            kind: 'RuleOutline',
            title: sdkOutline.title,
            description: sdkOutline.description,
            tags: sdkOutline.tags,
            execution: {
                status: this.mapStatus(this.calculateRuleOutlineStatus(sdkOutline)),
                duration: 0
            },
            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            template: templateRule,
            examples: [],
            tables: []
        };

        await this.postNode(runId, parentId, outline);

        for (let i = 0; i < sdkOutline.examples.length; i++) {
            const sdkExample = sdkOutline.examples[i];
            const exampleId = generateStabilityId({
                project: this.options.project,
                title: sdkOutline.title,
                kind: 'Rule',
                parentId: outlineId,
                index: i
            });

            const example: Rule = {
                id: exampleId,
                kind: 'Rule',
                title: sdkOutline.title,
                binding: this.mapBinding(sdkExample.example || sdkExample.exampleRaw),
                execution: {
                    status: this.mapStatus(sdkExample.status),
                    duration: sdkExample.executionTime || 0
                }
            };

            await this.postNode(runId, outlineId, example);
        }
    }

    private async postTestSuite(runId: string, sdkSuite: SDKVitestSuite, pathContext: { rootPath: string }): Promise<void> {
        const fileInfo = this.buildFileInfo((sdkSuite as any).filename, pathContext.rootPath);
        const suiteId = generateStabilityId({
            project: this.options.project,
            path: fileInfo.filename,
            title: sdkSuite.title,
            kind: 'Suite'
        });

        const suite: TestSuite = {
            id: suiteId,
            kind: 'Suite',
            title: sdkSuite.title,
            execution: {
                status: 'passed', // Will be updated by server
                duration: 0
            },
            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
            children: []
        };

        await this.postNode(runId, undefined, suite);

        for (const sdkTest of sdkSuite.tests || []) {
            await this.postTest(runId, suiteId, sdkTest);
        }

        for (const sdkChild of sdkSuite.children || []) {
            await this.postTestSuite(runId, sdkChild, pathContext);
        }
    }

    private async postTest(runId: string, parentId: string, sdkTest: SDKLiveDocTest<SDKVitestSuite>): Promise<void> {
        const testId = generateStabilityId({
            project: this.options.project,
            title: sdkTest.title,
            kind: 'Test',
            parentId
        });

        const test: Test = {
            id: testId,
            kind: 'Test',
            title: sdkTest.title,
            execution: {
                status: this.mapStatus(sdkTest.status),
                duration: sdkTest.duration || 0,
                error: sdkTest.status === SpecStatus.fail && sdkTest.exception ? {
                    message: sdkTest.exception.message || 'Unknown error',
                    stack: sdkTest.exception.stackTrace,
                    diff: sdkTest.exception.expected && sdkTest.exception.actual
                        ? `Expected: ${sdkTest.exception.expected}\nActual: ${sdkTest.exception.actual}`
                        : undefined
                } : undefined
            },
            code: sdkTest.code || undefined
        };

        await this.postNode(runId, parentId, test);
    }

    private calculateSpecificationStatus(spec: SDKSpecification): SpecStatus {
        let hasFailure = false;
        let hasPending = false;
        for (const rule of spec.rules || []) {
            if (rule instanceof SDKRuleOutline) {
                const st = this.calculateRuleOutlineStatus(rule);
                if (st === SpecStatus.fail) hasFailure = true;
                if (st === SpecStatus.pending) hasPending = true;
            } else {
                const st = (rule as SDKRule).status;
                if (st === SpecStatus.fail) hasFailure = true;
                if (st === SpecStatus.pending || st === SpecStatus.unknown) hasPending = true;
            }
        }
        if (hasFailure) return SpecStatus.fail;
        if (hasPending) return SpecStatus.pending;
        return SpecStatus.pass;
    }

    private calculateRuleOutlineStatus(rule: SDKRuleOutline): SpecStatus {
        let hasFailure = false;
        let hasPending = false;
        for (const ex of rule.examples || []) {
            if (ex.status === SpecStatus.fail) hasFailure = true;
            if (ex.status === SpecStatus.pending || ex.status === SpecStatus.unknown) hasPending = true;
        }
        if (hasFailure) return SpecStatus.fail;
        if (hasPending) return SpecStatus.pending;
        return SpecStatus.pass;
    }
}
