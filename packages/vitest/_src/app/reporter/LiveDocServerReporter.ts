import type { Reporter } from 'vitest/reporters';
import type { Vitest } from 'vitest/node';
import { LiveDocViewerReporter } from './LiveDocViewerReporter';
import * as model from '../model/index';
import { SpecStatus } from '../model/SpecStatus';
import { Exception } from '../model/Exception';
import { DescriptionParser } from '../parser/Parser';
import type { File, Task, TaskResultPack } from '@vitest/runner';
import * as path from 'path';
import * as fs from 'fs';
import { generateStabilityId, type Node, type Status, SpecKind, type ExampleTable, type TypedValue } from '@livedoc/schema';
import { livedoc } from '../livedoc';

function debugLog(msg: string, data?: any) {
    const line = `[${new Date().toISOString()}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    fs.appendFileSync('d:/private/LiveDoc/packages/vitest/debug-reporter.log', line);
}

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
        debugLog('Constructor called');
    }

    async onInit(ctx: Vitest) {
        debugLog('onInit called');
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
        debugLog('onCollected called ENTRY', { 
            streaming: this.streamingEnabled, 
            isAvailable: this.isAvailable, 
            serverUrl: this.serverUrl,
            hasViewer: !!this.viewerReporter,
            filesCount: files?.length,
            runId: this.runId
        });
        if (!files || files.length === 0) { debugLog('onCollected: no files'); return; }

        try {
            this.rootPath = this.findCommonRootPath(
                files
                    .map((f) => (f as any).filepath as string)
                    .filter(Boolean)
                    .map((p) => (path.isAbsolute(p) ? p : path.resolve(process.cwd(), p)))
                    .map((p) => p.replace(/\\/g, '/'))
            );

            // Always index the task tree for model building at the end
            for (const file of files) {
                for (const t of (file.tasks || [])) {
                    this.indexTaskTree(t);
                }
            }

            if (!this.streamingEnabled) { debugLog('onCollected: streaming disabled (skipping initial post)'); return; }
            if (!this.isAvailable || !this.serverUrl || !this.viewerReporter) { debugLog('onCollected: not available'); return; }
            if (this.runId) { debugLog('onCollected: already has runId'); return; }

            const runId = await this.viewerReporter.startRunSession();
            if (!runId) return;
            this.runId = runId;

            // Post initial node tree in pending state.
            for (const file of files) {
                const filepath = ((file as any).filepath || '') as string;
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
                    kind: SpecKind.Feature
                });

                const node: Node = {
                    id: nodeId,
                    kind: SpecKind.Feature,
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
                    kind: SpecKind.Specification
                });

                const node: Node = {
                    id: nodeId,
                    kind: SpecKind.Specification,
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

            // Background inside a Feature - attach as background property, not as child
            debugLog('Checking task', { name, parentNodeId, isBackground: name.startsWith('Background') });
            if (parentNodeId && name.startsWith('Background')) {
                debugLog('Processing Background', { parentNodeId });
                const parsed = this.parseTitleBlock(name.replace('Background:', '').trim());
                const nodeId = generateStabilityId({ project: this.project, title: parsed.title, kind: SpecKind.Background, parentId: parentNodeId });
                
                // Build step nodes inline for background
                const stepChildren: any[] = [];
                let stepIndex = 0;
                for (const child of this.getTaskChildren(task)) {
                    if (child.type === 'test') {
                        const stepName = String((child as any).name || '');
                        const { keyword, title: stepTitle } = this.parseStepTitle(stepName);
                        const stepId = generateStabilityId({
                            project: this.project,
                            title: stepTitle,
                            kind: SpecKind.Step,
                            parentId: nodeId,
                            keyword,
                            index: stepIndex++
                        });
                        
                        stepChildren.push({
                            id: stepId,
                            kind: SpecKind.Step,
                            title: stepTitle,
                            keyword: keyword as any,
                            execution: { status: 'pending', duration: 0 }
                        });
                        
                        this.taskToNodeId.set((child as any).id, stepId);
                        this.nodeStatus.set(stepId, 'pending');
                    }
                }
                
                const backgroundNode: any = {
                    id: nodeId,
                    kind: SpecKind.Background,
                    title: parsed.title,
                    description: parsed.description,
                    tags: parsed.tags,
                    execution: { status: 'pending', duration: 0 },
                    summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                    children: stepChildren
                };

                // Post background as a special property of the parent Feature
                await this.viewerReporter.patchNodeBackground(runId, parentNodeId, backgroundNode);
                this.taskToNodeId.set((task as any).id, nodeId);
                this.nodeStatus.set(nodeId, 'pending');
                return;
            }

            // Scenario / Scenario Outline inside a Feature
            if (parentNodeId) {
                const isScenarioPrefix = name.startsWith('Scenario:');
                const isOutlinePrefix = name.startsWith('Scenario Outline:');

                if (isScenarioPrefix || isOutlinePrefix) {
                    const cleanTitle = name.replace(/^Scenario( Outline)?:\s*/i, '').trim();
                    const parsed = this.parseTitleBlock(cleanTitle);

                    const exampleSuites = this.getTaskChildren(task).filter((t: any) =>
                        t.type === 'suite' && typeof t.name === 'string' && t.name.startsWith('Example ')
                    ) as Task[];

                    if (exampleSuites.length > 0) {
                        // It's a Scenario Outline
                        const outlineId = generateStabilityId({ project: this.project, title: parsed.title, kind: SpecKind.ScenarioOutline, parentId: parentNodeId });

                        // Build template steps from direct test tasks (discovery run) or fallback to first example
                        const templateChildren: any[] = [];
                        const directTemplateTasks = this.getTaskChildren(task).filter((t: any) => t.type === 'test');
                        const templateTasksToUse = directTemplateTasks.length > 0 ? directTemplateTasks : this.getTaskChildren(exampleSuites[0]);

                        let stepIdx = 0;
                        for (const stepTask of templateTasksToUse) {
                            if (stepTask.type !== 'test') continue;
                            const meta = this.getLiveDocMetaFromTask(stepTask);
                            const parsedStep = this.parseStepDetails(stepTask);

                            // Construct step node with more rich data (docString, dataTable, values)
                            templateChildren.push({
                                id: `${outlineId}:template:step:${stepIdx}`,
                                kind: SpecKind.Step,
                                title: parsedStep.title,
                                keyword: parsedStep.keyword as any,
                                docString: parsedStep.docString,
                                docStringRaw: parsedStep.docStringRaw,
                                dataTable: this.mapDataTableVNext(parsedStep.dataTable),
                                values: this.mapTypedValues(meta?.step?.values),
                                code: meta?.step?.code,
                                execution: { status: 'pending', duration: 0 },
                            });
                            stepIdx++;
                        }

                        // Prefer the authoritative metadata from livedoc.ts for tables/description/tags if available on first example.
                        const firstStepTask = directTemplateTasks[0] || (this.getTaskChildren(exampleSuites[0] || {}) || []).find((t: any) => t?.type === 'test');
                        const firstMeta = firstStepTask ? this.getLiveDocMetaFromTask(firstStepTask) : undefined;
                        const metaTables = firstMeta?.scenarioOutline?.tables;
                        const tables = (Array.isArray(metaTables) && metaTables.length > 0)
                            ? this.mapScenarioOutlineTables(metaTables, outlineId)
                            : [];

                        const outline: any = {
                            id: outlineId,
                            kind: SpecKind.ScenarioOutline,
                            title: parsed.title,
                            description: firstMeta?.scenarioOutline?.description ?? parsed.description,
                            tags: firstMeta?.scenarioOutline?.tags ?? parsed.tags,
                            execution: { status: 'pending', duration: 0 },
                            summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                            template: {
                                id: `${outlineId}:template`,
                                kind: SpecKind.Scenario,
                                title: parsed.title,
                                execution: { status: 'pending', duration: 0 },
                                summary: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 },
                                children: templateChildren
                            },
                            examples: [],
                            tables
                        };

                        await this.viewerReporter.postNodeToRun(runId, parentNodeId, outline);
                        this.recordChild(parentNodeId, outlineId);
                        this.taskToNodeId.set((task as any).id, outlineId);
                        this.nodeStatus.set(outlineId, 'pending');

                        for (let i = 0; i < exampleSuites.length; i++) {
                            const exampleSuite = exampleSuites[i];
                            const exampleId = generateStabilityId({ project: this.project, title: parsed.title, kind: SpecKind.Scenario, parentId: outlineId, index: i });
                            const exampleNode: any = {
                                id: exampleId,
                                kind: SpecKind.Scenario,
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
                    } else {
                        // Regular Scenario
                        const nodeId = generateStabilityId({ project: this.project, title: parsed.title, kind: SpecKind.Scenario, parentId: parentNodeId });
                        const node: Node = {
                            id: nodeId,
                            kind: SpecKind.Scenario,
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
                }
            }

            // Generic Suite root
            if (!parentNodeId) {
                const fileInfo = this.buildFileInfo(filepath, this.rootPath);
                const suiteId = generateStabilityId({ project: this.project, path: fileInfo.filename, title: name, kind: SpecKind.Suite });
                const suite: any = {
                    id: suiteId,
                    kind: SpecKind.Suite,
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
                const nestedSuiteId = generateStabilityId({ project: this.project, title: name, kind: SpecKind.Suite, parentId: parentNodeId });
                const nested: any = {
                    id: nestedSuiteId,
                    kind: SpecKind.Suite,
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
            const testId = generateStabilityId({ project: this.project, title: name, kind: SpecKind.Test, parentId: parentNodeId });
            const node: any = {
                id: testId,
                kind: SpecKind.Test,
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
        const meta = this.getLiveDocMetaFromTask(task);
        const parsedStep = this.parseStepDetails(task);

        const stepId = generateStabilityId({
            project: this.project,
            title: parsedStep.title,
            kind: SpecKind.Step,
            parentId: scenarioId,
            keyword: parsedStep.keyword,
            index
        });

        const node: any = {
            id: stepId,
            kind: SpecKind.Step,
            title: parsedStep.title,
            keyword: parsedStep.keyword as any,
            docString: (parsedStep as any).materializedDocString || parsedStep.docString,
            docStringRaw: parsedStep.docStringRaw,
            dataTable: this.mapDataTableVNext(parsedStep.dataTable),
            values: this.mapTypedValues(meta?.step?.values),
            code: meta?.step?.code,
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

            for (const task of (file as any).tasks || []) {
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

        const childSuites = (task.tasks || []).filter((t: any) => t?.type === 'suite');

        // IMPORTANT: Build Background first (matches LiveDocSpecReporter behavior).
        const backgroundSuite = childSuites.find((t: any) => typeof t?.name === 'string' && t.name.startsWith('Background:'));
        if (backgroundSuite) {
            feature.background = this.buildBackgroundFromTask(backgroundSuite, feature);
        }

        for (const child of childSuites) {
            if (child === backgroundSuite) continue;
            const name = String(child?.name ?? '');

            if (!name.startsWith('Scenario:')) continue;

            // Vitest represents Scenario Outlines as a "Scenario:" suite with nested "Example ..." suites.
            const exampleSuites = (child.tasks || []).filter((t: any) =>
                t?.type === 'suite' && typeof t?.name === 'string' && t.name.startsWith('Example ')
            );

            if (exampleSuites.length > 0) {
                feature.addScenario(this.buildScenarioOutlineFromNestedStructure(child, feature));
            } else {
                feature.addScenario(this.buildScenarioFromTask(child, feature));
            }
        }
        return feature;
    }

    private buildBackgroundFromTask(task: any, parent: model.Feature): model.Background {
        const parsed = this.parseTitleBlock(String(task?.name ?? '').replace(/^Background:\s*/i, ''));
        const background = new model.Background(parent);
        background.title = parsed.title;
        background.description = parsed.description;
        background.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                background.addStep(this.buildStepFromTask(child, background));
            }
        }

        return background;
    }

    private buildScenarioFromTask(task: any, parent: model.Feature): model.Scenario {
        const parsed = this.parseTitleBlock(task.name.replace('Scenario:', '').replace('Background:', '').trim());
        const scenario = new model.Scenario(parent);
        scenario.title = parsed.title;
        scenario.description = parsed.description;
        scenario.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                scenario.addStep(this.buildStepFromTask(child, scenario));
            }
        }
        return scenario;
    }

    private buildScenarioOutlineFromNestedStructure(task: any, parent: model.Feature): model.ScenarioOutline {
        const parsed = this.parseTitleBlock(String(task?.name ?? '').replace(/^Scenario:\s*/i, ''));

        const outline = new model.ScenarioOutline(parent);
        outline.title = parsed.title;
        outline.description = parsed.description;
        outline.tags = parsed.tags;

        const exampleSuites = (task.tasks || []).filter((t: any) =>
            t?.type === 'suite' && typeof t?.name === 'string' && t.name.startsWith('Example ')
        );

        const firstExampleSuite = exampleSuites[0];
        const firstStepTask = (firstExampleSuite?.tasks || []).find((t: any) => t?.type === 'test');
        const firstMeta = firstStepTask ? this.getLiveDocMetaFromTask(firstStepTask) : undefined;

        // Prefer the authoritative metadata from livedoc.ts for tables/description/tags.
        const metaTables = firstMeta?.scenarioOutline?.tables;
        if (Array.isArray(metaTables) && metaTables.length > 0) {
            outline.tables = this.buildScenarioOutlineTablesFromMeta(metaTables);
        }
        if (Array.isArray(firstMeta?.scenarioOutline?.tags)) {
            outline.tags = firstMeta.scenarioOutline.tags;
        }
        if (typeof firstMeta?.scenarioOutline?.description === 'string') {
            outline.description = firstMeta.scenarioOutline.description;
        }

        // Build template steps (rawTitle/type/docString/dataTable/values/code) from the first example suite.
        if (firstExampleSuite?.tasks) {
            for (const t of firstExampleSuite.tasks) {
                if (t?.type !== 'test') continue;
                const parsedStep = this.parseStepDetails(t);
                const meta = this.getLiveDocMetaFromTask(t);

                const step = new model.StepDefinition(outline, parsedStep.title);
                step.rawTitle = parsedStep.title;
                step.type = parsedStep.keyword;
                step.docString = parsedStep.docString || "";
                step.docStringRaw = parsedStep.docStringRaw || "";
                
                if (parsedStep.dataTable) {
                    step.dataTable = parsedStep.dataTable;
                }
                if (Array.isArray(meta?.step?.values)) {
                    step.values = meta.step.values;
                }
                if (typeof meta?.step?.code === 'string') {
                    (step as any).code = meta.step.code;
                }
                outline.steps.push(step);
            }
        }

        // Build examples
        for (let i = 0; i < exampleSuites.length; i++) {
            const suite = exampleSuites[i];
            const example = new model.ScenarioExample(parent, outline);
            example.title = `Example ${i + 1}`;
            example.sequence = i + 1;
            example.displayTitle = suite?.name ?? example.title;

            const exampleFirstStepTask = (suite?.tasks || []).find((t: any) => t?.type === 'test');
            const exampleMeta = exampleFirstStepTask ? this.getLiveDocMetaFromTask(exampleFirstStepTask) : undefined;
            const values = exampleMeta?.scenarioOutline?.example?.values;
            if (values && typeof values === 'object') {
                const sanitized = this.sanitizeExampleKeys(values);
                example.example = sanitized;
                example.exampleRaw = sanitized;
            } else {
                example.example = {} as any;
                example.exampleRaw = {} as any;
            }

            for (const stepTask of (suite?.tasks || [])) {
                if (stepTask?.type !== 'test') continue;
                example.addStep(this.buildStepFromTask(stepTask, example));
            }

            outline.examples.push(example);
        }

        return outline;
    }

    private buildStepFromTask(task: any, parent: any): model.StepDefinition {
        const name = String(task?.name ?? '');
        const meta = this.getLiveDocMetaFromTask(task);

        const parsedStep = this.parseStepDetails(task);

        const step = new model.StepDefinition(parent, parsedStep.title);
        step.type = parsedStep.keyword;
        step.rawTitle = parsedStep.title;
        step.displayTitle = name;

        if (parsedStep.docString) {
            step.docStringRaw = parsedStep.docStringRaw || parsedStep.docString;
            step.docString = parsedStep.docString;
        }

        if (parsedStep.dataTable) {
            step.dataTable = parsedStep.dataTable;
        }

        const codeFromMeta = typeof meta?.step?.code === 'string' ? String(meta.step.code) : undefined;
        if (codeFromMeta && codeFromMeta.trim().length > 0) {
            (step as any).code = codeFromMeta;
        }

        // Reconstruct docString-like blocks + data tables from multiline step names.
        // This is how LiveDoc transports these across Vitest worker boundaries.
        this.parseStepContent(name, step);
        
        const state = task.result?.state || 'pending';
        step.status = this.mapStateToStatus(state);
        step.duration = task.result?.duration || 0;

        if (task.result?.errors?.length > 0) {
            const ex = new Exception();
            const err = task.result.errors[0];
            ex.message = err.message;
            ex.stackTrace = err.stack;

            // Preserve assertion details when available (used by viewer/text reporter diff formatting)
            if (typeof (err as any).actual !== 'undefined') {
                (ex as any).actual = (err as any).actual;
            }
            if (typeof (err as any).expected !== 'undefined') {
                (ex as any).expected = (err as any).expected;
            }

            // Preserve source code snippet when available (attached by livedoc.ts step handler)
            if (typeof (err as any).code === 'string' && String((err as any).code).trim().length > 0) {
                (step as any).code = String((err as any).code);
            }
            step.exception = ex;
        }

        return step;
    }

    private getLiveDocMetaFromTask(task: any): any | undefined {
        const meta = task?.meta as any;
        const livedocMeta = meta?.livedoc;
        if (!livedocMeta || typeof livedocMeta !== 'object') return undefined;
        return livedocMeta;
    }

    private buildScenarioOutlineTablesFromMeta(metaTables: any[]): model.Table[] {
        const tables: model.Table[] = [];

        for (const raw of metaTables) {
            const table = new model.Table();
            table.name = typeof raw?.name === 'string' ? raw.name : '';
            table.description = typeof raw?.description === 'string' ? raw.description : '';
            table.dataTable = Array.isArray(raw?.dataTable) ? raw.dataTable : [];
            tables.push(table);
        }

        return tables;
    }

    private sanitizeExampleKeys(values: unknown): any {
        if (!values || typeof values !== 'object') return values as any;
        const output: Record<string, any> = {};
        for (const [key, value] of Object.entries(values as Record<string, any>)) {
            output[this.sanitizeName(key)] = value;
        }
        return output;
    }

    private sanitizeName(name: string): string {
        return name.replace(/[ `'']/g, "");
    }

    private parseStepContent(stepName: string, step: model.StepDefinition): void {
        const lines = stepName.split('\n');
        if (lines.length <= 1) {
            return;
        }

        // Skip the first line (it's the title)
        const contentLines: string[] = [];
        const tableLines: string[] = [];
        let foundTable = false;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('|') && line.endsWith('|')) {
                foundTable = true;
                tableLines.push(line);
                continue;
            }

            if (foundTable && line === '') {
                continue;
            }

            if (line !== '') {
                contentLines.push(lines[i]);
            }
        }

        if (tableLines.length > 0) {
            step.dataTable = this.parseDataTableFromLines(tableLines);
        }

        if (contentLines.length > 0) {
            let minIndent = Infinity;
            for (const l of contentLines) {
                if (l.trim() !== '') {
                    const indent = l.length - l.trimLeft().length;
                    if (indent < minIndent) minIndent = indent;
                }
            }

            const descLines = contentLines.map((l) => (l.length >= minIndent ? l.substring(minIndent) : l));

            while (descLines.length > 0 && descLines[0].trim() === '') {
                descLines.shift();
            }
            while (descLines.length > 0 && descLines[descLines.length - 1].trim() === '') {
                descLines.pop();
            }

            step.description = descLines.join('\n');
        }
    }

    private parseDataTableFromLines(lines: string[]): any[] {
        const table: any[] = [];
        if (lines.length < 2) return table;

        // Parse header row
        const headers = lines[0]
            .split('|')
            .map((h) => h.trim())
            .filter((h) => h.length > 0);

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const cells = lines[i]
                .split('|')
                .map((c) => c.trim())
                .filter((c) => c.length > 0);

            const row: Record<string, string> = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = cells[j] ?? '';
            }
            table.push(row);
        }

        return table;
    }

    private parseStepDetails(task: any): { 
        keyword: string; 
        title: string; 
        docString?: string; 
        docStringRaw?: string; 
        materializedDocString?: string; 
        dataTable?: any[] 
    } {
        const meta = this.getLiveDocMetaFromTask(task);
        const name = String(task.name || '');

        const keywordFromMeta = typeof meta?.step?.type === 'string' ? String(meta.step.type).toLowerCase() : undefined;
        const rawTitleFromMeta = typeof meta?.step?.rawTitle === 'string' ? String(meta.step.rawTitle) : undefined;
        const docStringFromMeta = typeof (meta as any)?.step?.docString === 'string' ? String((meta as any).step.docString) : undefined;
        const docStringRawFromMeta = typeof (meta as any)?.step?.docStringRaw === 'string' ? String((meta as any).step.docStringRaw) : undefined;
        const dataTableFromMeta = (meta as any)?.step?.dataTable;
        const materializedDocStringFromMeta = (meta as any)?.step?.materializedDocString;

        let keyword: string = '';
        let title: string = '';
        let docString: string | undefined = docStringFromMeta;
        let docStringRaw: string | undefined = docStringRawFromMeta;
        let materializedDocString: string | undefined = materializedDocStringFromMeta;
        let dataTable: any[] | undefined = dataTableFromMeta;

        if (keywordFromMeta && rawTitleFromMeta) {
            keyword = keywordFromMeta;
            title = rawTitleFromMeta;
        } else {
            // Fallback to parsing the name
            const lines = name.split('\n');
            const firstLine = lines[0].trim();
            
            // Try to extract keyword and title from first line
            const match = firstLine.match(/^(Given|When|Then|And|But)\s+(.+)$/i);
            if (match) {
                keyword = match[1].toLowerCase();
                title = match[2];
            } else {
                // Secondary match for indented and/but
                const indentedMatch = firstLine.match(/^(?:and|but)\s+(.+)$/i);
                if (indentedMatch) {
                    keyword = firstLine.split(' ')[0].toLowerCase();
                    title = indentedMatch[1];
                } else {
                    const parts = firstLine.split(' ');
                    keyword = parts[0].toLowerCase();
                    title = parts.slice(1).join(' ');
                }
            }
        }

        // Fallback to extracting DocString from full name if not found in meta or meta step was incomplete
        if (!docString) {
            // More robust docstring extraction: match content between """ markers, including first line with markers
            const docStringMatch = name.match(/("""[\s\S]*?""")/);
            if (docStringMatch) {
                docStringRaw = docStringMatch[1].trim();
                // Extract content between markers
                const markerStart = docStringRaw.indexOf('"""');
                const markerEnd = docStringRaw.lastIndexOf('"""');
                if (markerEnd > markerStart + 3) {
                    docString = docStringRaw.substring(markerStart + 3, markerEnd).trim();
                }
            }
        }

        // If materializedDocString wasn't provided in meta, use docString as default
        if (!materializedDocString) {
            materializedDocString = docString;
        }

        return { keyword, title, docString, docStringRaw, materializedDocString, dataTable };
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

    private mapDataTableVNext(dataTable: any[] | undefined): ExampleTable | undefined {
        if (!Array.isArray(dataTable) || dataTable.length < 1) return undefined;

        const headers = dataTable[0];
        const rows = dataTable.slice(1).map((r, i) => ({
            rowId: `unknown:row:${i}`,
            values: Array.isArray(r) ? r.map((cell: any) => ({
                value: cell,
                type: 'string' as const
            })) : []
        }));

        return {
            name: '',
            description: '',
            headers,
            rows
        };
    }

    private mapTypedValues(values: any[] | undefined): TypedValue[] {
        if (!Array.isArray(values)) return [];
        return values.map((v) => ({
            value: v,
            type: typeof v as any
        }));
    }

    private mapScenarioOutlineTables(metaTables: any[], outlineId: string): ExampleTable[] {
        return metaTables.map((t, i) => ({
            name: t.name,
            description: t.description,
            headers: t.dataTable?.[0] || [],
            rows: (t.dataTable?.slice(1) || []).map((row: any, j: number) => ({
                rowId: `${outlineId}:table:${i}:row:${j + 1}`,
                values: Array.isArray(row) ? row.map((v: any) => ({ value: v, type: 'string' })) : []
            }))
        }));
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
