import * as livedoc from "livedoc-mocha/model";
import * as livedocConfig from "livedoc-mocha/model/config";

import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

import { ExecutionResultTreeViewItem, ExecutionConfigTreeViewItem, ExecutionFolderTreeViewItem, FeatureTreeViewItem, ScenarioTreeViewItem, StepTreeViewItem, BackgroundTreeViewItem } from "./ExecutionResultTreeViewItem";
import { ScenarioStatus } from "./ScenarioStatus";
import { TestSuite } from "livedoc-mocha/model/config";

export interface IExecutionModel extends livedocConfig.TestSuite {
    results: FeatureGroup[];
    executionResults: livedoc.ExecutionResults;
}
export class ExecutionResultOutlineProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ExecutionResultTreeViewItem | undefined> = new vscode.EventEmitter<ExecutionResultTreeViewItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ExecutionResultTreeViewItem | undefined> = this._onDidChangeTreeData.event;
    private static executionResults: livedoc.ExecutionResults;
    private config: livedocConfig.LiveDocConfig;

    constructor(private rootPath: string, private extensionPath: string) {
        this.config = new livedocConfig.LiveDocConfig();

        let localSuite = new livedocConfig.TestSuite() as IExecutionModel;
        localSuite.name = "production";
        localSuite.path = "http://build/bvt/**/*.Spec.js";
        localSuite.executionResults = this.loadModelFromFile(path.join(this.extensionPath, "src/resources/results.json"))
        this.buildFeatureGroup(localSuite as IExecutionModel);
        this.config.testSuites.push(localSuite);

        localSuite = new livedocConfig.TestSuite() as IExecutionModel;
        localSuite.name = "unit tests";
        localSuite.path = "build/test/**/*.Spec.js";
        localSuite.executionResults = this.loadModelFromFile(path.join(this.extensionPath, "src/resources/results-fail.json"));
        this.buildFeatureGroup(localSuite as IExecutionModel);

        this.config.testSuites.push(localSuite);

    }

    private loadModelFromFile(path: string): livedoc.ExecutionResults {
        const executionResultsText = fs.readFileSync(path, 'utf8');
        return JSON.parse(executionResultsText);
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
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
            this.config.testSuites.forEach(suite => {
                const prefix = suite.path.toLocaleLowerCase().startsWith("http") ? "REMOTE" : "LOCAL";
                results.push(new ExecutionConfigTreeViewItem(`${prefix}:${suite.name.toLocaleUpperCase()}`, suite.name, vscode.TreeItemCollapsibleState.Collapsed, {
                    command: 'livedoc.navigateToSummaryInReporterCommand',
                    title: '',
                    arguments: [suite]
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
                    if (groupView.group.children.length === 0) {
                        results = groupView.group.features.map(feature => {
                            return new FeatureTreeViewItem(groupView.tesSuite, feature, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath);
                        });
                    } else {
                        results = groupView.group.children.map(group => {
                            return new ExecutionFolderTreeViewItem(groupView.tesSuite, group, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath);
                        });
                    }
                    break;
                case "FeatureTreeViewItem":
                    const featureView = (element as FeatureTreeViewItem);
                    results = this.getTreeViewItemsForNode(featureView) as vscode.TreeItem[];
                    if (featureView.feature.background) {
                        // Add the background to the feature
                        results.unshift(new BackgroundTreeViewItem(featureView.tesSuite, featureView.feature.background, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath));
                    }
                    break;
                case "BackgroundTreeViewItem":
                    const backgroundView = (element as BackgroundTreeViewItem);
                    results = backgroundView.background.steps.map(step => {
                        // create the display title (can't work out how to get VSCode to not truncate leading spaces)
                        const indent = ["and", "but"].indexOf(step.type) >= 0 ? String.fromCharCode(160).repeat(4) : "";
                        step.displayTitle = `${indent}${step.type} ${step.title}`
                        return new StepTreeViewItem(step, vscode.TreeItemCollapsibleState.None, this.extensionPath);
                    });
                    break;
                case "ScenarioTreeViewItem":
                    const scenarioView = (element as ScenarioTreeViewItem);
                    results = scenarioView.scenario.steps.map(step => {
                        // create the display title (can't work out how to get VSCode to not truncate leading spaces)
                        const indent = ["and", "but"].indexOf(step.type) >= 0 ? String.fromCharCode(160).repeat(4) : "";
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
        let children: livedoc.Scenario[] = [];
        const results = featureView.feature.scenarios.map(scenario => {
            return new ScenarioTreeViewItem(featureView.tesSuite, scenario, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath, {
                command: 'livedoc.navigateToScenarioInReporter',
                title: '',
                arguments: [featureView.tesSuite, scenario]
            });
        });
        return results;
    }

    private buildFeatureGroup(suite: IExecutionModel) {
        const rootFeatureGroup = new FeatureGroup(null, "root");

        suite.executionResults.features.forEach(feature => {
            let activeGroup = rootFeatureGroup;
            const parts = feature.path.split("/");
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
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

        // transfer the children of the root to the top level as results
        suite.results = rootFeatureGroup.children.map(feature => feature);
    }

    // Commands
    public navigateToScenarioInReporterCommand(testSuite: TestSuite, scenario: livedoc.Scenario) {
        vscode.window.showInformationMessage(`(${testSuite.name}) navigate to scenario: ${scenario.title}`);
    }

    public navigateToSummaryInReporterCommand(testSuite: TestSuite) {
        vscode.window.showInformationMessage('navigate to summary page for config: ' + testSuite.name);
    }
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