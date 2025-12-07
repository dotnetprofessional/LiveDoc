import { IPostReporter } from "./IPostReporter";
import {
    ExecutionResults,
    Feature,
    Scenario,
    ScenarioOutline,
    ScenarioExample,
    StepDefinition,
    SpecStatus
} from "../model/index";

// =============================================================================
// Types from livedoc-viewer schema (duplicated to avoid cross-package imports)
// =============================================================================

type Framework = 'vitest' | 'xunit' | 'mocha' | 'jest';
type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'completed';
type StepType = 'Given' | 'When' | 'Then' | 'and' | 'but' | 'Background';
type ScenarioType = 'Scenario' | 'ScenarioOutline' | 'Background';

interface Statistics {
    total: number;
    passed: number;
    failed: number;
    pending: number;
    skipped: number;
    duration: number;
}

interface RuleViolation {
    rule: string;
    message: string;
    title?: string;
}

interface ErrorInfo {
    message: string;
    stack?: string;
    expected?: string;
    actual?: string;
    diff?: string;
    filename?: string;
    line?: number;
    column?: number;
}

interface ViewerDataTableRow {
    [key: string]: string;
}

interface StartRunRequest {
    project: string;
    environment: string;
    framework: Framework;
    timestamp?: string;
}

interface StartRunResponse {
    runId: string;
    websocketUrl: string;
}

interface PostFeatureRequest {
    id: string;
    title: string;
    displayTitle?: string;
    description?: string;
    rawDescription?: string;
    filename: string;
    tags?: string[];
    status: TestStatus;
    sequence?: number;
    ruleViolations?: RuleViolation[];
}

interface PostScenarioRequest {
    featureId: string;
    id: string;
    type: ScenarioType;
    title: string;
    displayTitle?: string;
    description?: string;
    rawDescription?: string;
    tags?: string[];
    status: TestStatus;
    sequence?: number;
    ruleViolations?: RuleViolation[];
    
    // For ScenarioOutline examples
    outlineId?: string;
    exampleIndex?: number;
    exampleValues?: Record<string, unknown>;
    exampleValuesRaw?: Record<string, string>;
    
    // Template steps for ScenarioOutline (with placeholders)
    steps?: { type: StepType; title: string; rawTitle?: string }[];
}

interface PostStepRequest {
    scenarioId: string;
    id: string;
    type: StepType;
    title: string;
    displayTitle?: string;
    rawTitle?: string;
    status: TestStatus;
    duration: number;
    sequence?: number;
    error?: ErrorInfo;
    
    // Data
    docString?: string;
    docStringRaw?: string;
    dataTable?: ViewerDataTableRow[];
    values?: unknown[];
    valuesRaw?: string[];
    
    // Validation
    ruleViolations?: RuleViolation[];
    
    // Code
    code?: string;
}

interface CompleteRunRequest {
    status: TestStatus;
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
            timeout: options?.timeout || 5000,
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

