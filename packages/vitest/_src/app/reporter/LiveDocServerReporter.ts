import type { Reporter } from 'vitest/reporters';
import type { Vitest } from 'vitest/node';
import { LiveDocViewerReporter } from './LiveDocViewerReporter';
import * as model from '../model/index';
import { SpecStatus } from '../model/SpecStatus';
import { Exception } from '../model/Exception';
import { DescriptionParser } from '../parser/Parser';

/**
 * Vitest Reporter that automatically discovers a LiveDoc server and posts results.
 * This is a convenience wrapper around LiveDocViewerReporter.
 */
export default class LiveDocServerReporter implements Reporter {
    private serverUrl: string | null = null;
    private isAvailable = false;
    private project = "default";
    private environment = "local";

    constructor() {
    }

    async onInit(ctx: Vitest) {
        this.project = ctx.config.name || "default";
        
        // Try to discover server
        try {
            // Use dynamic import to avoid circular dependencies or issues if @livedoc/server is not available
            // @ts-ignore
            const { discoverServer } = await import('@livedoc/server');
            const serverInfo = await discoverServer();
            if (serverInfo) {
                this.serverUrl = serverInfo.url;
                this.isAvailable = true;
            }
        } catch (e) {
            this.isAvailable = false;
        }
    }

    async onTestRunEnd(testModules: readonly any[]): Promise<void> {
        if (!this.isAvailable || !this.serverUrl) return;

        try {
            // Build the SDK model from Vitest tasks
            const results = this.buildExecutionResults(testModules);

            // Use LiveDocViewerReporter to post the results
            const viewerReporter = new LiveDocViewerReporter({
                server: this.serverUrl,
                project: this.project,
                environment: this.environment,
                silent: true
            });

            await viewerReporter.execute(results);
        } catch (e: any) {
            process.stdout.write(`[LiveDoc] Failed to post results: ${e.message}\n`);
        }
    }

    private buildExecutionResults(testModules: readonly any[]): model.ExecutionResults {
        const features: model.Feature[] = [];
        const specifications: model.Specification[] = [];
        const suites: model.VitestSuite[] = [];

        for (const testModule of testModules) {
            const file = testModule.task || testModule;
            const filepath = (file as any).filepath || "";

            for (const task of (file.tasks || [])) {
                if (task.type === 'suite') {
                    if (task.name.startsWith('Feature:')) {
                        features.push(this.buildFeatureFromTask(task, filepath));
                    } else if (task.name.startsWith('Specification:')) {
                        specifications.push(this.buildSpecificationFromTask(task, filepath));
                    } else {
                        suites.push(this.buildTestSuiteFromTask(task, filepath));
                    }
                }
            }
        }

        const results = new model.ExecutionResults();
        results.features = features;
        results.specifications = specifications;
        results.suites = suites;
        return results;
    }

    private buildFeatureFromTask(task: any, filepath: string): model.Feature {
        const parsed = this.parseTitleBlock(task.name.replace('Feature:', '').trim());
        const feature = new model.Feature();
        feature.title = parsed.title;
        feature.description = parsed.description;
        feature.tags = parsed.tags;
        feature.filename = filepath;

        for (const child of (task.tasks || [])) {
            if (child.type === 'suite') {
                if (child.name.startsWith('Scenario:')) {
                    feature.scenarios.push(this.buildScenarioFromTask(child, feature));
                } else if (child.name.startsWith('Scenario Outline:')) {
                    feature.scenarios.push(this.buildScenarioOutlineFromTask(child, feature));
                } else if (child.name.startsWith('Background')) {
                    feature.background = this.buildScenarioFromTask(child, feature);
                }
            }
        }
        return feature;
    }

