import * as livedoc from "@livedoc/vitest";
import { WebSocketEvent } from "@livedoc/server";

import * as vscode from "vscode";

import { ExecutionResultTreeViewItem, ExecutionConfigTreeViewItem, ExecutionFolderTreeViewItem, FeatureTreeViewItem, ScenarioTreeViewItem, StepTreeViewItem, BackgroundTreeViewItem } from "./ExecutionResultTreeViewItem";
import { ScenarioStatus } from "./ScenarioStatus";

/**
 * Configuration for a test suite execution
 */
export interface TestSuite {
    name: string;
    path: string;
}

export interface IExecutionModel extends TestSuite {
    results: FeatureGroup[];
    executionResults: livedoc.ExecutionResults;
}

/**
 * Local config to hold test suites
 */
interface LiveDocConfig {
    testSuites: IExecutionModel[];
}

export class ExecutionResultOutlineProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ExecutionResultTreeViewItem | undefined> = new vscode.EventEmitter<ExecutionResultTreeViewItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ExecutionResultTreeViewItem | undefined> = this._onDidChangeTreeData.event;
    private static executionResults: livedoc.ExecutionResults;
    private config: LiveDocConfig;
    private isRunning = false;

    constructor(private rootPath: string, private extensionPath: string, private serverPort: number) {
        this.config = { testSuites: [] };
        this.refresh();
    }

    public handleEvent(event: WebSocketEvent) {
        console.log(`LiveDoc: WebSocket event received: ${event.type}`);
        switch (event.type) {
            case 'run:started':
                this.isRunning = true;
                this.refresh();
                break;
            case 'run:completed':
                this.isRunning = false;
                this.refresh();
                break;
            case 'feature:updated':
            case 'scenario:completed':
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
                            .filter((p: any) => typeof p?.project === 'string' && typeof p?.environment === 'string')
                            .sort((a: any, b: any) => {
                                const at = Date.parse(a?.latestRun?.timestamp ?? '') || 0;
                                const bt = Date.parse(b?.latestRun?.timestamp ?? '') || 0;
                                return bt - at;
                            })[0];

                        if (best) {
                            console.log(`LiveDoc: Auto-selected project '${best.project}' env '${best.environment}'`);
                            selected = await fetchLatestRun(best.project, best.environment);
                        }
                    }
                } catch (e) {
                    console.error("LiveDoc: Failed to discover projects", e);
                }
            }

            if (selected) {
                const { run, project, environment } = selected;
                console.log(`LiveDoc: Data received, features: ${run.features?.length}`);
                if (run.features?.length > 0) {
                    console.log(`LiveDoc: First feature: ${run.features[0].title}, scenarios: ${run.features[0].scenarios?.length}`);
                }

                const suite: IExecutionModel = {
                    name: project,
                    path: environment,
                    results: [],
                    executionResults: {
                        features: run.features || [],
                        suites: run.suites || [],
                        specifications: []
                    } as any
                };
                this.buildFeatureGroup(suite);
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
    public getTreeItem(element: ExecutionResultTreeViewItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    public getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        // Now create the tree view items from the results
        // as no element is defined return the top level results
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
                    command: 'livedoc.openViewer',
                    title: '',
                    arguments: []
                }));
            });
        }
        else {
            switch (element.constructor.name) {
                case "ExecutionConfigTreeViewItem":
                    const configForSuiteMatch = this.config.testSuites.filter(suite => (element as ExecutionConfigTreeViewItem).key == suite.name);
                    if (configForSuiteMatch) {
                        const config = configForSuiteMatch[0] as IExecutionModel;
                        results = config.results.map(group => {
                            if (!group.title) {
                                group.title = "root";
                            }
                            return new ExecutionFolderTreeViewItem(config, group, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath);
                        });
                    }
                    break;
                case "ExecutionFolderTreeViewItem":
                    const groupView = (element as ExecutionFolderTreeViewItem);
                    // A group can contain both sub-folders and features; show both.
                    results = [];
                    results.push(
                        ...groupView.group.children.map(group =>
                            new ExecutionFolderTreeViewItem(groupView.tesSuite, group, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath)
                        )
                    );
                    results.push(
                        ...groupView.group.features.map(feature =>
                            new FeatureTreeViewItem(groupView.tesSuite, feature, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath)
                        )
                    );
                    break;
                case "FeatureTreeViewItem":
                    const featureView = (element as FeatureTreeViewItem);
                    console.log(`LiveDoc: Getting children for feature ${featureView.feature.title}, scenarios: ${featureView.feature.scenarios?.length}`);
                    results = this.getTreeViewItemsForNode(featureView) as vscode.TreeItem[];
                    if (featureView.feature.background) {
                        // Add the background to the feature
                        results.unshift(new BackgroundTreeViewItem(featureView.tesSuite, featureView.feature.background, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath));
                    }
                    break;
                case "BackgroundTreeViewItem":
                    const backgroundView = (element as BackgroundTreeViewItem);
                    results = (backgroundView.background.steps || []).map(step => {
                        // create the display title (can't work out how to get VSCode to not truncate leading spaces)
                        const indent = ["and", "but"].includes(String((step as any).type).toLowerCase()) ? String.fromCharCode(160).repeat(4) : "";
                        step.displayTitle = `${indent}${step.type} ${step.title}`
                        return new StepTreeViewItem(step, vscode.TreeItemCollapsibleState.None, this.extensionPath);
                    });
                    break;
                case "ScenarioTreeViewItem":
                    const scenarioView = (element as ScenarioTreeViewItem);
                    results = (scenarioView.scenario.steps || []).map(step => {
                        // create the display title (can't work out how to get VSCode to not truncate leading spaces)
                        const indent = ["and", "but"].includes(String((step as any).type).toLowerCase()) ? String.fromCharCode(160).repeat(4) : "";
                        step.displayTitle = `${indent}${step.type} ${step.title}`
                        return new StepTreeViewItem(step, vscode.TreeItemCollapsibleState.None, this.extensionPath);
                    });
                    break;
                default:
                    break;
            }

        }
        return results;
    }
    private getTreeViewItemsForNode(featureView: FeatureTreeViewItem): vscode.ProviderResult<ExecutionResultTreeViewItem[]> {
        const results = (featureView.feature.scenarios || []).map(scenario => {
            const scenarioAny = scenario as any;
            const scenarioId = Array.isArray(scenarioAny?.examples) && scenarioAny.examples.length > 0
                ? String(scenarioAny.examples[0].id)
                : String(scenarioAny.id);

            return new ScenarioTreeViewItem(
                featureView.tesSuite,
                featureView.feature,
                scenario,
                vscode.TreeItemCollapsibleState.Collapsed,
                this.extensionPath,
                {
                    command: 'livedoc.viewItem',
                    title: '',
                    arguments: [{ featureId: featureView.feature.id, scenarioId }]
                }
            );
        });
        return results;
    }

    private buildFeatureGroup(suite: IExecutionModel) {
        const rootFeatureGroup = new FeatureGroup(null, "root");

        suite.executionResults.features.forEach(feature => {
            let activeGroup = rootFeatureGroup;
            // Use path or filename, and ensure we have a string
            const featurePath = (feature.path || feature.filename || "").replace(/\\/g, "/");
            const parts = featurePath.split("/");
            
            // Remove the filename from the path parts if it exists
            // This ensures we group by folder, and the feature itself is the leaf
            if (parts.length > 0 && (parts[parts.length - 1].endsWith('.ts') || parts[parts.length - 1].endsWith('.js'))) {
                parts.pop();
            }

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!part) continue; // Skip empty parts
                
                const foundGroup = activeGroup.children.filter(f => f.title === part);
                if (foundGroup.length !== 0) { // ie found a group
                    activeGroup = foundGroup[0];
                } else {
                    const group = new FeatureGroup(activeGroup, part);
                    activeGroup.children.push(group);
                    activeGroup = group;
                }
            }
            // At this point we should be at the end of the path with the correct group
            activeGroup.addFeature(feature);
        });

        // Flatten the tree: remove single-child folders
        this.flattenTree(rootFeatureGroup);

        // transfer the children of the root to the top level as results
        suite.results = rootFeatureGroup.children.map(feature => feature);
    }

    private flattenTree(group: FeatureGroup) {
        // Process children first
        group.children.forEach(child => this.flattenTree(child));

        // Check if we can flatten any children into this group
        // We can't easily merge up, but we can merge down?
        // Actually, the standard way is: if a child has only 1 child and no features, merge it up.
        
        // Let's try a different approach:
        // For each child of the current group:
        // If that child has 1 child group and 0 features, merge them.
        
        for (let i = 0; i < group.children.length; i++) {
            let child = group.children[i];
            while (child.children.length === 1 && child.features.length === 0) {
                const grandChild = child.children[0];
                child.title = `${child.title}/${grandChild.title}`;
                child.children = grandChild.children;
                child.features = grandChild.features;
                // Update parent references if needed (FeatureGroup has a parent prop)
                child.children.forEach(c => c.parent = child);
                // Continue loop to check if we can flatten further
            }
        }
    }

    // Legacy Reporter webview navigation was removed in favor of the shared Viewer webview.
}

