import type { Reporter } from 'vitest/reporters';
import type { Task } from '@vitest/runner';
import type { Vitest } from 'vitest/node';
import * as path from 'path';
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
        try {
            const { discoverServer } = await import('@livedoc/server');
            const serverInfo = await discoverServer();
            if (serverInfo) {
                this.serverUrl = serverInfo.url;
                this.isAvailable = true;
                console.log(`[LiveDoc] Connected to server at ${this.serverUrl}`);
            } else {
                console.log(`[LiveDoc] Server not found. Reporter disabled.`);
            }
        } catch (e) {
            // @livedoc/server is not installed. This is expected if the user is not using the server reporter.
            // We only log if they explicitly tried to use this reporter but it's missing.
            this.isAvailable = false;
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

        const moduleFilepaths = (testModules || [])
            .map((m) => {
                const file = m?.task || m;
                return (file as any)?.filepath || (file as any)?.file?.filepath || (file as any)?.file?.name || (file as any)?.name || '';
            })
            .filter(Boolean)
            .map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)))
            .map((p) => p.replace(/\\/g, '/'));

        const rootPath = this.findCommonRootPath(moduleFilepaths);

        for (const module of testModules || []) {
            const file = module?.task || module;
            const tasks: Task[] = (file?.tasks || []) as Task[];
            const rawFilePath = (file as any)?.filepath || (file as any)?.file?.filepath || (file as any)?.file?.name || '';
            const absFilePath = rawFilePath ? (path.isAbsolute(rawFilePath) ? rawFilePath : path.resolve(process.cwd(), rawFilePath)) : '';
            const fileInfo = this.buildFileInfo(absFilePath, rootPath);
            for (const task of tasks) {
                if (task?.type !== 'suite') continue;

                // Top-level: Feature, Specification, or regular suite
                if (task.name?.startsWith('Feature:')) {
                    features.push(this.buildFeature(task, fileInfo));
                } else if (task.name?.startsWith('Specification:')) {
                    const specFeature = this.buildSpecificationAsFeature(task, fileInfo);
                    if (specFeature) features.push(specFeature);
                } else {
                    const suiteFeature = this.buildSuiteAsFeature(task, fileInfo);
                    if (suiteFeature) features.push(suiteFeature);

                    // Also collect nested features/specifications inside wrappers
                    for (const child of getSuiteChildren(task)) {
                        if (child.type === 'suite') {
                            if (child.name?.startsWith('Feature:')) {
                                features.push(this.buildFeature(child, fileInfo));
                            } else if (child.name?.startsWith('Specification:')) {
                                const nestedSpec = this.buildSpecificationAsFeature(child, fileInfo);
                                if (nestedSpec) features.push(nestedSpec);
                            }
                        }
                    }
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

    private buildFileInfo(absFilename: string, rootPath: string): { filename: string; path: string } {
        const normalized = (absFilename || '').replace(/\\/g, '/');
        const root = (rootPath || '').replace(/\\/g, '/').replace(/\/+$/g, '');

        if (!normalized) return { filename: '', path: '' };

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

    private buildSpecificationAsFeature(specSuite: Task, fileInfo: { filename: string; path: string }): Feature | null {
        if (specSuite.type !== 'suite') return null;

        const title = specSuite.name.replace(/^Specification:\s*/, '').trim();

        const scenarios: Scenario[] = [];
        let sequence = 0;

        // Rules can be tests (simple) or suites (outline)
        for (const child of getSuiteChildren(specSuite)) {
            if (child.type === 'test' && child.name?.startsWith('Rule:')) {
                scenarios.push(this.buildRuleScenarioFromTest(child, sequence++));
            } else if (child.type === 'suite' && (child.name?.startsWith('Rule Outline:') || child.name?.startsWith('Rule:'))) {
                const { outline, examples } = this.tryBuildRuleOutline(child, sequence++);
                if (outline) {
                    scenarios.push(outline);
                    scenarios.push(...examples);
                    sequence += examples.length;
                }
            }
        }

        // Skip empty spec containers
        if (scenarios.length === 0) return null;

        const statistics = this.summarizeScenarios(scenarios);
        const status: TestStatus = statistics.failed > 0 ? 'failed' : statistics.passed > 0 ? 'passed' : 'pending';

        return {
            id: specSuite.id,
            title: `Specification: ${title}`,
            filename: fileInfo.filename,
            path: fileInfo.path,
            tags: undefined,
            status,
            duration: statistics.duration,
            background: undefined,
            scenarios,
            ruleViolations: undefined,
            statistics,
        };
    }

    private tryBuildRuleOutline(ruleSuite: Task, outlineSequence: number): { outline: Scenario | null; examples: Scenario[] } {
        if (ruleSuite.type !== 'suite') return { outline: null, examples: [] };

        const exampleTests = getSuiteChildren(ruleSuite).filter((t: Task) => {
            if (t.type !== 'test') return false;
            const meta: any = (t as any).meta?.livedoc;
            return meta?.kind === 'ruleExample';
        }) as Task[];
        if (exampleTests.length === 0) return { outline: null, examples: [] };

        const suiteName = String(ruleSuite.name || '');
        const outlineTitle = suiteName.replace(/^Rule\s+Outline:\s*/i, '').replace(/^Rule:\s*/i, '').trim();
        const examples: Scenario[] = [];

        const firstMeta: any = (exampleTests[0] as any)?.meta?.livedoc?.ruleOutline;
        const outlineDescription = typeof firstMeta?.description === 'string' ? firstMeta.description : undefined;
        const outlineTags = Array.isArray(firstMeta?.tags) ? firstMeta.tags : undefined;

        for (let i = 0; i < exampleTests.length; i++) {
            const t = exampleTests[i];
            examples.push(this.buildRuleExampleScenarioFromTest(t, ruleSuite.id, outlineSequence + 1 + i));
        }

        const stats = this.summarizeScenarioExamples(examples);
        const status: TestStatus = stats.failed > 0 ? 'failed' : stats.passed > 0 ? 'passed' : 'pending';

        const outline: Scenario = {
            id: ruleSuite.id,
            type: 'ScenarioOutline',
            title: `Rule Outline: ${outlineTitle}`,
            description: outlineDescription,
            tags: outlineTags,
            status,
            duration: stats.duration,
            steps: [{
                id: ruleSuite.id,
                type: 'Then',
                title: outlineTitle,
                status: 'pending',
                duration: 0,
            }],
            sequence: outlineSequence,
        };

        return { outline, examples };
    }

    private buildRuleScenarioFromTest(task: Task, sequence: number): Scenario {
        const ruleTitle = (task.name || '').replace(/^(Rule|Example\s+\d+):\s*/i, '').trim();
        const step: Step = {
            id: task.id,
            type: 'Then',
            title: ruleTitle || task.name || 'Rule',
            status: this.mapStatus(task.result?.state),
            duration: task.result?.duration || 0,
        };
        const stats = this.summarizeSteps([step]);
        const status: TestStatus = stats.failed > 0 ? 'failed' : stats.passed > 0 ? 'passed' : 'pending';
        return {
            id: task.id,
            type: 'Scenario',
            title: `Rule: ${ruleTitle || task.name || ''}`.trim(),
            status,
            duration: step.duration,
            steps: [step],
            sequence,
        };
    }

    private buildRuleExampleScenarioFromTest(task: Task, outlineId: string, sequence: number): Scenario {
        const meta: any = (task as any).meta?.livedoc;
        const exampleIndex = Number(meta?.ruleOutline?.example?.sequence);
        const exampleValues = meta?.ruleOutline?.example?.values;
        const exampleValuesRaw = meta?.ruleOutline?.example?.valuesRaw;

        const toStringRecord = (obj: unknown): Record<string, string> | undefined => {
            if (!obj || typeof obj !== 'object') return undefined;
            return Object.fromEntries(
                Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, v === undefined || v === null ? '' : String(v)])
            );
        };

        const rawTitle = String(task.name || 'Rule');
        const ruleTitle = rawTitle.replace(/^(Rule|Example\s+\d+):\s*/i, '').trim();

        const step: Step = {
            id: task.id,
            type: 'Then',
            title: ruleTitle || rawTitle,
            status: this.mapStatus(task.result?.state),
            duration: task.result?.duration || 0,
        };
        const stats = this.summarizeSteps([step]);
        const status: TestStatus = stats.failed > 0 ? 'failed' : stats.passed > 0 ? 'passed' : 'pending';
        return {
            id: task.id,
            type: 'Scenario',
            title: (Number.isFinite(exampleIndex) ? `Example ${exampleIndex}: ${ruleTitle}` : `Rule: ${ruleTitle || rawTitle}`).trim(),
            status,
            duration: step.duration,
            steps: [step],
            outlineId,
            exampleIndex: Number.isFinite(exampleIndex) ? exampleIndex : undefined,
            // Viewer/VS Code renderers expect string values for substitution/highlighting
            exampleValues: toStringRecord(exampleValuesRaw ?? exampleValues),
            exampleValuesRaw: toStringRecord(exampleValuesRaw),
            sequence,
        };
    }

    private buildSuiteAsFeature(suite: Task, fileInfo: { filename: string; path: string }): Feature | null {
        if (suite.type !== 'suite') return null;

        // Avoid wrapping livedoc feature/spec containers
        if (suite.name?.startsWith('Feature:') || suite.name?.startsWith('Specification:')) return null;

        const scenarios: Scenario[] = [];
        let sequence = 0;

        const collect = (s: Task, prefix: string) => {
            if (s.type !== 'suite') return;
            const nextPrefix = prefix ? `${prefix} > ${s.name || ''}` : (s.name || '');

            // Ignore nested livedoc containers; they are handled separately
            if (s.name?.startsWith('Feature:') || s.name?.startsWith('Specification:')) return;

            for (const child of getSuiteChildren(s)) {
                if (child.type === 'test') {
                    const step: Step = {
                        id: child.id,
                        type: 'Then',
                        title: child.name || 'test',
                        status: this.mapStatus(child.result?.state),
                        duration: child.result?.duration || 0,
                    };
                    const stats = this.summarizeSteps([step]);
                    const status: TestStatus = stats.failed > 0 ? 'failed' : stats.passed > 0 ? 'passed' : 'pending';
                    scenarios.push({
                        id: child.id,
                        type: 'Scenario',
                        title: nextPrefix ? `${nextPrefix}: ${child.name || ''}`.trim() : (child.name || 'test'),
                        status,
                        duration: step.duration,
                        steps: [step],
                        sequence: sequence++,
                    });
                } else if (child.type === 'suite') {
                    collect(child, nextPrefix);
                }
            }
        };

        collect(suite, '');

        if (scenarios.length === 0) return null;

        const statistics = this.summarizeScenarios(scenarios);
        const status: TestStatus = statistics.failed > 0 ? 'failed' : statistics.passed > 0 ? 'passed' : 'pending';

        return {
            id: suite.id,
            title: `Suite: ${suite.name || 'Suite'}`,
            filename: fileInfo.filename,
            path: fileInfo.path,
            tags: undefined,
            status,
            duration: statistics.duration,
            background: undefined,
            scenarios,
            ruleViolations: undefined,
            statistics,
        };
    }

    private buildFeature(featureSuite: Task, fileInfo: { filename: string; path: string }): Feature {
        const title = featureSuite.name.replace('Feature:', '').trim();

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
            filename: fileInfo.filename,
            path: fileInfo.path,
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
