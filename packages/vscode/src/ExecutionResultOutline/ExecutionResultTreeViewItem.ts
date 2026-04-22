import * as vscode from "vscode";

export class ExecutionConfigTreeViewItem extends vscode.TreeItem {
    constructor(public readonly title: string, public readonly key: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState, public readonly command?: vscode.Command) {
        super(title, collapsibleState);
    }
}

export abstract class ExecutionResultTreeViewItem extends vscode.TreeItem {
    constructor(public title: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(title, collapsibleState);
    }
}

