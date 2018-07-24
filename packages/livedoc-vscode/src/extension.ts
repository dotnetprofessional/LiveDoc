import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import { activateTableFormatter, deactivateTableFormatter } from "./tableFormatter";
import { registerReporter } from "./reporter/register";

export function activate(context: ExtensionContext) {
    activateTableFormatter(context);
    registerReporter(context);
}

export function deactivate() {
    deactivateTableFormatter();
}