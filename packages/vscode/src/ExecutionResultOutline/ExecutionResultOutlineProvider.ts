import type { V1WebSocketEvent } from "@swedevtools/livedoc-server";
import type { AnyTest, Status, TestCase, TestRunV1 } from "@swedevtools/livedoc-schema";

import * as vscode from "vscode";
import * as path from 'path';

import { ExecutionConfigTreeViewItem } from "./ExecutionResultTreeViewItem";
import { NodeTreeViewItem } from "./NodeTreeViewItem";

class PathFolderTreeViewItem extends vscode.TreeItem {
    constructor(
        public readonly suiteKey: string,
        public readonly segments: string[],
        label: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'folder';
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}

class OutlineExampleTreeViewItem extends vscode.TreeItem {
    constructor(
        public readonly outline: AnyTest,
        public readonly rowId: unknown,
        label: string,
        extensionPath: string,
        status: Status | undefined,
        description?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        this.contextValue = 'outline-example';
        this.description = description;
        this.tooltip = new vscode.MarkdownString(description || label);
        this.command = {
            command: 'livedoc.viewItem',
            title: '',
            arguments: [outline]
        };

        const iconName = status === 'failed'
            ? 'failed.svg'
            : status === 'passed'
                ? 'passed.svg'
                : status === 'pending' || status === 'running' || status === 'skipped' || status === 'timedOut' || status === 'cancelled'
                    ? 'pending.svg'
                    : 'passed.svg';

        this.iconPath = path.join(extensionPath, 'images', 'icons', iconName);
    }
}

/**
 * Configuration for a test suite execution
 */
export interface TestSuite {
    name: string;
    path: string;
}

export interface IExecutionModel extends TestSuite {
    latestRun?: TestRunV1;
}

/**
 * Local config to hold test suites
 */
interface LiveDocConfig {
    testSuites: IExecutionModel[];
}

export class ExecutionResultOutlineProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined> = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> = this._onDidChangeTreeData.event;
    private config: LiveDocConfig;
    private isRunning = false;
    private refreshInProgress = false;
    private refreshRequested = false;
    private refreshTimer: NodeJS.Timeout | undefined;

    constructor(private rootPath: string, private extensionPath: string, private serverPort: number) {
        this.config = { testSuites: [] };
        this.requestRefresh();
    }

    public setServerPort(serverPort: number) {
        this.serverPort = serverPort;
        this.requestRefresh();
    }

    public handleEvent(event: V1WebSocketEvent) {
        console.log(`LiveDoc: WebSocket event received: ${event.type}`);
        switch (event.type) {
            case "run:v1:started":
                this.isRunning = true;
                this.requestRefresh();
                break;
            case "run:v1:completed":
                this.isRunning = false;
                this.requestRefresh();
                break;
            default:
                // For now, treat all v1 events as a signal to refresh.
                this.requestRefresh();
                break;
        }
    }

