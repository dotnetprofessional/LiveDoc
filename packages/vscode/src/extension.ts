import { ExecutionResultOutlineProvider } from "./ExecutionResultOutline/ExecutionResultOutlineProvider";
import * as vscode from "vscode";
import { activateTableFormatter, deactivateTableFormatter } from "./tableFormatter";
import { createServer, LiveDocServer } from "@livedoc/server";
import { LiveDocWebSocketClient } from "./WebSocketClient";
import { ViewerPanel } from "./viewer/ViewerPanel";
import { NodeTreeViewItem } from "./ExecutionResultOutline/NodeTreeViewItem";
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

let server: LiveDocServer | null = null;
let wsClient: LiveDocWebSocketClient | null = null;
let outputChannel: vscode.OutputChannel | null = null;
let activePort = 3100;

let executionResultsProvider: ExecutionResultOutlineProvider | null = null;
let treeProviderDisposable: vscode.Disposable | null = null;

type LiveDocServerRuntimeConfig = {
    port: number;
    autoStart: boolean;
    dataDir: string;
};

let lastRuntimeConfigKey: string | null = null;
let applyConfigTimer: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('LiveDoc Server');
    context.subscriptions.push(outputChannel);

    ensureTreeView(context);
    await applyRuntimeConfig(context);

    // React to settings changes without requiring an extension reload.
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (!e.affectsConfiguration('livedoc.server')) return;
            if (applyConfigTimer) clearTimeout(applyConfigTimer);
            applyConfigTimer = setTimeout(() => {
                applyConfigTimer = undefined;
                void applyRuntimeConfig(context);
            }, 150);
        })
    );

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
                if (item instanceof NodeTreeViewItem) {
                    ViewerPanel.currentPanel.navigateTo(item.node.id);
                    return;
                }

                const payload = item as { id?: string } | undefined;
                if (payload?.id) ViewerPanel.currentPanel.navigateTo(payload.id);
            }
        })
    );
}

export async function deactivate() {
    deactivateTableFormatter();
    await stopRuntime();
}

function ensureTreeView(context: vscode.ExtensionContext) {
    if (executionResultsProvider) return;

    const rootPath = vscode.workspace.rootPath;
    executionResultsProvider = new ExecutionResultOutlineProvider(rootPath || "", context.extensionPath, activePort);
    treeProviderDisposable = vscode.window.registerTreeDataProvider('livedoc', executionResultsProvider);
    context.subscriptions.push(treeProviderDisposable);

    context.subscriptions.push(
        vscode.commands.registerCommand('livedoc.refreshEntry', () => executionResultsProvider?.refresh())
    );
}

function resolveDataDir(configuredDataDirRaw: string): string {
    const raw = (configuredDataDirRaw || '').trim();
    if (!raw) {
        // Default: ephemeral per-session data directory.
        return path.join(os.tmpdir(), 'livedoc-vscode', String(process.pid));
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const expanded = workspaceFolder
        ? raw.replace(/\$\{workspaceFolder\}/g, workspaceFolder)
        : raw;

    return path.isAbsolute(expanded)
        ? expanded
        : path.resolve(workspaceFolder ?? process.cwd(), expanded);
}

function getRuntimeConfig(): LiveDocServerRuntimeConfig {
    const config = vscode.workspace.getConfiguration('livedoc');
    const port = config.get<number>('server.port', 3100);
    const autoStart = config.get<boolean>('server.autoStart', true);
    const dataDir = resolveDataDir(config.get<string>('server.dataDir', '') || '');
    return { port, autoStart, dataDir };
}

function runtimeKey(cfg: LiveDocServerRuntimeConfig): string {
    return JSON.stringify(cfg);
}

async function applyRuntimeConfig(context: vscode.ExtensionContext) {
    const cfg = getRuntimeConfig();
    const key = runtimeKey(cfg);
    if (lastRuntimeConfigKey === key) return;
    lastRuntimeConfigKey = key;

    // Restart the embedded server to pick up changes (especially dataDir).
    await stopRuntime();

    activePort = cfg.port;
    if (executionResultsProvider) executionResultsProvider.setServerPort(activePort);

    if (!cfg.autoStart) {
        outputChannel?.appendLine('LiveDoc server autoStart=false; server not started.');
        return;
    }

    try {
        try {
            fs.mkdirSync(cfg.dataDir, { recursive: true });
        } catch (e: any) {
            outputChannel?.appendLine(`Failed to create dataDir '${cfg.dataDir}': ${e?.message ?? String(e)}`);
        }

        server = createServer({
            port: cfg.port,
            dataDir: cfg.dataDir,
            logger: (msg) => outputChannel?.appendLine(msg)
        });
        activePort = await server.listen(cfg.port);
        outputChannel?.appendLine(`LiveDoc server started on port ${activePort}`);

        // Connect WebSocket to the (re)started server.
        const wsUrl = `ws://localhost:${activePort}/ws`;
        wsClient = new LiveDocWebSocketClient(wsUrl, outputChannel ?? vscode.window.createOutputChannel('LiveDoc Server'));
        wsClient.onEvent((event) => executionResultsProvider?.handleEvent(event));
        wsClient.connect();

        // Ensure the client is disposed on extension shutdown.
        context.subscriptions.push({ dispose: () => wsClient?.dispose() });

        if (executionResultsProvider) executionResultsProvider.setServerPort(activePort);
    } catch (error: any) {
        outputChannel?.appendLine(`Failed to start server: ${error?.message ?? String(error)}`);
        vscode.window.showWarningMessage('LiveDoc server failed to start. Some features may be unavailable.');
    }
}

async function stopRuntime() {
    if (wsClient) {
        wsClient.dispose();
        wsClient = null;
    }
    if (server) {
        try {
            await server.stop();
        } finally {
            server = null;
        }
    }
}

