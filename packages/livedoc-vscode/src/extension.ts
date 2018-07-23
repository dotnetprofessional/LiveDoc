import { ExtensionContext } from "vscode";
import { activateTableFormatter, deactivateTableFormatter } from "./tableFormatter";

export function activate(context: ExtensionContext) {
    activateTableFormatter(context);
}

export function deactivate() {
    deactivateTableFormatter();
}