        try {
            // 1. Start the run
            const runId = await this.startRun();
            if (!runId) {
                if (!this.options.silent) {
                    console.error('LiveDocViewerReporter: Failed to start run');
                }
                return;
            }

            // 2. Post all features
            for (const feature of results.features) {
                await this.postFeature(runId, feature);
            }

            // 3. Complete the run with summary
            await this.completeRun(runId, results);

            console.log(`LiveDoc Viewer: Results posted to ${this.options.server}`);
            console.log(`  View at: ${this.options.server}`);
        } catch (error) {
            if (!this.options.silent) {
                console.error('LiveDocViewerReporter error:', error);
            }
        }
    }

    private async startRun(): Promise<string | null> {
        const request: StartRunRequest = {
            project: this.options.project,
            environment: this.options.environment,
            framework: 'vitest'
        };

        const response = await this.post<StartRunResponse>('/api/runs/start', request);
        return response?.runId || null;
    }

    private async postFeature(runId: string, feature: Feature): Promise<void> {
        // Post the feature with all available data
        const featureRequest: PostFeatureRequest = {
            id: feature.id || this.generateId(),
            title: feature.title,
            displayTitle: (feature as any).displayTitle || undefined,
            description: feature.description,
            rawDescription: (feature as any).rawDescription || undefined,
            filename: feature.filename,
            tags: feature.tags,
            status: this.mapStatus(this.calculateFeatureStatus(feature)),
            sequence: (feature as any).sequence,
            ruleViolations: this.mapRuleViolations((feature as any).ruleViolations)
        };

        await this.post(`/api/runs/${runId}/features`, featureRequest);

        // Post background if exists
        if (feature.background) {
            await this.postScenario(runId, featureRequest.id, feature.background, 'Background');
        }

        // Post all scenarios
        for (const scenario of feature.scenarios) {
            if (scenario instanceof ScenarioOutline || (scenario as any).examples) {
                // Handle ScenarioOutline with examples
                await this.postScenarioOutline(runId, featureRequest.id, scenario as ScenarioOutline);
            } else {
                await this.postScenario(runId, featureRequest.id, scenario);
            }
        }
    }

    private async postScenario(
        runId: string,
        featureId: string,
        scenario: Scenario,
        typeOverride?: ScenarioType
    ): Promise<void> {
        const status = this.calculateScenarioStatus(scenario);
        const scenarioRequest: PostScenarioRequest = {
            featureId,
            id: scenario.id || this.generateId(),
            type: typeOverride || 'Scenario',
            title: scenario.title,
            displayTitle: (scenario as any).displayTitle || undefined,
            description: scenario.description,
            rawDescription: (scenario as any).rawDescription || undefined,
            tags: scenario.tags,
            status: this.mapStatus(status),
            sequence: (scenario as any).sequence,
            ruleViolations: this.mapRuleViolations((scenario as any).ruleViolations)
        };

        await this.post(`/api/runs/${runId}/scenarios`, scenarioRequest);

        // Post all steps
        for (const step of scenario.steps) {
            await this.postStep(runId, scenarioRequest.id, step);
        }
    }

    private async postScenarioOutline(
        runId: string,
        featureId: string,
        outline: ScenarioOutline
    ): Promise<void> {
        const outlineId = outline.id || this.generateId();

        // Build template steps from the first example's steps using rawTitle (has placeholders)
        // The outline.steps is empty - steps are on the examples with bound values
        // We need to get the unbound template from the first example's rawTitle
        let templateSteps: { type: StepType; title: string; rawTitle?: string }[] = [];
        
        if (outline.examples.length > 0 && outline.examples[0].steps.length > 0) {
            templateSteps = outline.examples[0].steps.map(step => ({
                type: this.mapStepType(step.type),
                title: step.rawTitle || step.title,  // rawTitle has the placeholders
                rawTitle: step.rawTitle || step.title
            }));
        }

        // Post the outline itself with template steps
        const outlineRequest: PostScenarioRequest = {
            featureId,
            id: outlineId,
            type: 'ScenarioOutline',
            title: outline.title,
            displayTitle: (outline as any).displayTitle || undefined,
            description: outline.description,
            rawDescription: (outline as any).rawDescription || undefined,
            tags: outline.tags,
            status: this.mapStatus(this.calculateOutlineStatus(outline)),
            sequence: (outline as any).sequence,
            ruleViolations: this.mapRuleViolations((outline as any).ruleViolations),
            steps: templateSteps  // Include template steps with placeholders
        };

        await this.post(`/api/runs/${runId}/scenarios`, outlineRequest);

        // Post each example as a scenario
        for (let i = 0; i < outline.examples.length; i++) {
            const example = outline.examples[i];
            const exampleVals = this.toExampleValues(example.example || example.exampleRaw);
            const exampleValsRaw = this.toExampleValuesRaw(example.exampleRaw);
            const exampleRequest: PostScenarioRequest = {
                featureId,
                id: example.id || this.generateId(),
                type: 'Scenario',
                title: `Example ${i + 1}`,
                displayTitle: (example as any).displayTitle,
                description: example.description,
                rawDescription: (example as any).rawDescription,
                status: this.mapStatus(this.calculateScenarioStatus(example)),
                sequence: (example as any).sequence,
                ruleViolations: this.mapRuleViolations((example as any).ruleViolations),
                outlineId,
                exampleIndex: i + 1,
                exampleValues: exampleVals,
                exampleValuesRaw: exampleValsRaw
            };

            await this.post(`/api/runs/${runId}/scenarios`, exampleRequest);

            // Post steps for this example
            for (const step of example.steps) {
                await this.postStep(runId, exampleRequest.id, step);
            }
        }
    }

    private async postStep(runId: string, scenarioId: string, step: StepDefinition): Promise<void> {
        const stepRequest: PostStepRequest = {
            scenarioId,
            id: step.id || this.generateId(),
            type: this.mapStepType(step.type),
            title: step.title || step.rawTitle,
            displayTitle: step.displayTitle || undefined,
            rawTitle: step.rawTitle || undefined,
            status: this.mapStatus(step.status),
            duration: step.duration || 0,
            sequence: (step as any).sequence,
            
            // Data
            docString: step.docString || undefined,
            docStringRaw: (step as any).docStringRaw || undefined,
            dataTable: this.mapDataTable(step.dataTable) as ViewerDataTableRow[] | undefined,
            values: step.values?.length ? step.values : undefined,
            valuesRaw: step.valuesRaw?.length ? step.valuesRaw : undefined,
            
            // Validation
            ruleViolations: this.mapRuleViolations(step.ruleViolations),
            
            // Code
            code: (step as any).code || undefined
        };

        // Add error info if failed
        if (step.status === SpecStatus.fail && step.exception) {
            stepRequest.error = {
                message: step.exception.message || 'Unknown error',
                stack: step.exception.stackTrace,
                expected: step.exception.expected || undefined,
                actual: step.exception.actual || undefined
            };
        }

        await this.post(`/api/runs/${runId}/steps`, stepRequest);
    }

    private async completeRun(runId: string, results: ExecutionResults): Promise<void> {
        const summary = this.calculateSummary(results);
        const overallStatus = this.calculateOverallStatus(results);

        const request: CompleteRunRequest = {
            status: overallStatus,
            duration: summary.duration,
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
                if (!this.options.silent) {
                    console.error(`LiveDocViewerReporter: HTTP ${response.status} at ${path}`);
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

    private mapStatus(status: SpecStatus): TestStatus {
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

    private mapStepType(type: string): StepType {
        const normalized = type.toLowerCase();
        switch (normalized) {
            case 'given':
                return 'Given';
            case 'when':
                return 'When';
            case 'then':
                return 'Then';
            case 'and':
                return 'and';
            case 'but':
                return 'but';
            case 'background':
                return 'Background';
            default:
                return 'Given';
        }
    }

    private mapDataTable(dataTable: any[] | undefined): ViewerDataTableRow[] | undefined {
        if (!dataTable || dataTable.length === 0) {
            return undefined;
        }

        // Check if it's already in object format
        if (typeof dataTable[0] === 'object' && !Array.isArray(dataTable[0])) {
            return dataTable as ViewerDataTableRow[];
        }

        // Convert array format to object format
        // First row is headers, rest are data
        if (dataTable.length < 2 || !Array.isArray(dataTable[0])) {
            return undefined;
        }

        const headers = dataTable[0] as string[];
        const result: ViewerDataTableRow[] = [];

        for (let i = 1; i < dataTable.length; i++) {
            const row = dataTable[i] as string[];
            const obj: ViewerDataTableRow = {};
            for (let j = 0; j < headers.length && j < row.length; j++) {
                obj[headers[j]] = row[j];
            }
            result.push(obj);
        }

        return result;
    }

    private toExampleValues(dataRow: any): Record<string, unknown> | undefined {
        if (!dataRow) {
            return undefined;
        }
        // If it's already an object (not array), return as-is
        if (typeof dataRow === 'object' && !Array.isArray(dataRow)) {
            return dataRow as Record<string, unknown>;
        }
        // Cannot convert array format to named values without headers
        return undefined;
    }

    private toExampleValuesRaw(dataRow: any): Record<string, string> | undefined {
        if (!dataRow) {
            return undefined;
        }
        // If it's already an object (not array), convert all values to strings
        if (typeof dataRow === 'object' && !Array.isArray(dataRow)) {
            const result: Record<string, string> = {};
            for (const [key, value] of Object.entries(dataRow)) {
                result[key] = String(value);
            }
            return result;
        }
        return undefined;
    }

    private mapRuleViolations(violations: any[] | undefined): RuleViolation[] | undefined {
        if (!violations || violations.length === 0) {
            return undefined;
        }
        return violations.map(v => ({
            rule: v.rule?.toString() || String(v.rule),
            message: v.message || '',
            title: v.title
        }));
    }

    private calculateFeatureStatus(feature: Feature): SpecStatus {
        let hasFailure = false;
        let hasPending = false;

        for (const scenario of feature.scenarios) {
            // Check if it's a ScenarioOutline (has examples array) vs regular Scenario
            const outline = scenario as ScenarioOutline;
            const status = outline.examples && outline.examples.length > 0
                ? this.calculateOutlineStatus(outline)
                : this.calculateScenarioStatus(scenario as Scenario);
            if (status === SpecStatus.fail) hasFailure = true;
            if (status === SpecStatus.pending) hasPending = true;
        }

        if (hasFailure) return SpecStatus.fail;
        if (hasPending) return SpecStatus.pending;
        return SpecStatus.pass;
    }

    private calculateScenarioStatus(scenario: Scenario | ScenarioExample): SpecStatus {
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

    private calculateOutlineStatus(outline: ScenarioOutline): SpecStatus {
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

    private calculateOverallStatus(_results: ExecutionResults): TestStatus {
        // The run status indicates whether the run completed, not the test results.
        // Individual test statuses (passed/failed/pending) are tracked separately.
        return 'completed';
    }

    private calculateSummary(results: ExecutionResults): Statistics {
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
                    const outline = scenario as ScenarioOutline;
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
                    duration += (scenario as Scenario).executionTime || 0;
                    const status = this.calculateScenarioStatus(scenario as Scenario);
                    if (status === SpecStatus.pass) passed++;
                    else if (status === SpecStatus.fail) failed++;
                    else if (status === SpecStatus.pending) pending++;
                }
            }
        }

        return {
            total,
            passed,
            failed,
            pending,
            skipped,
            duration
        };
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 10);
    }
}
