import * as vscode from "vscode";
import * as path from 'path';
import type { AnyTest, Status, Statistics, TestCase } from "@livedoc/schema";

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
        public readonly node: TestCase | AnyTest,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        protected readonly extensionPath: string,
        public readonly command?: vscode.Command
    ) {
        super(NodeTreeViewItem.getLabel(node), collapsibleState);

        this.contextValue = this.getContextValue(node);
        this.tooltip = new vscode.MarkdownString((node as any).description || node.title);

        if (this.isTestCase(node)) {
            this.annotateNode(toScenarioStatusFromStats(node.statistics));
            const total = node.statistics?.total ?? 0;
            if (total > 0) this.description = `(${total})`;
        } else {
            this.annotateNode(toScenarioStatus(node.execution.status));

            // Outlines are expandable; show example count to make it obvious.
            if (node.kind === 'ScenarioOutline' || node.kind === 'RuleOutline') {
                const total = (node as any)?.statistics?.total;
                if (typeof total === 'number' && total > 0) {
                    this.description = `(${total})`;
                }
            }
        }
    }

    private static getLabel(node: TestCase | AnyTest): string {
        const title = node.title.split('\n')[0];

        if ((node as any).style) {
            const doc = node as TestCase;
            switch (doc.style) {
                case 'Feature':
                    return `Feature: ${title}`;
                case 'Specification':
                    return `Spec: ${title}`;
                case 'Container':
                    return title;
                default:
                    return title;
            }
        }

        const test = node as AnyTest;
        switch (test.kind) {
            case 'Scenario':
                return `Scenario: ${title}`;
            case 'ScenarioOutline':
                return `Outline: ${title}`;
            case 'Rule':
                return `Rule: ${title}`;
            case 'RuleOutline':
                return `Rule Outline: ${title}`;
            case 'Step':
                return title;
            case 'Test':
            default:
                return title;
        }
    }

    private isTestCase(node: TestCase | AnyTest): node is TestCase {
        return (node as any)?.style !== undefined;
    }

    private getContextValue(node: TestCase | AnyTest): string {
        if (this.isTestCase(node)) return String(node.style || 'document').toLowerCase();
        return String((node as AnyTest).kind || 'test').toLowerCase();
    }

    protected annotateNode(status: ScenarioStatus) {
        const iconName = status === ScenarioStatus.fail ? "fail" :
                         status === ScenarioStatus.pass ? "pass" :
                         status === ScenarioStatus.pending ? "pending" : "unknown";
        
        const icon = this.icons[iconName];
        this.iconPath = path.join(this.extensionPath, "images", "icons", icon);
    }
}
