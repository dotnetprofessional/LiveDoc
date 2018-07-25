import { ExecutionResultOutlineProvider } from "./ExecutionResultOutline/ExecutionResultOutlineProvider";

import * as vscode from "vscode";
import { activateTableFormatter, deactivateTableFormatter } from "./tableFormatter";
import "livedoc-mocha";
import { registerReporter } from "./reporter/register";

export function activate(context: vscode.ExtensionContext) {
    activateTreeView(context);
    activateTableFormatter(context);
    registerReporter(context);
}

export function deactivate() {
    deactivateTableFormatter();
}

function activateTreeView(context: vscode.ExtensionContext) {
    const rootPath = vscode.workspace.rootPath;
    const executionResultsProvider = new ExecutionResultOutlineProvider(rootPath, context.extensionPath);

    vscode.window.registerTreeDataProvider('livedoc', executionResultsProvider);
    vscode.commands.registerCommand('livedoc.navigateToScenarioInReporter', (testSuite, item) => executionResultsProvider.navigateToScenarioInReporterCommand(testSuite, item));
    vscode.commands.registerCommand('livedoc.navigateToSummaryInReporterCommand', item => executionResultsProvider.navigateToSummaryInReporterCommand(item));
    vscode.commands.registerCommand('livedoc.refreshEntry', () => executionResultsProvider.refresh());
};

