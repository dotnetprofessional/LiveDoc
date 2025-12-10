import { ExecutionResultOutlineProvider } from "./ExecutionResultOutline/ExecutionResultOutlineProvider";
import * as vscode from "vscode";
import { activateTableFormatter, deactivateTableFormatter } from "./tableFormatter";
import { registerReporter } from "./reporter/register";
import { reporterWebview } from "./reporter/ReporterWebView";
import { createServer, LiveDocServer } from "@livedoc/server";

let server: LiveDocServer | null = null;

export async function activate(context: vscode.ExtensionContext) {
    reporterWebview.setExtensionContext(context);

    // Start LiveDoc Server
    const outputChannel = vscode.window.createOutputChannel('LiveDoc Server');
    let activePort = 19275;
    try {
        const config = vscode.workspace.getConfiguration('livedoc');
        const port = config.get<number>('server.port', 19275);
        activePort = port;
        const autoStart = config.get<boolean>('server.autoStart', true);

        if (autoStart) {
            server = createServer({ 
                port,
                logger: (msg) => outputChannel.appendLine(msg)
            });
            activePort = await server.listen(port);
            outputChannel.appendLine(`LiveDoc server started on port ${activePort}`);
        }
    } catch (error: any) {
        outputChannel.appendLine(`Failed to start server: ${error.message}`);
        vscode.window.showWarningMessage('LiveDoc server failed to start. Some features may be unavailable.');
    }

    activateTreeView(context, server, activePort);
    activateTableFormatter(context);
    registerReporter(context);
}

export async function deactivate() {
    deactivateTableFormatter();
    if (server) {
        await server.stop();
    }
}

function activateTreeView(context: vscode.ExtensionContext, server: LiveDocServer | null, port: number) {
    const rootPath = vscode.workspace.rootPath;
    const executionResultsProvider = new ExecutionResultOutlineProvider(rootPath || "", context.extensionPath, port);

    if (server) {
        server.on('run:started', () => {
            console.log('LiveDoc: run:started event received');
            executionResultsProvider.refresh();
        });
        server.on('run:updated', () => {
            console.log('LiveDoc: run:updated event received');
            executionResultsProvider.refresh();
        });
    }

    vscode.window.registerTreeDataProvider('livedoc', executionResultsProvider);
    
    try {
        vscode.commands.registerCommand('livedoc.navigateToScenarioInReporter', (testSuite, item) => executionResultsProvider.navigateToScenarioInReporterCommand(testSuite, item));
        vscode.commands.registerCommand('livedoc.navigateToSummaryInReporterCommand', item => executionResultsProvider.navigateToSummaryInReporterCommand(item));
        vscode.commands.registerCommand('livedoc.refreshEntry', () => executionResultsProvider.refresh());
    } catch (e) {
        console.warn("LiveDoc commands already registered");
    }
}