    private buildScenarioFromTask(task: any, parent: model.Feature): model.Scenario {
        const parsed = this.parseTitleBlock(task.name.replace('Scenario:', '').replace('Background:', '').trim());
        const scenario = new model.Scenario(parent);
        scenario.title = parsed.title;
        scenario.description = parsed.description;
        scenario.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                scenario.steps.push(this.buildStepFromTask(child, scenario));
            }
        }
        return scenario;
    }

    private buildScenarioOutlineFromTask(task: any, parent: model.Feature): model.ScenarioOutline {
        const parsed = this.parseTitleBlock(task.name.replace('Scenario Outline:', '').trim());
        const outline = new model.ScenarioOutline(parent);
        outline.title = parsed.title;
        outline.description = parsed.description;
        outline.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'suite') {
                // Each child suite is an example
                const example = new model.ScenarioExample(parent, outline);
                example.title = child.name;
                for (const stepTask of (child.tasks || [])) {
                    if (stepTask.type === 'test') {
                        example.steps.push(this.buildStepFromTask(stepTask, example));
                    }
                }
                outline.examples.push(example);
            }
        }
        return outline;
    }

    private buildStepFromTask(task: any, parent: any): model.StepDefinition {
        const { keyword, title } = this.parseStepTitle(task.name);

        const step = new model.StepDefinition(parent, title);
        step.rawTitle = title;
        step.type = keyword;
        
        const state = task.result?.state || 'pending';
        step.status = this.mapStateToStatus(state);
        step.duration = task.result?.duration || 0;

        if (task.result?.errors?.length > 0) {
            const ex = new Exception();
            ex.message = task.result.errors[0].message;
            ex.stackTrace = task.result.errors[0].stack;
            step.exception = ex;
        }

        return step;
    }

    private parseStepTitle(rawTitle: string): { keyword: string; title: string } {
        const text = String(rawTitle || '').trim();

        const match = /^(given|when|then|and|but)\b\s*(.*)$/i.exec(text);
        if (!match) {
            return { keyword: 'and', title: text };
        }

        const keyword = match[1].toLowerCase();
        const title = (match[2] || '').trim();
        return { keyword, title: title || text };
    }

    private buildSpecificationFromTask(task: any, filepath: string): model.Specification {
        const parsed = this.parseTitleBlock(task.name.replace('Specification:', '').trim());
        const spec = new model.Specification();
        spec.title = parsed.title;
        spec.description = parsed.description;
        spec.tags = parsed.tags;
        (spec as any).filename = filepath;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test' && child.name.startsWith('Rule:')) {
                const ruleParsed = this.parseTitleBlock(child.name.replace('Rule:', '').trim());
                const rule = new model.Rule(spec);
                rule.title = ruleParsed.title;
                rule.description = ruleParsed.description;
                rule.tags = ruleParsed.tags;
                rule.status = this.mapStateToStatus(child.result?.state);
                rule.executionTime = child.result?.duration || 0;
                spec.rules.push(rule);
            }
        }
        return spec;
    }

    private parseTitleBlock(text: string): { title: string; description: string; tags: string[] } {
        const parser = new DescriptionParser();
        parser.parseDescription(text || '');
        return {
            title: parser.title || '',
            description: parser.description || '',
            tags: parser.tags || []
        };
    }

    private buildTestSuiteFromTask(task: any, filepath: string): model.VitestSuite {
        const suite = new model.VitestSuite(null, task.name, 'suite');
        suite.filename = filepath;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                const test = new model.LiveDocTest<model.VitestSuite>(suite, child.name);
                test.status = this.mapStateToStatus(child.result?.state);
                test.duration = child.result?.duration || 0;
                suite.tests.push(test);
            } else if (child.type === 'suite') {
                suite.children.push(this.buildTestSuiteFromTask(child, filepath));
            }
        }
        return suite;
    }

    private mapStateToStatus(state: string): SpecStatus {
        switch (state) {
            case 'pass': return SpecStatus.pass;
            case 'fail': return SpecStatus.fail;
            case 'skip':
            case 'todo':
            case 'pending': return SpecStatus.pending;
            default: return SpecStatus.unknown;
        }
    }
}
