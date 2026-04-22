import * as path from "path";
import * as fs from "fs"
import { ExtensionContext, WebviewPanel } from "vscode";
import * as vscode from "vscode";
import * as model from "@livedoc/vitest";

class ReporterWebView {
    private _webviewPanel: WebviewPanel;
    private _webviewReady: boolean = false;
    private _context: ExtensionContext;
    private _extensionPathResourceRoot: string;
    private _messageQueue: any[] = [];
    private _serializedModel: string;

    public navigateSummary(model: model.ExecutionResults) {
        const data = {
            model
        };
        this.sendMessageToWebview(data);
    }

    public navigateScenario(model: model.ExecutionResults, scenarioId: string) {
        const data = {
            model,
            scenarioId
        };
        this.sendMessageToWebview(data);
    }

    public setExtensionContext(context: ExtensionContext) {
        if (this._context) {
            return;
        }

        this._context = context;
    }

    private ensureWebview() {
        if (this._webviewPanel) {
            return this._webviewPanel;
        }

        this._webviewPanel = vscode.window.createWebviewPanel(
            "livedoc-report",
            "LiveDoc Report",
            {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: false
            },
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(this._context.extensionPath)]
            }
        );

        const indexJsPath = this._webviewPanel.webview.asWebviewUri(vscode.Uri.file(path.join(this._context.extensionPath, "out/reporter/index.js")));
        const bootstrapCssPath = this._webviewPanel.webview.asWebviewUri(vscode.Uri.file(path.join(this._context.extensionPath, "src/resources/css/bootstrap.min.css")));
        const faCssPath = this._webviewPanel.webview.asWebviewUri(vscode.Uri.file(path.join(this._context.extensionPath, "src/resources/fontawesome/css/all.min.css")));
        
        this._extensionPathResourceRoot = this._webviewPanel.webview.asWebviewUri(vscode.Uri.file(this._context.extensionPath)).toString();

        this._webviewPanel.webview.html = `
            <!DOCTYPE html>
            <html lang="en-US">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title></title>
                    <link rel="stylesheet" href="${bootstrapCssPath}" />
                    <link rel="stylesheet" href="${faCssPath}" />
                    <script>
                        window.onerror = function(message, source, lineno, colno, error) {
                            const div = document.createElement('div');
                            div.style.color = 'red';
                            div.style.padding = '20px';
                            div.innerText = 'Error: ' + message + '\\nSource: ' + source + ':' + lineno;
                            document.body.appendChild(div);
                        };
                        console.log("WebView loaded");
                    </script>
                    <script src="${indexJsPath}"></script>
                </head>
                <body>
                    <div id="root"></div>
                    <script>
                        // Check if React mounted
                        setTimeout(() => {
                            const root = document.getElementById('root');
                            if (!root || root.children.length === 0) {
                                const div = document.createElement('div');
                                div.style.color = 'orange';
                                div.style.padding = '20px';
                                div.innerText = 'React app did not mount. Checking scripts...';
                                document.body.appendChild(div);
                            }
                        }, 1000);
                    </script>
                </body>
            </html>
        `;

        this._webviewPanel.webview.onDidReceiveMessage(this.onDidReceiveMessage.bind(this));
        this._webviewPanel.onDidDispose(() => {
            this._webviewPanel = null;
            this._webviewReady = false;
        });
    }

    private onDidReceiveMessage(message: any) {
        if (message === "listening") {
            this._webviewReady = true;
            this.sendMessageToWebview({
                extensionPathRoot: this._extensionPathResourceRoot
            });

            let data;
            const flushQueue = this._messageQueue.reverse();
            while (data = flushQueue.pop()) {
                this.sendMessageToWebview(data);
            }
            this._messageQueue = [];
        }
    }

    private sendMessageToWebview(data: any) {
        this.ensureWebview();
        if (!this._webviewReady) {
            this._messageQueue.push(data);
            return;
        }

        this._webviewPanel.webview.postMessage(data);
    }
}

export const reporterWebview = new ReporterWebView();