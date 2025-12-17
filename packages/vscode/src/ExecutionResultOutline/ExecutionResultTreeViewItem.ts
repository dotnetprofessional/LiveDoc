import * as livedoc from "@livedoc/vitest";
import * as vscode from "vscode";
import * as path from 'path';

import { ScenarioStatus } from "./ScenarioStatus";
import { FeatureGroup, TestSuite } from "./ExecutionResultOutlineProvider";

function toScenarioStatusFromRunStatus(status: unknown): ScenarioStatus {
    const s = String(status || '').trim().toLowerCase();
    switch (s) {
        case 'passed':
        case 'pass':
            return ScenarioStatus.pass;
        case 'failed':
        case 'fail':
            return ScenarioStatus.fail;
        case 'pending':
            return ScenarioStatus.pending;
        case 'skipped':
        case 'skip':
            // VS Code tree currently has no explicit "skip" icon.
            return ScenarioStatus.pending;
        default:
            return ScenarioStatus.unknown;
    }
}

function toScenarioStatusFromStatistics(stats: any): ScenarioStatus {
    if (!stats) {
        return ScenarioStatus.unknown;
    }

    // Support both old in-memory model counters and server API counters.
    const failedCount = Number(stats.failedCount ?? stats.failed ?? 0);
    const passCount = Number(stats.passCount ?? stats.passed ?? 0);
    const pendingCount = Number(stats.pendingCount ?? stats.pending ?? 0);
    const skippedCount = Number(stats.skippedCount ?? stats.skipped ?? 0);

    let status = ScenarioStatus.unknown;

    if (failedCount > 0) {
        status = ScenarioStatus.fail;
    }
    else if (passCount > 0) {
        status = ScenarioStatus.pass;
    }

    // Pending/skipped are additive.
    if (pendingCount > 0 || skippedCount > 0) {
        status |= ScenarioStatus.pending;
    }

    return status;
}


export abstract class ExecutionResultTreeViewItem extends vscode.TreeItem {
    private icons = {
        unknown: "passed.svg",
        pass: "passed.svg",
        fail: "failed.svg",
        pending: "pending.svg",
        passPending: "pending-autorun-light.svg",
        failPending: "failed-faint-autorun-light.svg",
        passFailPending: "failed-faint-autorun-light.svg"
    };

    constructor(public title: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(title, collapsibleState);
    }
    protected annotateNode(status: ScenarioStatus) {
        // TODO: This needs fixing as there are bugs in the way status is calculated
        try {
            const icon = this.icons[ScenarioStatus[status]];
            this.iconPath = path.join(this.extensionPath + "/images/icons/", icon);
        } catch (e) {
            this.iconPath = path.join(this.extensionPath + "/images/icons/", this.icons.unknown);
        }
    }

    protected getStatus(suite: livedoc.SuiteBase<any>): ScenarioStatus {
        const anySuite = suite as any;
        const statsStatus = toScenarioStatusFromStatistics(anySuite?.statistics);
        if (statsStatus !== ScenarioStatus.unknown) {
            return statsStatus;
        }

        // Server JSON objects often provide a single status string (passed/failed/pending).
        return toScenarioStatusFromRunStatus(anySuite?.status);
    }
}

export class ExecutionConfigTreeViewItem extends vscode.TreeItem {
    constructor(public readonly title: string, public readonly key: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState, public readonly command?: vscode.Command) {
        super(title, collapsibleState);
    }
}

/**
 * This tree view item is used to support the virtual tree based on the Feature.path property 
 *
 * @export
 * @class ExecutionFolderTreeViewItem
 * @extends ExecutionResultTreeViewItem
 */
export class ExecutionFolderTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly tesSuite: TestSuite, public readonly group: FeatureGroup, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(group.title, collapsibleState, extensionPath);
        this.annotateNode(group.status);
    }
}

/**
 * This tree view item is used to support Features 
 *
 * @export
 * @class FeatureTreeViewItem
 * @extends ExecutionResultTreeViewItem
 */
export class FeatureTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly tesSuite: TestSuite, public readonly feature: livedoc.Feature, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super("Feature: " + feature.title.split('\n')[0], collapsibleState, extensionPath);
        this.contextValue = 'feature';
        this.tooltip = new vscode.MarkdownString(feature.title);
        // Use a simple number as a "badge"
        this.description = `(${feature.scenarios.length})`;
        this.annotateNode(this.getStatus(feature));
    }
}

/**
 * This tree view item is used to support Features 
 *
 * @export
 * @class ScenarioTreeViewItem
 * @extends ExecutionResultTreeViewItem
 */
export class ScenarioTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly tesSuite: TestSuite, public readonly feature: livedoc.Feature, public readonly scenario: livedoc.Scenario, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super("Scenario: " + scenario.title.split('\n')[0], collapsibleState, extensionPath, command);
        this.contextValue = 'scenario';
        this.tooltip = new vscode.MarkdownString(scenario.title);
        this.annotateNode(this.getStatus(scenario));
    }
}

/**
 * This tree view item is used to support Features 
 *
 * @export
 * @class StepTreeViewItem
 * @extends ExecutionResultTreeViewItem
 */
export class StepTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly step: livedoc.StepDefinition, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(step.displayTitle || `${step.type} ${step.title}`, collapsibleState, extensionPath, command);
        this.annotateNode(toScenarioStatusFromRunStatus((step as any)?.status));
    }
}

/**
 * This tree view item is used to support Feature Backgrounds
 *
 * @export
 * @class StepTreeViewItem
 * @extends ExecutionResultTreeViewItem
 */
export class BackgroundTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly tesSuite: TestSuite, public readonly background: livedoc.Background, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super("Background: " + background.title, collapsibleState, extensionPath, command);
        this.annotateNode(this.getStatus(background));
    }
}