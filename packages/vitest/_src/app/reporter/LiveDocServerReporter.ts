import type { Reporter } from 'vitest/reporters';
import type { Task } from '@vitest/runner';
import type { Vitest } from 'vitest/node';
import { discoverServer } from '@livedoc/server';
import type { Feature, Scenario, Step, StepType, TestRun, TestStatus, Statistics } from '@livedoc/server';

type SuiteTask = Task & { type: 'suite'; tasks?: Task[] };

function isSuiteTask(task: Task): task is SuiteTask {
    return task.type === 'suite' && typeof (task as any) === 'object';
}

function getSuiteChildren(task: Task): Task[] {
    if (!isSuiteTask(task)) return [];
    const children = (task as any).tasks;
    return Array.isArray(children) ? (children as Task[]) : [];
}

export default class LiveDocServerReporter implements Reporter {
    private serverUrl: string | null = null;
    private isAvailable = false;
    private project = "Unknown Project";
    private environment = "local";

    constructor() {
        console.log("[LiveDoc] Reporter constructor called");
    }

    async onInit(ctx: Vitest) {
        console.log("[LiveDoc] onInit called");
        this.project = ctx.config.name || "LiveDoc Project";
        
        // Try to discover server
        const serverInfo = await discoverServer();
        if (serverInfo) {
            this.serverUrl = serverInfo.url;
            this.isAvailable = true;
            console.log(`[LiveDoc] Connected to server at ${this.serverUrl}`);
        } else {
            console.log(`[LiveDoc] Server not found. Reporter disabled.`);
        }
    }

