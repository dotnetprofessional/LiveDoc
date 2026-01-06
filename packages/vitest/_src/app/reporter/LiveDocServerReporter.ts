import type { Reporter } from 'vitest/reporters';
import type { Vitest } from 'vitest/node';
import { LiveDocViewerReporter } from './LiveDocViewerReporter';
import * as model from '../model/index';
import { SpecStatus } from '../model/SpecStatus';
import { Exception } from '../model/Exception';
import { DescriptionParser } from '../parser/Parser';
import type { File, Task, TaskResultPack } from '@vitest/runner';
import * as path from 'path';
import { generateStabilityId, type Node, type Status } from '@livedoc/schema';
import { livedoc } from '../livedoc';

/**
 * Vitest Reporter that automatically discovers a LiveDoc server and posts results.
 * This is a convenience wrapper around LiveDocViewerReporter.
 */
export default class LiveDocServerReporter implements Reporter {
    private serverUrl: string | null = null;
    private isAvailable = false;
    private project = "default";
    private environment = "local";

    private viewerReporter: LiveDocViewerReporter | null = null;
    private streamingEnabled = true;
    private runId: string | null = null;

    private taskToNodeId = new Map<string, string>();
    private nodeChildren = new Map<string, Set<string>>();
    private nodeParent = new Map<string, string>();
    private nodeStatus = new Map<string, Status>();
    private taskById = new Map<string, Task>();

    private rootPath = '';

    constructor() {
    }

    async onInit(ctx: Vitest) {
        this.project = ctx.config.name || "default";
        this.environment = (ctx.config as any).mode || this.environment;

        // Allow opting out if streaming causes issues.
        // Default: enabled (matches the "live" intent of the viewer).
        const env = process.env.LIVEDOC_VIEWER_STREAMING;
        if (env !== undefined) {
            this.streamingEnabled = !(env === '0' || env.toLowerCase() === 'false');
        }
        
        // Prefer explicit publish server if configured (keeps server+viewer in sync).
        if (livedoc.options.publish.enabled && livedoc.options.publish.server) {
            this.serverUrl = livedoc.options.publish.server;
            this.isAvailable = true;

            this.viewerReporter = new LiveDocViewerReporter({
                server: this.serverUrl,
                project: this.project,
                environment: this.environment,
                silent: true
            });
            return;
        }

        // Otherwise, try to discover server
        try {
            // Use dynamic import to avoid circular dependencies or issues if @livedoc/server is not available
            // @ts-ignore
            const { discoverServer } = await import('@livedoc/server');
            const serverInfo = await discoverServer();
            if (serverInfo) {
                this.serverUrl = serverInfo.url;
                this.isAvailable = true;

                this.viewerReporter = new LiveDocViewerReporter({
                    server: this.serverUrl,
                    project: this.project,
                    environment: this.environment,
                    silent: true
                });
            }
        } catch (e) {
            this.isAvailable = false;
        }
    }

