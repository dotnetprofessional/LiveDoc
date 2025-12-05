import type { Reporter, File, Vitest, Task } from 'vitest';

/**
 * A silent reporter that produces no output but captures errors.
 * Used for dynamic test execution where we don't want any console output.
 * Implements the Vitest Reporter interface.
 */
export default class SilentReporter implements Reporter {
    public collectedErrors: Error[] = [];
    public collectedFiles: File[] = [];
    
    onInit(_ctx: Vitest) {}
    
    onPathsCollected() {}
    
    onCollected(files?: File[]) {
        if (files) {
            this.collectedFiles = files;
            // Check for errors in collected files
            for (const file of files) {
                if (file.result?.errors) {
                    this.collectedErrors.push(...file.result.errors as Error[]);
                }
            }
        }
    }
    
    onFinished(files?: File[], errors?: unknown[]) {
        if (files) {
            this.collectedFiles = files;
        }
        if (errors) {
            this.collectedErrors.push(...errors.map(e => e instanceof Error ? e : new Error(String(e))));
        }
    }
    
    onTaskUpdate(_packs: [string, Task | undefined][]) {}
    onTestRemoved() {}
    onWatcherStart() {}
    onWatcherRerun() {}
    onServerRestart() {}
    onUserConsoleLog() {}
    onProcessTimeout() {}
}