    async onTestRunEnd(files: any) {
        console.log(`[LiveDoc] onTestRunEnd called with ${files?.length} files`);
        if (!this.isAvailable || !this.serverUrl) return;

        // Interim mitigation: send a complete run in batch mode.
        // This avoids partial/inconsistent runs and ensures ScenarioOutline template steps are present.
        try {
            const timestamp = new Date().toISOString();
            const run = this.buildCompleteRun(files, timestamp);

            console.log(`[LiveDoc] Posting complete run to ${this.serverUrl}/api/runs`);
            const res = await fetch(`${this.serverUrl}/api/runs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(run)
            });

            if (!res.ok) {
                console.error(`[LiveDoc] Failed to post complete run. Status: ${res.status} ${res.statusText}`);
                return;
            }

            const data = await res.json().catch(() => null) as { runId?: string } | null;
            console.log(`[LiveDoc] Run posted${data?.runId ? ` with ID: ${data.runId}` : ''}`);
        } catch (e) {
            console.error(`[LiveDoc] Failed to post complete run:`, e);
            this.isAvailable = false;
        }
    }

    private buildCompleteRun(testModules: any[], timestamp: string): Omit<TestRun, 'runId'> {
        const features: Feature[] = [];

        for (const module of testModules || []) {
            const file = module?.task || module;
            const tasks: Task[] = (file?.tasks || []) as Task[];
            for (const task of tasks) {
                if (task?.type === 'suite') {
                    this.collectFeatures(task, features);
                }
            }
        }

        // Derive summary
        const summary = this.summarizeRun(features);
        const status: TestStatus = summary.failed > 0 ? 'failed' : 'passed';

        return {
            version: '1.0',
            project: this.project,
            environment: this.environment,
            framework: 'vitest',
            timestamp,
            duration: summary.duration,
            status,
            summary,
            features,
            suites: []
        };
    }

    private collectFeatures(task: Task, out: Feature[]) {
        if (task.type !== 'suite') return;

        if (task.name?.startsWith('Feature:')) {
            out.push(this.buildFeature(task));
            return;
        }

        for (const child of getSuiteChildren(task)) {
            if (child.type === 'suite') {
                this.collectFeatures(child, out);
            }
        }
    }

    private buildFeature(featureSuite: Task): Feature {
        const title = featureSuite.name.replace('Feature:', '').trim();
        const filename = featureSuite.file?.name || '';

        const scenarios: Scenario[] = [];
        let background: Scenario | undefined;

        for (const child of getSuiteChildren(featureSuite)) {
            if (child.type !== 'suite') continue;

            if (this.isBackgroundSuite(child)) {
                background = this.buildScenarioFromSuite(child, { typeOverride: 'Background' });
                continue;
            }

            if (this.isScenarioSuite(child)) {
                const { outline, examples } = this.tryBuildScenarioOutline(child);
                if (outline) {
                    scenarios.push(outline);
                    scenarios.push(...examples);
                } else {
                    scenarios.push(this.buildScenarioFromSuite(child));
                }
                continue;
            }

            // Some runners may wrap scenarios in extra describe levels.
            // Recurse to find nested scenarios/backgrounds.
            const nested = this.findScenarioSuites(child);
            for (const suite of nested) {
                if (this.isBackgroundSuite(suite)) {
                    background = this.buildScenarioFromSuite(suite, { typeOverride: 'Background' });
                } else {
                    const { outline, examples } = this.tryBuildScenarioOutline(suite);
                    if (outline) {
                        scenarios.push(outline);
                        scenarios.push(...examples);
                    } else {
                        scenarios.push(this.buildScenarioFromSuite(suite));
                    }
                }
            }
        }

        const statistics = this.summarizeScenarios(scenarios);
        const status: TestStatus = statistics.failed > 0 ? 'failed' : statistics.passed > 0 ? 'passed' : 'pending';

        return {
            id: featureSuite.id,
            title,
            filename,
            tags: undefined,
            status,
            duration: statistics.duration,
            background,
            scenarios,
            ruleViolations: undefined,
            statistics,
        };
    }

    private findScenarioSuites(task: Task): Task[] {
        const found: Task[] = [];
        if (task.type !== 'suite') return found;

        for (const child of getSuiteChildren(task)) {
            if (child.type !== 'suite') continue;
            if (this.isScenarioSuite(child) || this.isBackgroundSuite(child)) {
                found.push(child);
            } else {
                found.push(...this.findScenarioSuites(child));
            }
        }
        return found;
    }

    private isScenarioSuite(task: Task): boolean {
        return task.type === 'suite' && /^Scenario( Outline)?:/.test(task.name || '');
    }

    private isBackgroundSuite(task: Task): boolean {
        if (task.type !== 'suite') return false;
        const n = task.name || '';
        return n === 'Background' || n.startsWith('Background:');
    }

    private tryBuildScenarioOutline(outlineSuite: Task): { outline: Scenario | null; examples: Scenario[] } {
        // Outline suites typically contain child suites (examples). Some implementations also attach template-step tests directly.
        const suiteChildren = getSuiteChildren(outlineSuite).filter((t: Task) => t.type === 'suite') as Task[];
        if (suiteChildren.length === 0) {
            return { outline: null, examples: [] };
        }

        const outlineTitle = outlineSuite.name.replace(/^Scenario( Outline)?:/, '').trim();

        // Build examples
        const examples: Scenario[] = [];
        for (const child of suiteChildren) {
            const example = this.buildExampleScenario(child, outlineSuite.id);
            if (example) examples.push(example);
        }

        // Template steps: prefer tests directly under the outline suite.
        const directTemplateSteps = this.extractStepsFromTasks(getSuiteChildren(outlineSuite).filter((t: Task) => t.type === 'test') as Task[]);

        // Fallback: derive template steps from first example by substituting example values back to <key> placeholders.
        const templateSteps = directTemplateSteps.length > 0
            ? directTemplateSteps
            : this.deriveTemplateStepsFromExample(examples[0]);

        const statistics = this.summarizeScenarioExamples(examples);
        const status: TestStatus = statistics.failed > 0 ? 'failed' : statistics.passed > 0 ? 'passed' : 'pending';

        const outline: Scenario = {
            id: outlineSuite.id,
            type: 'ScenarioOutline',
            title: outlineTitle,
            status,
            duration: statistics.duration,
            steps: templateSteps,
        };

        return { outline, examples };
    }

    private buildExampleScenario(exampleSuite: Task, outlineId: string): Scenario | null {
        if (exampleSuite.type !== 'suite') return null;

        const parsed = this.parseExampleTitle(exampleSuite.name || '');
        const steps = this.extractStepsFromTasks(getSuiteChildren(exampleSuite).filter((t: Task) => t.type === 'test') as Task[]);
        const duration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
        const stats = this.summarizeSteps(steps);
        const status: TestStatus = stats.failed > 0 ? 'failed' : stats.passed > 0 ? 'passed' : 'pending';

        return {
            id: exampleSuite.id,
            type: 'Scenario',
            title: exampleSuite.name,
            status,
            duration,
            steps,
            outlineId,
            exampleIndex: parsed?.index,
            exampleValues: parsed?.values,
        };
    }

    private parseExampleTitle(name: string): { index?: number; values?: Record<string, string> } | null {
        // Common format: "Example N: key1=val1, key2=val2"
        const match = name.match(/^Example\s+(\d+):\s*(.*)$/i);
        if (!match) return null;

        const index = Number.parseInt(match[1], 10);
        const valuesStr = match[2];
        const values: Record<string, string> = {};

        if (valuesStr) {
            for (const pair of valuesStr.split(', ')) {
                const [key, ...valParts] = pair.split('=');
                if (!key || valParts.length === 0) continue;
                values[key.trim()] = valParts.join('=').trim();
            }
        }

        return { index: Number.isFinite(index) ? index : undefined, values };
    }

    private buildScenarioFromSuite(suite: Task, options?: { typeOverride?: Scenario['type'] }): Scenario {
        const type: Scenario['type'] = options?.typeOverride || 'Scenario';
        const title = type === 'Background'
            ? suite.name.replace(/^Background:/, '').trim() || 'Background'
            : suite.name.replace(/^Scenario( Outline)?:/, '').trim();

        const steps = this.extractStepsFromTasks(getSuiteChildren(suite).filter((t: Task) => t.type === 'test') as Task[]);
        const duration = steps.reduce((sum, s) => sum + (s.duration || 0), 0);
        const stats = this.summarizeSteps(steps);
        const status: TestStatus = stats.failed > 0 ? 'failed' : stats.passed > 0 ? 'passed' : 'pending';

        return {
            id: suite.id,
            type,
            title,
            status,
            duration,
            steps,
        };
    }

    private extractStepsFromTasks(tasks: Task[]): Step[] {
        const steps: Step[] = [];
        for (const task of tasks) {
            if (task.type !== 'test') continue;
            const parsed = this.parseStepName(task.name || '');
            steps.push({
                id: task.id,
                type: parsed.type,
                title: parsed.title,
                status: this.mapStatus(task.result?.state),
                duration: task.result?.duration || 0,
            });
        }
        return steps;
    }

    private parseStepName(name: string): { type: StepType; title: string } {
        const match = name.match(/^(given|when|then|and|but)\s+/i);
        const rawKeyword = (match?.[1] || 'given').toLowerCase();

        const type = (rawKeyword === 'and'
            ? 'and'
            : rawKeyword === 'but'
                ? 'but'
                : rawKeyword === 'when'
                    ? 'When'
                    : rawKeyword === 'then'
                        ? 'Then'
                        : 'Given') as StepType;

        const title = name.replace(/^(given|when|then|and|but)\s+/i, '').trim();
        return { type, title };
    }

    private deriveTemplateStepsFromExample(example?: Scenario): Step[] {
        if (!example || !example.steps || example.steps.length === 0) return [];
        const values = (example.exampleValues || {}) as Record<string, string>;
        const entries = Object.entries(values).filter(([, v]) => typeof v === 'string' && v.length > 0);

        return example.steps.map((step) => {
            let title = step.title;
            for (const [key, value] of entries) {
                if (title.includes(value)) {
                    title = title.replaceAll(value, `<${key}>`);
                }
            }
            return { ...step, title, status: 'pending', duration: 0 };
        });
    }

    private summarizeSteps(steps: Step[]): Statistics {
        const stats: Statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, duration: 0 };
        for (const s of steps) {
            stats.total++;
            stats.duration += s.duration || 0;
            switch (s.status) {
                case 'passed': stats.passed++; break;
                case 'failed': stats.failed++; break;
                case 'skipped': stats.skipped++; break;
                default: stats.pending++; break;
            }
        }
        return stats;
    }

    private summarizeScenarioExamples(examples: Scenario[]): Statistics {
        const stats: Statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, duration: 0 };
        for (const ex of examples) {
            stats.total++;
            stats.duration += ex.duration || 0;
            switch (ex.status) {
                case 'passed': stats.passed++; break;
                case 'failed': stats.failed++; break;
                case 'skipped': stats.skipped++; break;
                default: stats.pending++; break;
            }
        }
        return stats;
    }

    private summarizeScenarios(scenarios: Scenario[]): Statistics {
        const stats: Statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, duration: 0 };
        for (const sc of scenarios) {
            // Count outlines + examples + regular scenarios (simple, but matches current viewer expectations)
            stats.total++;
            stats.duration += sc.duration || 0;
            switch (sc.status) {
                case 'passed': stats.passed++; break;
                case 'failed': stats.failed++; break;
                case 'skipped': stats.skipped++; break;
                default: stats.pending++; break;
            }
        }
        return stats;
    }

    private summarizeRun(features: Feature[]): Statistics {
        const stats: Statistics = { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, duration: 0 };
        for (const feature of features) {
            const s = feature.statistics;
            stats.total += s.total;
            stats.passed += s.passed;
            stats.failed += s.failed;
            stats.pending += s.pending;
            stats.skipped += s.skipped;
            stats.duration += s.duration;
        }
        return stats;
    }

    private mapStatus(state?: string): TestStatus {
        switch (state) {
            case 'pass': return 'passed';
            case 'fail': return 'failed';
            case 'skip': return 'skipped';
            case 'run': return 'running';
            default: return 'pending';
        }
    }
}
