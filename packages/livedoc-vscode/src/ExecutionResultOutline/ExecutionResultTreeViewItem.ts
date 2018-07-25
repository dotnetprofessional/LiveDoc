import * as livedoc from "livedoc-mocha/model";
import * as vscode from "vscode";
import * as path from 'path';

import { ScenarioStatus } from "./ScenarioStatus";
import { FeatureGroup } from "./ExecutionResultOutlineProvider";


export abstract class ExecutionResultTreeViewItem extends vscode.TreeItem {
    private icons = {
        unknown: "passed.svg",
        pass: "passed.svg",
        fail: "failed.svg",
        pending: "pending.svg",
        passPending: "pending-autorun-light.svg",
        failPending: "failed-faint-autorun-light.svg"
    };

    constructor(public title: string, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(title, collapsibleState);
    }
    protected annotateNode(status: ScenarioStatus) {
        const icon = this.icons[ScenarioStatus[status]];
        this.iconPath = path.join(this.extensionPath + "/images/icons/", icon);
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
 * @extends {vscode.TreeItem}
 */
export class ExecutionFolderTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly group: FeatureGroup, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(group.title, collapsibleState, extensionPath);
        this.annotateNode(group.status);
    }
}

/**
 * This tree view item is used to support Features 
 *
 * @export
 * @class FeatureTreeViewItem
 * @extends {vscode.TreeItem}
 */
export class FeatureTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly feature: livedoc.Feature, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(feature.title, collapsibleState, extensionPath);
        this.annotateNode(this.getStatus(feature));
    }
}

/**
 * This tree view item is used to support Features 
 *
 * @export
 * @class FeatureGroupTreeViewItem
 * @extends {vscode.TreeItem}
 */
export class ScenarioTreeViewItem extends ExecutionResultTreeViewItem {
    constructor(public readonly scenario: livedoc.Scenario, public readonly collapsibleState: vscode.TreeItemCollapsibleState, protected readonly extensionPath: string, public readonly command?: vscode.Command) {
        super(scenario.title, collapsibleState, extensionPath, command);
        this.annotateNode(this.getStatus(scenario));
    }
}