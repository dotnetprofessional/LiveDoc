import { ExecutionResultOutlineProvider } from "./ExecutionResultOutline/ExecutionResultOutlineProvider";
import * as vscode from "vscode";
import { activateTableFormatter, deactivateTableFormatter } from "./tableFormatter";
import { createServer, LiveDocServer } from "@livedoc/server";
import { LiveDocWebSocketClient } from "./WebSocketClient";
import { ViewerPanel } from "./viewer/ViewerPanel";
import { FeatureTreeViewItem, ScenarioTreeViewItem } from "./ExecutionResultOutline/ExecutionResultTreeViewItem";
import * as os from 'os';
import * as path from 'path';

let server: LiveDocServer | null = null;
let wsClient: LiveDocWebSocketClient | null = null;

export async function activate(context: vscode.ExtensionContext) {
    // Start LiveDoc Server
    const outputChannel = vscode.window.createOutputChannel('LiveDoc Server');
    let activePort = 3100;
    try {
        const config = vscode.workspace.getConfiguration('livedoc');
        const port = config.get<number>('server.port', 3100);
        activePort = port;
        const autoStart = config.get<boolean>('server.autoStart', true);

        if (autoStart) {
            server = createServer({ 
                port,
                // Interim mitigation: use a per-process temp data directory so we always start fresh.
                dataDir: path.join(os.tmpdir(), 'livedoc-vscode', String(process.pid)),
                logger: (msg) => outputChannel.appendLine(msg)
            });
            activePort = await server.listen(port);
            outputChannel.appendLine(`LiveDoc server started on port ${activePort}`);
        }
    } catch (error: any) {
        outputChannel.appendLine(`Failed to start server: ${error.message}`);
        vscode.window.showWarningMessage('LiveDoc server failed to start. Some features may be unavailable.');
    }

    // Connect to WebSocket
    const wsUrl = `ws://localhost:${activePort}/ws`;
    wsClient = new LiveDocWebSocketClient(wsUrl, outputChannel);
    wsClient.connect();
    context.subscriptions.push({ dispose: () => wsClient?.dispose() });

    activateTreeView(context, server, activePort, wsClient);
    activateTableFormatter(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('livedoc.openViewer', () => {
            ViewerPanel.createOrShow(context.extensionUri, activePort);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('livedoc.viewItem', (item: any) => {
            ViewerPanel.createOrShow(context.extensionUri, activePort);
            
            if (ViewerPanel.currentPanel) {
                if (item instanceof FeatureTreeViewItem) {
                    ViewerPanel.currentPanel.navigateTo(item.feature.id);
                    return;
                }
                if (item instanceof ScenarioTreeViewItem) {
                    ViewerPanel.currentPanel.navigateTo(item.feature.id, item.scenario.id);
                    return;
                }

                const payload = item as { featureId?: string; scenarioId?: string } | undefined;
                if (payload?.featureId) {
                    ViewerPanel.currentPanel.navigateTo(payload.featureId, payload.scenarioId);
                }
            }
        })
    );
}

export async function deactivate() {
    deactivateTableFormatter();
    if (wsClient) {
        wsClient.dispose();
    }
    if (server) {
        await server.stop();
    }
}

function activateTreeView(context: vscode.ExtensionContext, server: LiveDocServer | null, port: number, wsClient: LiveDocWebSocketClient) {
    const rootPath = vscode.workspace.rootPath;
    const executionResultsProvider = new ExecutionResultOutlineProvider(rootPath || "", context.extensionPath, port);

    wsClient.onEvent((event) => {
        executionResultsProvider.handleEvent(event);
    });

    vscode.window.registerTreeDataProvider('livedoc', executionResultsProvider);
    
    try {
        vscode.commands.registerCommand('livedoc.refreshEntry', () => executionResultsProvider.refresh());
    } catch (e) {
        console.warn("LiveDoc commands already registered");
    }
}

