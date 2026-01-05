import * as vscode from 'vscode';
import * as path from 'path';

export class ViewerPanel {
  public static currentPanel: ViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _serverPort: number;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, serverPort: number) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._serverPort = serverPort;

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'alert':
            vscode.window.showErrorMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri, serverPort: number) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ViewerPanel.currentPanel) {
      ViewerPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'livedocViewer',
      'LiveDoc Viewer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist', 'viewer')
        ],
        retainContextWhenHidden: true
      }
    );

    ViewerPanel.currentPanel = new ViewerPanel(panel, extensionUri, serverPort);
  }

  public navigateTo(nodeId: string) {
    this._panel.webview.postMessage({
        command: 'navigate',
        nodeId
    });
  }

  public dispose() {
    ViewerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.title = 'LiveDoc Viewer';
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'viewer', 'index.js');
    const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

    const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist', 'viewer', 'index.css');
    const styleUri = webview.asWebviewUri(stylePathOnDisk);

    const nonce = getNonce();

    // Inject configuration
    const config = {
        serverUrl: `http://localhost:${this._serverPort}`,
        mode: 'embedded'
    };

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src ws: http:;">
        <link href="${styleUri}" rel="stylesheet">
        <title>LiveDoc Viewer</title>
        <script nonce="${nonce}">
            window.__LIVEDOC_CONFIG__ = ${JSON.stringify(config)};
        </script>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