    async onCollected(files?: File[]): Promise<void> {
        if (!this.streamingEnabled) return;
        if (!this.isAvailable || !this.serverUrl || !this.viewerReporter) return;
        if (this.runId) return;
        if (!files || files.length === 0) return;

        try {
            this.rootPath = this.findCommonRootPath(
                files
                    .map((f) => (f as any).filepath as string)
                    .filter(Boolean)
                    .map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)))
                    .map((p) => p.replace(/\\/g, '/'))
            );

            const runId = await this.viewerReporter.startRunSession();
            if (!runId) return;
            this.runId = runId;

            // Post initial node tree in pending state.
            for (const file of files) {
                const filepath = ((file as any).filepath || '') as string;
                for (const t of (file.tasks || [])) {
                    this.indexTaskTree(t);
                }
                for (const t of (file.tasks || [])) {
                    await this.postInitialNodesForTask(runId, t, filepath);
                }
            }
        } catch {
            // silent
        }
    }

    onTaskUpdate(packs: TaskResultPack[]): void {
        if (!this.streamingEnabled) return;
        if (!this.isAvailable || !this.viewerReporter || !this.runId) return;

        for (const pack of packs || []) {
            const normalized = this.normalizeTaskResultPack(pack);
            if (!normalized) continue;

            const nodeId = this.taskToNodeId.get(normalized.taskId);
            if (!nodeId) continue;

            const result = normalized.result;
            if (!result) continue;

            const status = this.mapStateToViewerStatus(result.state);
            const duration = typeof result.duration === 'number' ? result.duration : undefined;
            const error = this.mapResultError(result);

            const patch: any = { status };
            if (duration !== undefined) patch.duration = duration;
            if (error) patch.error = error;

            void this.viewerReporter.patchNodeExecution(this.runId, nodeId, patch);

            this.nodeStatus.set(nodeId, status);
            this.propagateRollup(nodeId);
        }
    }

    private normalizeTaskResultPack(pack: unknown): { taskId: string; result: any } | null {
        // Vitest's TaskResultPack shape is a tuple: [id, result, meta]
        // but keep object fallback for resilience.
        if (Array.isArray(pack)) {
            const taskId = typeof pack[0] === 'string' ? pack[0] : undefined;
            const result = pack.length >= 2 ? (pack as any)[1] : undefined;
            if (!taskId) return null;
            return { taskId, result };
        }

        const obj = pack as any;
        const taskId = (obj?.id ?? obj?.taskId) as string | undefined;
        if (!taskId) return null;
        return { taskId, result: obj?.result };
    }

    private getTaskChildren(task: unknown): Task[] {
        const anyTask = task as any;
        return Array.isArray(anyTask?.tasks) ? (anyTask.tasks as Task[]) : [];
    }

    async onTestRunEnd(testModules: readonly any[]): Promise<void> {
        if (!this.isAvailable || !this.serverUrl) return;

        try {
            // Build the SDK model from Vitest tasks
            const results = this.buildExecutionResults(testModules);

            // If streaming already started a run, finish it; otherwise fall back to batch.
            if (this.viewerReporter && this.runId) {
                await this.viewerReporter.postResultsToRun(this.runId, results);
                await this.viewerReporter.completeRunFromResults(this.runId, results);
            } else {
                const viewerReporter = new LiveDocViewerReporter({
                    server: this.serverUrl,
                    project: this.project,
                    environment: this.environment,
                    silent: true
                });

                await viewerReporter.execute(results);
            }
        } catch (e: any) {
            process.stdout.write(`[LiveDoc] Failed to post results: ${e.message}\n`);
        }
    }

    private indexTaskTree(task: Task): void {
        const id = (task as any).id as string | undefined;
        if (id) this.taskById.set(id, task);
        for (const child of this.getTaskChildren(task)) this.indexTaskTree(child);
    }

    private async postInitialNodesForTask(runId: string, task: Task, filepath: string, parentNodeId?: string): Promise<void> {
        if (!this.viewerReporter) return;
        if (task.type !== 'suite' && task.type !== 'test') return;

        // Root-level mapping based on title prefixes.
        const name = String((task as any).name || '');

        if (task.type === 'suite') {
            if (name.startsWith('Feature:')) {
                const parsed = this.parseTitleBlock(name.replace('Feature:', '').trim());
                const fileInfo = this.buildFileInfo(filepath, this.rootPath);
                const nodeId = generateStabilityId({
                    project: this.project,
                    path: fileInfo.filename,
                    title: parsed.title,
                    kind: 'Feature'
                });

                const node: Node = {
                    id: nodeId,
                    kind: 'Feature',
                    path: fileInfo.filename || undefined,
                    title: parsed.title,
                    description: parsed.description,
                    tags: parsed.tags,
                    execution: { status: 'pending', duration: 0 },
                    summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                    children: []
                } as any;

                await this.viewerReporter.postNodeToRun(runId, undefined, node);
                this.taskToNodeId.set((task as any).id, nodeId);
                this.nodeStatus.set(nodeId, 'pending');

                for (const child of this.getTaskChildren(task)) {
                    await this.postInitialNodesForTask(runId, child, filepath, nodeId);
                }
                return;
            }

            if (name.startsWith('Specification:')) {
                const parsed = this.parseTitleBlock(name.replace('Specification:', '').trim());
                const fileInfo = this.buildFileInfo(filepath, this.rootPath);
                const nodeId = generateStabilityId({
                    project: this.project,
                    path: fileInfo.filename,
                    title: parsed.title,
                    kind: 'Specification'
                });

                const node: Node = {
                    id: nodeId,
                    kind: 'Specification',
                    path: fileInfo.filename || undefined,
                    title: parsed.title,
                    description: parsed.description,
                    tags: parsed.tags,
                    execution: { status: 'pending', duration: 0 },
                    summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                    children: []
                } as any;

                await this.viewerReporter.postNodeToRun(runId, undefined, node);
                this.taskToNodeId.set((task as any).id, nodeId);
                this.nodeStatus.set(nodeId, 'pending');

                for (const child of this.getTaskChildren(task)) {
                    await this.postInitialNodesForTask(runId, child, filepath, nodeId);
                }
                return;
            }

            // Scenario / Scenario Outline / Background inside a Feature
            if (parentNodeId) {
                if (name.startsWith('Scenario:') || name.startsWith('Background')) {
                    const parsed = this.parseTitleBlock(name.replace('Scenario:', '').replace('Background:', '').trim());
                    const nodeId = generateStabilityId({ project: this.project, title: parsed.title, kind: 'Scenario', parentId: parentNodeId });
                    const node: Node = {
                        id: nodeId,
                        kind: 'Scenario',
                        title: parsed.title,
                        description: parsed.description,
                        tags: parsed.tags,
                        execution: { status: 'pending', duration: 0 },
                        summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                        children: []
                    } as any;

                    await this.viewerReporter.postNodeToRun(runId, parentNodeId, node);
                    this.recordChild(parentNodeId, nodeId);
                    this.taskToNodeId.set((task as any).id, nodeId);
                    this.nodeStatus.set(nodeId, 'pending');

                    let stepIndex = 0;
                    for (const child of this.getTaskChildren(task)) {
                        if (child.type === 'test') {
                            await this.postStepNode(runId, child, nodeId, stepIndex++);
                        }
                    }
                    return;
                }

                if (name.startsWith('Scenario Outline:')) {
                    // For streaming, represent outline as a container; children example suites will be mapped to Scenario nodes.
                    const parsed = this.parseTitleBlock(name.replace('Scenario Outline:', '').trim());
                    const outlineId = generateStabilityId({ project: this.project, title: parsed.title, kind: 'ScenarioOutline', parentId: parentNodeId });
                    const outline: any = {
                        id: outlineId,
                        kind: 'ScenarioOutline',
                        title: parsed.title,
                        description: parsed.description,
                        tags: parsed.tags,
                        execution: { status: 'pending', duration: 0 },
                        summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                        template: {
                            id: `${outlineId}:template`,
                            kind: 'Scenario',
                            title: parsed.title,
                            execution: { status: 'pending', duration: 0 },
                            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                            children: []
                        },
                        examples: [],
                        tables: []
                    };

                    await this.viewerReporter.postNodeToRun(runId, parentNodeId, outline);
                    this.recordChild(parentNodeId, outlineId);
                    this.taskToNodeId.set((task as any).id, outlineId);
                    this.nodeStatus.set(outlineId, 'pending');

                    const exampleSuites = this.getTaskChildren(task).filter((t: any) => t.type === 'suite') as Task[];
                    for (let i = 0; i < exampleSuites.length; i++) {
                        const exampleSuite = exampleSuites[i];
                        const exampleId = generateStabilityId({ project: this.project, title: parsed.title, kind: 'Scenario', parentId: outlineId, index: i });
                        const exampleNode: any = {
                            id: exampleId,
                            kind: 'Scenario',
                            title: parsed.title,
                            execution: { status: 'pending', duration: 0 },
                            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                            children: []
                        };

                        await this.viewerReporter.postNodeToRun(runId, outlineId, exampleNode);
                        this.recordChild(outlineId, exampleId);
                        this.taskToNodeId.set((exampleSuite as any).id, exampleId);
                        this.nodeStatus.set(exampleId, 'pending');

                        let stepIndex = 0;
                        for (const child of this.getTaskChildren(exampleSuite)) {
                            if (child.type === 'test') {
                                await this.postStepNode(runId, child, exampleId, stepIndex++);
                            }
                        }
                    }
                    return;
                }
            }

            // Generic Suite root
            if (!parentNodeId) {
                const fileInfo = this.buildFileInfo(filepath, this.rootPath);
                const suiteId = generateStabilityId({ project: this.project, path: fileInfo.filename, title: name, kind: 'Suite' });
                const suite: any = {
                    id: suiteId,
                    kind: 'Suite',
                    path: fileInfo.filename || undefined,
                    title: name,
                    execution: { status: 'pending', duration: 0 },
                    summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                    children: []
                };

                await this.viewerReporter.postNodeToRun(runId, undefined, suite);
                this.taskToNodeId.set((task as any).id, suiteId);
                this.nodeStatus.set(suiteId, 'pending');
                for (const child of this.getTaskChildren(task)) {
                    await this.postInitialNodesForTask(runId, child, filepath, suiteId);
                }
                return;
            }

            // Nested suites under generic suites -> treat as Suite as well (without path).
            if (parentNodeId) {
                const nestedSuiteId = generateStabilityId({ project: this.project, title: name, kind: 'Suite', parentId: parentNodeId });
                const nested: any = {
                    id: nestedSuiteId,
                    kind: 'Suite',
                    title: name,
                    execution: { status: 'pending', duration: 0 },
                    summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                    children: []
                };

                await this.viewerReporter.postNodeToRun(runId, parentNodeId, nested);
                this.recordChild(parentNodeId, nestedSuiteId);
                this.taskToNodeId.set((task as any).id, nestedSuiteId);
                this.nodeStatus.set(nestedSuiteId, 'pending');
                for (const child of this.getTaskChildren(task)) {
                    await this.postInitialNodesForTask(runId, child, filepath, nestedSuiteId);
                }
                return;
            }
        }

        if (task.type === 'test' && parentNodeId) {
            // Generic Test under a Suite
            const testId = generateStabilityId({ project: this.project, title: name, kind: 'Test', parentId: parentNodeId });
            const node: any = {
                id: testId,
                kind: 'Test',
                title: name,
                execution: { status: 'pending', duration: 0 }
            };

            await this.viewerReporter.postNodeToRun(runId, parentNodeId, node);
            this.recordChild(parentNodeId, testId);
            this.taskToNodeId.set((task as any).id, testId);
            this.nodeStatus.set(testId, 'pending');
            return;
        }
    }

    private async postStepNode(runId: string, task: Task, scenarioId: string, index: number): Promise<void> {
        if (!this.viewerReporter) return;
        const name = String((task as any).name || '');
        const { keyword, title } = this.parseStepTitle(name);
        const stepId = generateStabilityId({
            project: this.project,
            title,
            kind: 'Step',
            parentId: scenarioId,
            keyword,
            index
        });

        const node: any = {
            id: stepId,
            kind: 'Step',
            title,
            keyword: keyword as any,
            execution: { status: 'pending', duration: 0 }
        };

        await this.viewerReporter.postNodeToRun(runId, scenarioId, node);
        this.recordChild(scenarioId, stepId);
        this.taskToNodeId.set((task as any).id, stepId);
        this.nodeStatus.set(stepId, 'pending');
    }

    private recordChild(parentId: string, childId: string): void {
        if (!this.nodeChildren.has(parentId)) this.nodeChildren.set(parentId, new Set());
        this.nodeChildren.get(parentId)!.add(childId);
        this.nodeParent.set(childId, parentId);
    }

    private propagateRollup(fromNodeId: string): void {
        if (!this.viewerReporter || !this.runId) return;

        let current = this.nodeParent.get(fromNodeId);
        while (current) {
            const children = this.nodeChildren.get(current);
            if (!children || children.size === 0) break;

            const statuses = Array.from(children).map((id) => this.nodeStatus.get(id) || 'pending');
            const rolled = this.rollupStatus(statuses);
            const prev = this.nodeStatus.get(current);
            if (prev !== rolled) {
                this.nodeStatus.set(current, rolled);
                void this.viewerReporter.patchNodeExecution(this.runId, current, { status: rolled });
            }
            current = this.nodeParent.get(current);
        }
    }

    private rollupStatus(statuses: Status[]): Status {
        if (statuses.some((s) => s === 'failed')) return 'failed';
        if (statuses.some((s) => s === 'running')) return 'running';
        if (statuses.some((s) => s === 'pending')) return 'running';
        if (statuses.length > 0 && statuses.every((s) => s === 'skipped')) return 'skipped';
        return 'passed';
    }

    private mapStateToViewerStatus(state: string | undefined): Status {
        switch (state) {
            case 'pass':
                return 'passed';
            case 'fail':
                return 'failed';
            case 'run':
                return 'running';
            case 'skip':
            case 'todo':
                return 'skipped';
            case 'pending':
                return 'pending';
            default:
                return 'pending';
        }
    }

    private mapResultError(result: any): { message: string; stack?: string; diff?: string } | undefined {
        if (!result?.errors || !Array.isArray(result.errors) || result.errors.length === 0) return undefined;
        const first = result.errors[0];
        const message = String(first?.message || 'Unknown error');
        const stack = typeof first?.stack === 'string' ? first.stack : undefined;
        return { message, stack };
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


    private buildExecutionResults(testModules: readonly any[]): model.ExecutionResults {
        const features: model.Feature[] = [];
        const specifications: model.Specification[] = [];
        const suites: model.VitestSuite[] = [];

        for (const testModule of testModules) {
            const file = testModule.task || testModule;
            const filepath = (file as any).filepath || "";

            for (const task of (file.tasks || [])) {
                if (task.type === 'suite') {
                    if (task.name.startsWith('Feature:')) {
                        features.push(this.buildFeatureFromTask(task, filepath));
                    } else if (task.name.startsWith('Specification:')) {
                        specifications.push(this.buildSpecificationFromTask(task, filepath));
                    } else {
                        suites.push(this.buildTestSuiteFromTask(task, filepath));
                    }
                }
            }
        }

        const results = new model.ExecutionResults();
        results.features = features;
        results.specifications = specifications;
        results.suites = suites;
        return results;
    }

    private buildFeatureFromTask(task: any, filepath: string): model.Feature {
        const parsed = this.parseTitleBlock(task.name.replace('Feature:', '').trim());
        const feature = new model.Feature();
        feature.title = parsed.title;
        feature.description = parsed.description;
        feature.tags = parsed.tags;
        feature.filename = filepath;

        for (const child of (task.tasks || [])) {
            if (child.type === 'suite') {
                if (child.name.startsWith('Scenario:')) {
                    feature.scenarios.push(this.buildScenarioFromTask(child, feature));
                } else if (child.name.startsWith('Scenario Outline:')) {
                    feature.scenarios.push(this.buildScenarioOutlineFromTask(child, feature));
                } else if (child.name.startsWith('Background')) {
                    feature.background = this.buildScenarioFromTask(child, feature);
                }
            }
        }
        return feature;
    }

    private buildScenarioFromTask(task: any, parent: model.Feature): model.Scenario {
        const parsed = this.parseTitleBlock(task.name.replace('Scenario:', '').replace('Background:', '').trim());
        const scenario = new model.Scenario(parent);
        scenario.title = parsed.title;
        scenario.description = parsed.description;
        scenario.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                scenario.steps.push(this.buildStepFromTask(child, scenario));
            }
        }
        return scenario;
    }

    private buildScenarioOutlineFromTask(task: any, parent: model.Feature): model.ScenarioOutline {
        const parsed = this.parseTitleBlock(task.name.replace('Scenario Outline:', '').trim());
        const outline = new model.ScenarioOutline(parent);
        outline.title = parsed.title;
        outline.description = parsed.description;
        outline.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'suite') {
                // Each child suite is an example
                const example = new model.ScenarioExample(parent, outline);
                example.title = child.name;
                for (const stepTask of (child.tasks || [])) {
                    if (stepTask.type === 'test') {
                        example.steps.push(this.buildStepFromTask(stepTask, example));
                    }
                }
                outline.examples.push(example);
            }
        }
        return outline;
    }

    private buildStepFromTask(task: any, parent: any): model.StepDefinition {
        const { keyword, title } = this.parseStepTitle(task.name);

        const step = new model.StepDefinition(parent, title);
        step.rawTitle = title;
        step.type = keyword;
        
        const state = task.result?.state || 'pending';
        step.status = this.mapStateToStatus(state);
        step.duration = task.result?.duration || 0;

        if (task.result?.errors?.length > 0) {
            const ex = new Exception();
            ex.message = task.result.errors[0].message;
            ex.stackTrace = task.result.errors[0].stack;
            step.exception = ex;
        }

        return step;
    }

    private parseStepTitle(rawTitle: string): { keyword: string; title: string } {
        const text = String(rawTitle || '').trim();

        const match = /^(given|when|then|and|but)\b\s*(.*)$/i.exec(text);
        if (!match) {
            return { keyword: 'and', title: text };
        }

        const keyword = match[1].toLowerCase();
        const title = (match[2] || '').trim();
        return { keyword, title: title || text };
    }

    private buildSpecificationFromTask(task: any, filepath: string): model.Specification {
        const parsed = this.parseTitleBlock(task.name.replace('Specification:', '').trim());
        const spec = new model.Specification();
        spec.title = parsed.title;
        spec.description = parsed.description;
        spec.tags = parsed.tags;
        (spec as any).filename = filepath;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test' && child.name.startsWith('Rule:')) {
                const ruleParsed = this.parseTitleBlock(child.name.replace('Rule:', '').trim());
                const rule = new model.Rule(spec);
                rule.title = ruleParsed.title;
                rule.description = ruleParsed.description;
                rule.tags = ruleParsed.tags;
                rule.status = this.mapStateToStatus(child.result?.state);
                rule.executionTime = child.result?.duration || 0;
                spec.rules.push(rule);
            }
        }
        return spec;
    }

    private parseTitleBlock(text: string): { title: string; description: string; tags: string[] } {
        const parser = new DescriptionParser();
        parser.parseDescription(text || '');
        return {
            title: parser.title || '',
            description: parser.description || '',
            tags: parser.tags || []
        };
    }

    private buildTestSuiteFromTask(task: any, filepath: string): model.VitestSuite {
        const suite = new model.VitestSuite(null, task.name, 'suite');
        suite.filename = filepath;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                const test = new model.LiveDocTest<model.VitestSuite>(suite, child.name);
                test.status = this.mapStateToStatus(child.result?.state);
                test.duration = child.result?.duration || 0;
                suite.tests.push(test);
            } else if (child.type === 'suite') {
                suite.children.push(this.buildTestSuiteFromTask(child, filepath));
            }
        }
        return suite;
    }

    private mapStateToStatus(state: string): SpecStatus {
        switch (state) {
            case 'pass': return SpecStatus.pass;
            case 'fail': return SpecStatus.fail;
            case 'skip':
            case 'todo':
            case 'pending': return SpecStatus.pending;
            default: return SpecStatus.unknown;
        }
    }
}