    /**
     * Debounced, serialized refresh to avoid overlapping fetches producing duplicate suites.
     */
    private requestRefresh() {
        this.refreshRequested = true;
        if (this.refreshTimer) return;
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined;
            void this.refresh();
        }, 150);
    }

    private async fetchData() {
        this.config.testSuites = [];
        try {
            const defaultProject = vscode.workspace.name || "LiveDoc Project";
            const defaultEnvironment = "local";

            const fetchRun = async (url: string) => {
                console.log(`LiveDoc: Fetching data from ${url}`);
                const response = await fetch(url);
                console.log(`LiveDoc: Response status: ${response.status}`);
                if (!response.ok) return null;
                return (await response.json()) as any;
            };

            const fetchLatestOrMostRecentRun = async (project: string, environment: string) => {
                const base = `http://localhost:${this.serverPort}`;

                // 1) Preferred: latest run (backed by lastrun.json).
                const latestUrl = `${base}/api/projects/${encodeURIComponent(project)}/${encodeURIComponent(environment)}/latest`;
                const latest = await fetchRun(latestUrl);
                if (latest) return { run: latest, project, environment };

                // 2) Fallback: pick newest run from history (covers dataDir with history only).
                const runsUrl = `${base}/api/projects/${encodeURIComponent(project)}/${encodeURIComponent(environment)}/runs`;
                const runs = await fetchRun(runsUrl);
                const runList: any[] = Array.isArray(runs) ? runs : Array.isArray((runs as any)?.runs) ? (runs as any).runs : [];
                if (runList.length === 0) return null;

                const newest = runList
                    .slice()
                    .sort((a, b) => (Date.parse(b?.timestamp ?? '') || 0) - (Date.parse(a?.timestamp ?? '') || 0))[0];

                const runId = newest?.runId ?? newest?.id;
                if (!runId) return null;

                const runByIdUrl = `${base}/api/runs/${encodeURIComponent(String(runId))}`;
                const run = await fetchRun(runByIdUrl);
                if (!run) return null;
                return { run, project, environment };
            };

            // 1) Try the workspace project name first
            let selected = await fetchLatestOrMostRecentRun(defaultProject, defaultEnvironment);

            // 2) Back-compat fallback
            if (!selected && defaultProject !== "LiveDoc Project") {
                console.log(`LiveDoc: Fetch failed, trying fallback to LiveDoc Project`);
                selected = await fetchLatestOrMostRecentRun("LiveDoc Project", defaultEnvironment);
            }

            // 3) Auto-discover from /api/projects (fixes project/env mismatch)
            if (!selected) {
                try {
                    const listUrl = `http://localhost:${this.serverPort}/api/projects`;
                    console.log(`LiveDoc: Discovering projects from ${listUrl}`);
                    const listResponse = await fetch(listUrl);
                    if (listResponse.ok) {
                        const body = await listResponse.json() as any;
                        const projects = Array.isArray(body?.projects) ? body.projects : [];
                        const best = projects
                            .filter((p: any) => typeof p?.project === "string" && typeof p?.environment === "string")
                            .sort((a: any, b: any) => {
                                const at = Date.parse(a?.latestRun?.timestamp ?? "") || 0;
                                const bt = Date.parse(b?.latestRun?.timestamp ?? "") || 0;
                                if (bt !== at) return bt - at;
                                const ah = Number(a?.historyCount ?? 0) || 0;
                                const bh = Number(b?.historyCount ?? 0) || 0;
                                return bh - ah;
                            })[0];

                        if (best) {
                            console.log(`LiveDoc: Auto-selected project ${best.project} env ${best.environment}`);
                            selected = await fetchLatestOrMostRecentRun(best.project, best.environment);
                        }
                    }
                } catch (e) {
                    console.error("LiveDoc: Failed to discover projects", e);
                }
            }

            if (selected) {
                const { run, project, environment } = selected;
                const testRun = run as TestRunV1;
                console.log(`LiveDoc: Data received, documents: ${testRun.documents?.length}`);

                const suite: IExecutionModel = {
                    name: project,
                    path: environment,
                    latestRun: testRun
                };
                this.config.testSuites.push(suite);
            }
        } catch (e) {
            console.error("Failed to fetch results", e);
        }
    }

    public async refresh(): Promise<void> {
        if (this.refreshInProgress) {
            this.refreshRequested = true;
            return;
        }

        this.refreshInProgress = true;
        try {
            do {
                this.refreshRequested = false;
                await this.fetchData();
                this._onDidChangeTreeData.fire(undefined);
            } while (this.refreshRequested);
        } finally {
            this.refreshInProgress = false;
        }
    }

    public getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    public getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        let results: vscode.TreeItem[] = [];
        if (!element) {
            results = [];
            
            if (this.isRunning) {
                const item = new vscode.TreeItem("Tests Running...");
                item.iconPath = new vscode.ThemeIcon("loading~spin");
                results.push(item);
            }

            if (this.config.testSuites.length === 0 && !this.isRunning) {
                const item = new vscode.TreeItem("Waiting for results...");
                item.description = "Run your tests to see them here";
                results.push(item);
            }

            this.config.testSuites.forEach(suite => {
                const prefix = suite.path.toLocaleLowerCase().startsWith("http") ? "REMOTE" : "LOCAL";
                results.push(new ExecutionConfigTreeViewItem(`${prefix}:${suite.name.toLocaleUpperCase()}`, suite.name, vscode.TreeItemCollapsibleState.Collapsed, {
                    command: "livedoc.openViewer",
                    title: "",
                    arguments: []
                }));
            });
        }
        else {
            if (element instanceof ExecutionConfigTreeViewItem) {
                const configForSuiteMatch = this.config.testSuites.find(suite => element.key === suite.name);
                if (configForSuiteMatch?.latestRun) {
                    const docs = configForSuiteMatch.latestRun.documents;
                    const layout = this.getExplorerLayout();

                    if (layout === 'flat') {
                        return docs.map(doc =>
                            new NodeTreeViewItem(
                                doc,
                                (doc.tests?.length ?? 0) > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                                this.extensionPath,
                                {
                                    command: "livedoc.viewItem",
                                    title: "",
                                    arguments: [doc]
                                }
                            )
                        );
                    }

                    const { folders, documents } = this.getDocumentChildrenForPath(element.key, docs, []);
                    return [...folders, ...documents];
                }
            }

            if (element instanceof PathFolderTreeViewItem) {
                const suite = this.config.testSuites.find(s => s.name === element.suiteKey);
                const docs = suite?.latestRun?.documents ?? [];
                const { folders, documents } = this.getDocumentChildrenForPath(element.suiteKey, docs, element.segments);
                return [...folders, ...documents];
            }

            if (element instanceof NodeTreeViewItem) {
                const node = element.node;

                if (!this.isV1TestCase(node) && (node.kind === 'ScenarioOutline' || node.kind === 'RuleOutline')) {
                    return this.getOutlineExamples(node);
                }

                const children = this.getV1Children(node);

                return children.map(child =>
                    new NodeTreeViewItem(
                        child,
                        this.getV1HasChildren(child) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        this.extensionPath,
                        {
                            command: "livedoc.viewItem",
                            title: "",
                            arguments: [child]
                        }
                    )
                );
            }
        }
        return results;
    }

    private getOutlineExamples(outline: AnyTest): vscode.TreeItem[] {
        const dataTables = Array.isArray((outline as any)?.examples) ? ((outline as any).examples as any[]) : [];

        const rows: Array<{ rowId: unknown; headers: string[]; values: any[] }> = [];
        for (const t of dataTables) {
            const headers = Array.isArray(t?.headers) ? t.headers.map(String) : [];
            const tRows = Array.isArray(t?.rows) ? t.rows : [];
            for (const r of tRows) {
                rows.push({
                    rowId: (r as any)?.rowId,
                    headers,
                    values: Array.isArray((r as any)?.values) ? (r as any).values : []
                });
            }
        }

        const resultEntries = Array.isArray((outline as any)?.exampleResults) ? ((outline as any).exampleResults as any[]) : [];
        const getRowStatus = (rowId: unknown): Status | undefined => {
            const sameRow = resultEntries.filter((e) => (e as any)?.result?.rowId === rowId);
            if (sameRow.length === 0) return undefined;

            if (outline.kind === 'RuleOutline') {
                const match = sameRow.find((e) => (e as any)?.testId === outline.id);
                return match?.result?.status as Status | undefined;
            }

            const statuses = sameRow
                .map((e) => (e as any)?.result?.status as Status | undefined)
                .filter(Boolean) as Status[];

            if (statuses.some((s) => s === 'failed' || s === 'timedOut')) return 'failed';
            if (statuses.some((s) => s === 'pending' || s === 'running' || s === 'skipped' || s === 'cancelled')) return 'pending';
            if (statuses.some((s) => s === 'passed')) return 'passed';
            return undefined;
        };

        const summarizeRow = (headers: string[], values: any[]): string | undefined => {
            const pairs: string[] = [];
            const max = Math.min(headers.length, values.length);
            for (let i = 0; i < max; i++) {
                const raw = values[i]?.value ?? values[i];
                pairs.push(`${headers[i]}=${String(raw)}`);
            }
            if (pairs.length === 0) return undefined;
            const preview = pairs.slice(0, 3).join(', ');
            return pairs.length > 3 ? `${preview}, …` : preview;
        };

        return rows.map((r, index) => {
            const status = getRowStatus(r.rowId);
            const desc = summarizeRow(r.headers, r.values);
            return new OutlineExampleTreeViewItem(outline, r.rowId, `Example ${index + 1}`, this.extensionPath, status, desc);
        });
    }

    private getExplorerLayout(): 'tree' | 'flat' {
        const cfg = vscode.workspace.getConfiguration('livedoc');
        const v = cfg.get<'tree' | 'flat'>('treeView.layout', 'tree');
        return v === 'flat' ? 'flat' : 'tree';
    }

    private getPathSegments(doc: TestCase): string[] {
        // Keep behavior aligned with viewer's buildGroupedNavTree:
        // - Normalize separators to '/'
        // - Strip leading '/'
        // - If it looks like a file path, use directories as groups (drop filename)
        const raw = String((doc as any).path ?? '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
        if (!raw) return [];
        const parts = raw.split('/').filter(Boolean);
        if (parts.length <= 1) return [];
        return parts.slice(0, -1);
    }

    private getDocumentChildrenForPath(
        suiteKey: string,
        docs: TestCase[],
        folderSegments: string[]
    ): { folders: vscode.TreeItem[]; documents: vscode.TreeItem[] } {
        const depth = folderSegments.length;
        const foldersByName = new Map<string, PathFolderTreeViewItem>();
        const docsInFolder: TestCase[] = [];

        for (const doc of docs) {
            const segs = this.getPathSegments(doc);

            // Root folder: include docs with no path.
            if (depth === 0 && segs.length === 0) {
                docsInFolder.push(doc);
                continue;
            }

            // Must match the current folder prefix.
            let matchesPrefix = true;
            for (let i = 0; i < depth; i++) {
                if (segs[i] !== folderSegments[i]) {
                    matchesPrefix = false;
                    break;
                }
            }
            if (!matchesPrefix) continue;

            // Direct child doc (exact folder match).
            if (segs.length === depth) {
                docsInFolder.push(doc);
                continue;
            }

            // Child folder (next segment).
            const next = segs[depth];
            if (!next) continue;
            if (!foldersByName.has(next)) {
                foldersByName.set(next, new PathFolderTreeViewItem(suiteKey, [...folderSegments, next], next));
            }
        }

        const folders = Array.from(foldersByName.values()).sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
        const documents = docsInFolder
            .slice()
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(doc =>
                new NodeTreeViewItem(
                    doc,
                    (doc.tests?.length ?? 0) > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    this.extensionPath,
                    {
                        command: "livedoc.viewItem",
                        title: "",
                        arguments: [doc]
                    }
                )
            );

        return { folders, documents };
    }

    private getV1Children(node: TestCase | AnyTest): Array<TestCase | AnyTest> {
        if (this.isV1TestCase(node)) {
            const children: Array<TestCase | AnyTest> = [];
            children.push(...(node.tests ?? []));
            return children;
        }

        switch (node.kind) {
            // For the VS Code Explorer UX, stop at Scenario/Outline (match viewer explorer).
            // Steps/examples are shown in the viewer, not nested in the tree.
            case 'Scenario':
            case 'ScenarioOutline':
            case 'Rule':
            case 'RuleOutline':
                return [];
            default:
                return [];
        }
    }

    private getV1HasChildren(node: TestCase | AnyTest): boolean {
        if (this.isV1TestCase(node)) {
            return (node.tests?.length ?? 0) > 0;
        }

        switch (node.kind) {
            case 'Scenario':
            case 'Rule':
                return false;
            case 'ScenarioOutline':
            case 'RuleOutline':
                return true;
            default:
                return false;
        }
    }

    private isV1TestCase(node: TestCase | AnyTest): node is TestCase {
        return Array.isArray((node as any)?.tests);
    }
}
