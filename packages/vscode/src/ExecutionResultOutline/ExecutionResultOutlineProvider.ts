import { WebSocketEvent } from "@livedoc/server";
import { Node, TestRun, Container, Outline } from "@livedoc/schema";

import * as vscode from "vscode";

import { ExecutionConfigTreeViewItem } from "./ExecutionResultTreeViewItem";
import { NodeTreeViewItem } from "./NodeTreeViewItem";

/**
 * Configuration for a test suite execution
 */
export interface TestSuite {
    name: string;
    path: string;
}

export interface IExecutionModel extends TestSuite {
    latestRun?: TestRun;
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

    constructor(private rootPath: string, private extensionPath: string, private serverPort: number) {
        this.config = { testSuites: [] };
        this.refresh();
    }

    public handleEvent(event: WebSocketEvent) {
        console.log(`LiveDoc: WebSocket event received: ${event.type}`);
        switch (event.type) {
            case "run:started":
                this.isRunning = true;
                this.refresh();
                break;
            case "run:completed":
                this.isRunning = false;
                this.refresh();
                break;
            case "node:added":
            case "node:updated":
            case "node:removed":
                // Refresh to get latest state
                this.refresh();
                break;
        }
    }

    private async fetchData() {
        this.config.testSuites = [];
        try {
            const defaultProject = vscode.workspace.name || "LiveDoc Project";
            const defaultEnvironment = "local";

            const fetchLatestRun = async (project: string, environment: string) => {
                const url = `http://localhost:${this.serverPort}/api/projects/${encodeURIComponent(project)}/${encodeURIComponent(environment)}/latest`;
                console.log(`LiveDoc: Fetching data from ${url}`);
                const response = await fetch(url);
                console.log(`LiveDoc: Response status: ${response.status}`);
                if (!response.ok) return null;
                const run = await response.json() as any;
                return { run, project, environment };
            };

            // 1) Try the workspace project name first
            let selected = await fetchLatestRun(defaultProject, defaultEnvironment);

            // 2) Back-compat fallback
            if (!selected && defaultProject !== "LiveDoc Project") {
                console.log(`LiveDoc: Fetch failed, trying fallback to LiveDoc Project`);
                selected = await fetchLatestRun("LiveDoc Project", defaultEnvironment);
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
                                return bt - at;
                            })[0];

                        if (best) {
                            console.log(`LiveDoc: Auto-selected project ${best.project} env ${best.environment}`);
                            selected = await fetchLatestRun(best.project, best.environment);
                        }
                    }
                } catch (e) {
                    console.error("LiveDoc: Failed to discover projects", e);
                }
            }

            if (selected) {
                const { run, project, environment } = selected;
                const testRun = run as TestRun;
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
        await this.fetchData();
        this._onDidChangeTreeData.fire(undefined);
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
                    return configForSuiteMatch.latestRun.documents.map(doc => 
                        new NodeTreeViewItem(
                            doc, 
                            (doc as any).children?.length > 0 || (doc as any).examples?.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                            this.extensionPath
                        )
                    );
                }
            }

            if (element instanceof NodeTreeViewItem) {
                const node = element.node;
                let children: Node[] = [];
                
                if ("children" in node) {
                    children = (node as Container).children;
                } else if ("examples" in node) {
                    children = (node as Outline<any, any>).examples;
                }

                return children.map(child => 
                    new NodeTreeViewItem(
                        child,
                        (child as any).children?.length > 0 || (child as any).examples?.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
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
}
