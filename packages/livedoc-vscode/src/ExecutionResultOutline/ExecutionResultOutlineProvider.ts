import * as livedoc from "livedoc-mocha/model";
import * as livedocConfig from "livedoc-mocha/model/config";

import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

import { ExecutionResultTreeViewItem, ExecutionConfigTreeViewItem, ExecutionFolderTreeViewItem, FeatureTreeViewItem } from "./ExecutionResultTreeViewItem";

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
        let localSuite = new livedocConfig.TestSuite();
        localSuite.name = "unit tests";
        localSuite.path = "build/test/**/*.Spec.js";
        localSuite.executionResults = this.loadModelFromFile(path.join(this.extensionPath, "src/resources/results-fail.json"));
        this.buildFeatureGroup(localSuite as IExecutionModel);

        this.config.testSuites.push(localSuite);

        localSuite = new livedocConfig.TestSuite();
        localSuite.name = "bvt tests";
        localSuite.path = "build/bvt/**/*.Spec.js";
        localSuite.executionResults = this.loadModelFromFile(path.join(this.extensionPath, "src/resources/results.json"))
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
                results.push(new ExecutionConfigTreeViewItem(`${prefix}:${suite.name.toLocaleUpperCase()}`, suite.name, vscode.TreeItemCollapsibleState.Collapsed));
            });
        }
        else {
            switch (element.constructor.name) {
                case "ExecutionConfigTreeViewItem":
                    const configForSuiteMatch = this.config.testSuites.filter(suite => (element as ExecutionConfigTreeViewItem).key == suite.name);
                    if (configForSuiteMatch) {
                        const config = configForSuiteMatch[0] as IExecutionModel;
                        results = config.results.map(group => {
                            return new ExecutionFolderTreeViewItem(group, vscode.TreeItemCollapsibleState.Collapsed);
                        });
                    }
                    break;
                case "ExecutionFolderTreeViewItem":
                    const groupView = (element as ExecutionFolderTreeViewItem);
                    if (groupView.group.children.length === 0) {
                        results = groupView.group.features.map(feature => {
                            return new FeatureTreeViewItem(feature, vscode.TreeItemCollapsibleState.Collapsed);
                        });
                    } else {
                        results = groupView.group.children.map(group => {
                            return new ExecutionFolderTreeViewItem(group, vscode.TreeItemCollapsibleState.Collapsed);
                        });
                    }
                    break;
                case "FeatureTreeViewItem":
                    const featureView = (element as FeatureTreeViewItem);
                    results = this.getTreeViewItemsForNode(featureView.feature) as vscode.TreeItem[];
                    break;
                default:
                    break;
            }

        }
        return results;
    }
    private getTreeViewItemsForNode(node: livedoc.SuiteBase<any>): vscode.ProviderResult<ExecutionResultTreeViewItem[]> {
        const nodeType: string = node.constructor.name;
        let children: livedoc.SuiteBase<any>[] = [];
        switch (node.type) {
            case "Feature":
                children = (node as livedoc.Feature).scenarios;
        }
        const results = children.map(node => {
            return new ExecutionResultTreeViewItem(node, vscode.TreeItemCollapsibleState.None, this.extensionPath);
        });
        return results;
    }

    private buildFeatureGroup(suite: IExecutionModel) {
        const rootFeatureGroup = new FeatureGroup("root");

        suite.executionResults.features.forEach(feature => {
            let activeGroup = rootFeatureGroup;
            const parts = feature.path.split("/");
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const foundGroup = activeGroup.children.filter(f => f.title === part);
                if (foundGroup.length !== 0) { // ie found a group
                    activeGroup = foundGroup[0];
                } else {
                    const group = new FeatureGroup(part);
                    activeGroup.children.push(group);
                    activeGroup = group;
                }
            }
            // At this point we should be at the end of the path with the correct group
            activeGroup.features.push(feature);
        });

        // transfer the children of the root to the top level as results
        suite.results = rootFeatureGroup.children.map(feature => feature);
    }
}

export class FeatureGroup {
    constructor(public title) {

    }
    public children: FeatureGroup[] = [];
    public features: livedoc.Feature[] = [];
}