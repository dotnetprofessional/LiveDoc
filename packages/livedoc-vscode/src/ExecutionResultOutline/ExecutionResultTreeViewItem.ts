import * as livedoc from "livedoc-mocha/model";
import * as vscode from "vscode";
import * as path from 'path';

import { ScenarioStatus } from "./ScenarioStatus";
import { FeatureGroup } from "./ExecutionResultOutlineProvider";

export class ExecutionResultTreeViewItem extends vscode.TreeItem {
    private icons = {
        unknown: "passed.svg",
        pass: "passed.svg",
        fail: "failed.svg",
        pending: "pending.svg",
        passPending: "pending-autorun-light.svg",
        failPending: "failed-faint-autorun-light.svg"
    };
    constructor(public readonly suite: livedoc.SuiteBase<any>, public readonly collapsibleState: vscode.TreeItemCollapsibleState, private readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(suite.title, collapsibleState);
        this.annotateNode(suite);
    }
    private annotateNode(suite: livedoc.SuiteBase<any>) {
        const status = this.getStatus(suite);
        const icon = this.icons[ScenarioStatus[status]];
        this.iconPath = path.join(this.extensionPath + "/images/icons/", icon);
    }

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
 * @extends {vscode.TreeItem}
 */
export class ExecutionFolderTreeViewItem extends vscode.TreeItem {
    constructor(public readonly group: FeatureGroup, public readonly collapsibleState: vscode.TreeItemCollapsibleState, public readonly command?: vscode.Command) {
        super(group.title, collapsibleState);
    }
    // private annotateNode(suite: livedoc.SuiteBase<any>) {
    //     const status = this.getStatus(suite);
    //     const icon = this.icons[ScenarioStatus[status]];
    //     this.iconPath = path.join(this.extensionPath + "/images/icons/", icon);
    // }
}

/**
 * This tree view item is used to support Features 
 *
 * @export
 * @class FeatureTreeViewItem
 * @extends {vscode.TreeItem}
 */
export class FeatureTreeViewItem extends vscode.TreeItem {
    constructor(public readonly feature: livedoc.Feature, public readonly collapsibleState: vscode.TreeItemCollapsibleState, public readonly command?: vscode.Command) {
        super(feature.title, collapsibleState);
    }
}

/**
 * This tree view item is used to support Features 
 *
 * @export
 * @class FeatureGroupTreeViewItem
 * @extends {vscode.TreeItem}
 */
export class ScenarioTreeViewItem extends vscode.TreeItem {
    constructor(public readonly scenario: livedoc.Scenario, public readonly collapsibleState: vscode.TreeItemCollapsibleState, public readonly command?: vscode.Command) {
        super(scenario.title, collapsibleState);
    }
}