import * as vscode from "vscode";
import * as path from 'path';
import { Node, Container, Outline, Status, Statistics } from "@livedoc/schema";

export enum ScenarioStatus {
    unknown = 0,
    pass = 1,
    fail = 2,
    pending = 4
}

function toScenarioStatus(status: Status): ScenarioStatus {
    switch (status) {
        case 'passed':
            return ScenarioStatus.pass;
        case 'failed':
            return ScenarioStatus.fail;
        case 'pending':
        case 'running':
        case 'skipped':
        case 'timedOut':
        case 'cancelled':
            return ScenarioStatus.pending;
        default:
            return ScenarioStatus.unknown;
    }
}

function toScenarioStatusFromStats(stats?: Statistics): ScenarioStatus {
    if (!stats) return ScenarioStatus.unknown;
    if (stats.failed > 0) return ScenarioStatus.fail;
    if (stats.passed > 0) return ScenarioStatus.pass;
    if (stats.pending > 0 || stats.skipped > 0) return ScenarioStatus.pending;
    return ScenarioStatus.unknown;
}

export class NodeTreeViewItem extends vscode.TreeItem {
    private icons = {
        unknown: "passed.svg",
        pass: "passed.svg",
        fail: "failed.svg",
        pending: "pending.svg",
    };

    constructor(
        public readonly node: Node,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        protected readonly extensionPath: string,
        public readonly command?: vscode.Command
    ) {
        super(NodeTreeViewItem.getLabel(node), collapsibleState);
        
        this.contextValue = node.kind.toLowerCase();
        this.tooltip = new vscode.MarkdownString(node.description || node.title);
        
        if ('summary' in node) {
            const container = node as Container;
            const status = container.summary.failed > 0 ? ScenarioStatus.fail : 
                          container.summary.passed > 0 ? ScenarioStatus.pass : 
                          ScenarioStatus.pending;
            this.annotateNode(status);
            
            const total = container.summary.total;
            if (total > 0) {
                this.description = `(${total})`;
            }
        } else {
            this.annotateNode(toScenarioStatus(node.execution.status));
        }
    }

    private static getLabel(node: Node): string {
        const title = node.title.split('\n')[0];
        switch (node.kind) {
            case 'Feature': return `Feature: ${title}`;
            case 'Scenario': return `Scenario: ${title}`;
            case 'ScenarioOutline': return `Outline: ${title}`;
            case 'Specification': return `Spec: ${title}`;
            case 'Rule': return `Rule: ${title}`;
            case 'Step': return title; // Steps usually have keyword in title or we can add it
            case 'Suite': return title;
            case 'Test': return title;
            default: return title;
        }
    }

    protected annotateNode(status: ScenarioStatus) {
        const iconName = status === ScenarioStatus.fail ? "fail" :
                         status === ScenarioStatus.pass ? "pass" :
                         status === ScenarioStatus.pending ? "pending" : "unknown";
        
        const icon = this.icons[iconName];
        this.iconPath = path.join(this.extensionPath, "images", "icons", icon);
    }
}
