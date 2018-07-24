import * as livedoc from "livedoc-mocha/model";
import * as vscode from "vscode";
import * as path from 'path';

import { ScenarioStatus } from "./ScenarioStatus";

export class ExecutionResultTreeViewItem extends vscode.TreeItem {
    private icons = {
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