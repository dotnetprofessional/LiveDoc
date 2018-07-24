import * as path from "path";
import * as fs from "fs"
import { ExtensionContext } from "vscode";
import * as vscode from "vscode";

export function registerReporter(context: ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand("webview.start", () => {
        const panel = vscode.window.createWebviewPanel(
            "livedoc-report",
            "LiveDoc Report",
            {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: false
            },
            {
                enableScripts: true
            }
        );

        const indexJsPath = vscode.Uri.file(path.join(context.extensionPath, "out/reporter/index.js")).with({ scheme: "vscode-resource" });

        panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en-US">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title></title>
                    <script src="${indexJsPath}"></script>
                </head>
                <body>
                    <div></div>
                </body>
            </html>
        `;

        panel.webview.onDidReceiveMessage(message => {
            if (message === "listening") {
                const model = fs.readFileSync(path.join(context.extensionPath, "out", "testResources", "results.json"), "utf8");
                panel.webview.postMessage(model);
            }
        });
    }));
}