export class FeatureGroup {
    constructor(public parent: FeatureGroup, public title) {
    }

    public status: ScenarioStatus = ScenarioStatus.unknown;
    public children: FeatureGroup[] = [];
    public features: livedoc.Feature[] = [];

    public addFeature(feature: livedoc.Feature) {
        this.features.push(feature);
        const status = this.getStatus(feature);
        this.updateStatus(status);
    }

    public updateStatus(status: ScenarioStatus) {
        if (this.status === ScenarioStatus.unknown) {
            this.status = status;
        } else {
            const isPending = !!(this.status & ScenarioStatus.pending);
            if (this.status !== (this.status & ScenarioStatus.fail)) {
                this.status |= status;
            }
            if (isPending) {
                this.status |= ScenarioStatus.pending;
            }
        }

        // Now propagate this status to the parent
        if (this.parent) {
            this.parent.updateStatus(this.status);
        }
    }

    // TODO: Refactor as this is in the ExecutionResultTreeViewItem as well. Should move
    //       the livedoc model as it seems to be needed a lot.
    private getStatus(suite: livedoc.SuiteBase<any>): ScenarioStatus {
        let status = ScenarioStatus.unknown;
        const stats = suite.statistics;
        // These status' are export binary
        if (stats.failedCount > 0) {
            status = ScenarioStatus.fail;
        }
        else if (stats.passCount > 0) {
            status = ScenarioStatus.pass;
        }
        // These status' are additive
        if (stats.pendingCount > 0) {
            status |= ScenarioStatus.pending;
        }
        // warnings have been ignored for now.
        return status;
    }
}