import * as livedoc from "livedoc-mocha/model";
import * as vscode from "vscode";
import * as fs from 'fs';
import * as path from 'path';

import { ExecutionResultTreeViewItem } from "./ExecutionResultTreeViewItem";

export class ExecutionResultOutlineProvider implements vscode.TreeDataProvider<ExecutionResultTreeViewItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ExecutionResultTreeViewItem | undefined> = new vscode.EventEmitter<ExecutionResultTreeViewItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ExecutionResultTreeViewItem | undefined> = this._onDidChangeTreeData.event;
    private static executionResults: livedoc.ExecutionResults;
    constructor(private rootPath: string, private extensionPath: string) {
    }
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }
    public getTreeItem(element: ExecutionResultTreeViewItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
    public getChildren(element?: ExecutionResultTreeViewItem): vscode.ProviderResult<ExecutionResultTreeViewItem[]> {
        if (!ExecutionResultOutlineProvider.executionResults) {
            //const dataPath = path.join(this.extensionPath, "src/resources/results.json");
            const dataPath = path.join(this.extensionPath, "src/resources/results-fail.json");
            const executionResultsText = fs.readFileSync(dataPath, 'utf8');
            ExecutionResultOutlineProvider.executionResults = JSON.parse(executionResultsText);
        }
        // Now create the tree view items from the results
        // as no element is defined return the top level results
        let results: ExecutionResultTreeViewItem[] = [];
        if (!element) {
            results = ExecutionResultOutlineProvider.executionResults.features.map(node => {
                return new ExecutionResultTreeViewItem(node, vscode.TreeItemCollapsibleState.Collapsed, this.extensionPath);
            });
        }
        else {
            return this.getTreeViewItemsForNode(element.suite);
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
}