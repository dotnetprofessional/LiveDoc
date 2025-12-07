import type { Reporter } from "vitest/reporters";
import type { File, TaskResultPack, Task } from "@vitest/runner";
import chalk from "chalk";

/**
 * LiveDoc reporter for Vitest
 * Provides Gherkin-style output for BDD tests
 */
export default class LiveDocVitestReporter implements Reporter {
    onInit(_ctx: any) {
        // Initialization hook
    }

    onCollected(_files?: File[]) {
        // Called when tests are collected
    }

    onTaskUpdate(_packs: TaskResultPack[]): void {
        // Called when task status updates
    }

    onFinished(files?: File[], errors?: unknown[]) {
        // Output final summary
        this.writeLine("");
        this.writeLine(chalk.bold("LiveDoc Test Summary"));
        this.writeLine("─".repeat(80));
        
        if (files) {
            let totalFeatures = 0;
            let totalScenarios = 0;
            let totalSteps = 0;
            let passedSteps = 0;
            let failedSteps = 0;
            let skippedSteps = 0;

            files.forEach(file => {
                this.processFile(file, (stats) => {
                    totalFeatures += stats.features;
                    totalScenarios += stats.scenarios;
                    totalSteps += stats.steps;
                    passedSteps += stats.passed;
                    failedSteps += stats.failed;
                    skippedSteps += stats.skipped;
                });
            });

            this.writeLine(chalk.green(`✓ ${passedSteps} steps passed`));
            if (failedSteps > 0) {
                this.writeLine(chalk.red(`✗ ${failedSteps} steps failed`));
            }
            if (skippedSteps > 0) {
                this.writeLine(chalk.yellow(`⊘ ${skippedSteps} steps skipped`));
            }
            this.writeLine(chalk.gray(`  ${totalFeatures} features, ${totalScenarios} scenarios, ${totalSteps} total steps`));
        }

        if (errors && errors.length > 0) {
            this.writeLine("");
            this.writeLine(chalk.red.bold("Errors:"));
            errors.forEach(error => {
                this.writeLine(chalk.red(String(error)));
            });
        }
    }

    private processFile(file: File, callback: (stats: any) => void) {
        const stats = {
            features: 0,
            scenarios: 0,
            steps: 0,
            passed: 0,
            failed: 0,
            skipped: 0
        };

        const processTask = (task: Task, depth: number = 0) => {
            if (task.type === "suite") {
                if (task.name.startsWith("Feature:") || !task.name.includes(":")) {
                    stats.features++;
                }
                if (task.name.startsWith("Scenario:")) {
                    stats.scenarios++;
                }
                
                if (task.tasks) {
                    task.tasks.forEach((t: Task) => processTask(t, depth + 1));
                }
            } else if (task.type === "test") {
                stats.steps++;
                if (task.result?.state === "pass") {
                    stats.passed++;
                } else if (task.result?.state === "fail") {
                    stats.failed++;
                } else if (task.result?.state === "skip") {
                    stats.skipped++;
                }
            }
        };

        if (file.tasks) {
            file.tasks.forEach(task => processTask(task));
        }

        callback(stats);
    }

    private writeLine(text: string) {
        console.log(text);
    }
}
