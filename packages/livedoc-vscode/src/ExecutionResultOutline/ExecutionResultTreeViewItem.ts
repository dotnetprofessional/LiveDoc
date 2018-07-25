import * as livedoc from "livedoc-mocha/model";
import * as vscode from "vscode";
import * as path from 'path';

import { ScenarioStatus } from "./ScenarioStatus";
import { FeatureGroup } from "./ExecutionResultOutlineProvider";
import { TestSuite } from "../../node_modules/livedoc-mocha/model/config";


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
        super("Feature: " + feature.title, collapsibleState, extensionPath);
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
    constructor(public readonly tesSuite: TestSuite, public readonly scenario: livedoc.Scenario, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super("Scenario: " + scenario.title, collapsibleState, extensionPath, command);
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
        super(step.displayTitle, collapsibleState, extensionPath, command);
        const stepStatus = step.status as string;
        const scenarioStatus = ScenarioStatus[stepStatus];
        this.annotateNode(scenarioStatus);
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