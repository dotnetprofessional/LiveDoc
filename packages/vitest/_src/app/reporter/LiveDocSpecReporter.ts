import type { Reporter } from 'vitest/reporters';
import type { Vitest } from 'vitest/node';
import { LiveDocSpec, LiveDocReporterOptions } from './LiveDocSpec';
import { DefaultColorTheme } from './ColorTheme';
import { LiveDocReporter } from './LiveDocReporter';
import { LiveDocViewerReporter } from './LiveDocViewerReporter';
import { livedoc } from '../livedoc';
import * as model from '../model/index';
import { DescriptionParser } from '../parser/Parser';
import type { File, Task, TaskResultPack } from '@vitest/runner';

/**
 * Vitest Reporter that provides enhanced BDD output using LiveDocSpec
 * Follows the pattern from JUnitReporter and SummaryReporter
 */
export default class LiveDocSpecReporter implements Reporter {
    private liveDocSpec: LiveDocSpec;
    private options: LiveDocReporterOptions;

    private streamEnabled = true;
    private taskById = new Map<string, Task>();
    private streamedStates = new Map<string, string>();

    constructor(options: any = {}) {
        this.options = new LiveDocReporterOptions();

        const env = process.env.LIVEDOC_SPEC_STREAMING;
        if (env !== undefined) {
            this.streamEnabled = !(env === '0' || env.toLowerCase() === 'false');
        }
        
        // Parse options from Vitest reporter options
        if (options.detailLevel) {
            const userOptions = options.detailLevel.split("+");
            this.options.output = options.output || "";
            userOptions.forEach((option: string) => {
                (this.options as any)[option] = true;
            });
            if (this.options.silent) {
                this.options.enableSilent();
            }
        } else {
            // Default configuration
            this.options.setDefaults();
        }

        // If publish options are passed directly, update the livedoc singleton
        if (options.publish) {
            livedoc.options.publish.enabled = options.publish.enabled ?? livedoc.options.publish.enabled;
            livedoc.options.publish.server = options.publish.server ?? livedoc.options.publish.server;
            livedoc.options.publish.project = options.publish.project ?? livedoc.options.publish.project;
            livedoc.options.publish.environment = options.publish.environment ?? livedoc.options.publish.environment;
        }

        this.options.removeHeaderText = options.removeHeaderText || "";

        // Store all options for post-reporters
        (this.options as any).postReporters = options.postReporters || [];
        (this.options as any).rawOptions = options;

        // Create LiveDocSpec instance with color theme
        const useColors = options.colors !== false;
        this.liveDocSpec = new LiveDocSpec(DefaultColorTheme, useColors);
        this.setLiveDocOptions(this.options);
    }

    onInit(ctx: Vitest): void {
        // Store context for potential future use
        void ctx;
        this.liveDocSpec.executionStart();

        // Output start message if publishing is enabled
        if (livedoc.options.publish.enabled) {
            const publishOptions = livedoc.options.publish;
            console.log(`\nLiveDoc Viewer: Connecting to ${publishOptions.server}...`);
            console.log(`  Project:     ${publishOptions.project}`);
            console.log(`  Environment: ${publishOptions.environment}\n`);
        }
    }

    onCollected(files?: File[]): void {
        if (!this.streamEnabled) return;

        this.taskById.clear();
        this.streamedStates.clear();

        const index = (task: Task) => {
            if (task?.id) this.taskById.set(task.id, task);
            for (const child of (task.tasks || []) as Task[]) {
                index(child);
            }
        };

        for (const file of files || []) {
            for (const t of (file.tasks || []) as Task[]) {
                index(t);
            }
        }
    }

    onTaskUpdate(packs: TaskResultPack[]): void {
        if (!this.streamEnabled) return;

        for (const pack of packs || []) {
            const normalized = this.normalizeTaskResultPack(pack);
            if (!normalized) continue;

            const { taskId, result } = normalized;
            const state = String(result?.state || '');
            if (!state) continue;

            // Avoid duplicate prints for the same state.
            const prev = this.streamedStates.get(taskId);
            if (prev === state) continue;
            this.streamedStates.set(taskId, state);

            // Only stream "leaf" task completions (tests/steps), not suite churn.
            if (state !== 'pass' && state !== 'fail' && state !== 'skip' && state !== 'todo') continue;

            const task = this.taskById.get(taskId);
            if (!task || task.type !== 'test') continue;

            const symbol = state === 'pass' ? '√' : state === 'fail' ? 'X' : '-';
            const indent = this.computeIndent(task);
            console.log(`${indent}${symbol} ${task.name}`);
        }
    }

    private normalizeTaskResultPack(pack: unknown): { taskId: string; result: any } | null {
        // Vitest's TaskResultPack shape is a tuple: [id, result, meta]
        if (Array.isArray(pack)) {
            const taskId = typeof pack[0] === 'string' ? pack[0] : undefined;
            const result = pack.length >= 2 ? (pack as any)[1] : undefined;
            if (!taskId) return null;
            return { taskId, result };
        }

        const obj = pack as any;
        const taskId = (obj?.id ?? obj?.taskId) as string | undefined;
        if (!taskId) return null;
        return { taskId, result: obj?.result };
    }

    private computeIndent(task: Task): string {
        // TaskBase.suite points to parent suite; use it to indent steps.
        let depth = 0;
        let current: any = (task as any).suite;
        while (current) {
            // Don't count the file task (no suite) and avoid infinite loops.
            depth++;
            current = current.suite;
            if (depth > 20) break;
        }
        return ' '.repeat(Math.max(0, depth) * 2);
    }

    async onTestRunEnd(testModules: readonly any[]): Promise<void> {
        // Build features and specifications from the test module task tree
        const features: model.Feature[] = [];
        const specifications: model.Specification[] = [];
        const suites: model.VitestSuite[] = [];
        
        for (const testModule of testModules) {
            const file = testModule.task;
            
            // Each top-level suite should be a feature, specification, or regular suite
            for (const suite of (file.tasks || [])) {
                if (suite.type === 'suite') {
                    // Check if this is a Specification
                    if (suite.name.startsWith('Specification:')) {
                        const specification = this.buildSpecificationFromSuite(suite, file.filepath);
                        specifications.push(specification);
                    } 
                    // Check if this is a Feature
                    else if (suite.name.startsWith('Feature:')) {
                        const feature = this.buildFeatureFromSuite(suite, file.filepath);
                        features.push(feature);
                    }
                    // Otherwise treat as a regular suite (describe block)
                    else {
                        const vitestSuite = this.buildVitestSuiteFromTask(suite, file.filepath);
                        suites.push(vitestSuite);
                    }
                }
            }
        }
        
        // Build execution results
        const results = new model.ExecutionResults();
        results.features = features;
        results.specifications = specifications;
        results.suites = suites;

        // Calculate paths for features
        if (results.features.length > 0) {
            const featureRoot = LiveDocReporter.findRootPath(results.features.map(f => f.filename));
            results.features.forEach(feature => {
                feature.path = this.createPathFromFile(feature.filename, featureRoot);
            });
        }

        // Calculate paths for specifications
        if (results.specifications.length > 0) {
            const specRoot = LiveDocReporter.findRootPath(results.specifications.map(s => s.filename));
            results.specifications.forEach(spec => {
                spec.path = this.createPathFromFile(spec.filename, specRoot);
            });
        }

        // Calculate paths for suites
        if (results.suites.length > 0) {
            const suiteRoot = LiveDocReporter.findRootPath(results.suites.map(s => s.filename));
            results.suites.forEach(suite => {
                suite.path = this.createPathFromFile(suite.filename, suiteRoot);
            });
        }

        // Add publish reporter if enabled in global options
        if (livedoc.options.publish.enabled) {
            const publishOptions = livedoc.options.publish;
            const viewerReporter = new LiveDocViewerReporter({
                server: publishOptions.server,
                project: publishOptions.project,
                environment: publishOptions.environment,
                silent: false
            });
            
            // Ensure postReporters exists on rawOptions
            const rawOptions = (this.options as any).rawOptions || {};
            if (!rawOptions.postReporters) {
                rawOptions.postReporters = [];
            }
            rawOptions.postReporters.push(viewerReporter);
        }

        // Output execution results with post-reporter support
        await this.liveDocSpec.executionEnd(results, (this.options as any).rawOptions);
    }
    
    private buildFeatureFromSuite(suite: any, filepath: string): model.Feature {
        const feature = new model.Feature();

        const parsed = this.parseTitleBlock(String(suite?.name ?? '').replace(/^Feature:\s*/i, ''));
        feature.title = parsed.title;
        feature.description = parsed.description;
        feature.tags = parsed.tags;
        feature.filename = filepath;
        
        // Process tasks - detect backgrounds, scenarios, and scenario outlines.
        // IMPORTANT: build the Background first so Scenario.addStep() can validate
        // mustIncludeGiven against background givens during reconstruction.
        const tasks = (suite.tasks || []).filter((t: any) => t?.type === 'suite');

        const backgroundSuite = tasks.find((t: any) => typeof t?.name === 'string' && t.name.startsWith('Background:'));
        if (backgroundSuite) {
            feature.background = this.buildBackgroundFromSuite(backgroundSuite, feature);
        }

        for (const task of tasks) {
            // Skip background suite (already processed)
            if (task === backgroundSuite) continue;

            // Check if this is a scenario (starts with "Scenario:")
            if (typeof task.name === 'string' && task.name.startsWith('Scenario:')) {
                // Check if this scenario has child suites that are examples (Scenario Outline structure)
                const exampleSuites = (task.tasks || []).filter((t: any) =>
                    t.type === 'suite' && t.name.startsWith('Example ')
                );

                if (exampleSuites.length > 0) {
                    // This is a Scenario Outline with nested examples
                    const scenarioOutline = this.buildScenarioOutlineFromNestedStructure(task, feature);
                    feature.scenarios.push(scenarioOutline);
                } else {
                    // This is a regular Scenario
                    const scenario = this.buildScenarioFromSuite(task, feature);
                    feature.scenarios.push(scenario);
                }
            }
        }
        
        return feature;
    }
    
    private buildScenarioOutlineFromNestedStructure(suite: any, feature: model.Feature): model.ScenarioOutline {
        const scenarioOutline = new model.ScenarioOutline(feature);

        // Determine outline title/description/tags from suite name (Vitest describes this as "Scenario: <title>")
        const parsed = this.parseTitleBlock(String(suite?.name ?? '').replace(/^Scenario:\s*/i, ''));
        const outlineTitle = parsed.title;
        scenarioOutline.title = parsed.title;
        scenarioOutline.description = parsed.description;
        scenarioOutline.tags = parsed.tags;
        
        // Get example suites
        const exampleSuites = (suite.tasks || []).filter((t: any) => 
            t.type === 'suite' && t.name.startsWith('Example ')
        );

        // Single source of truth: use task.meta.livedoc payload emitted by livedoc.ts.
        const firstExampleSuite = exampleSuites[0];
        const firstExampleLiveDoc = this.findFirstLiveDocStepMetaInSuite(firstExampleSuite);
        if (!firstExampleLiveDoc || firstExampleLiveDoc.kind !== 'step') {
            throw new Error(
                `Scenario Outline metadata missing (expected task.meta.livedoc on example steps). Outline: "${outlineTitle}"`
            );
        }

        const metaTables = firstExampleLiveDoc?.scenarioOutline?.tables;
        if (!Array.isArray(metaTables) || metaTables.length === 0) {
            throw new Error(
                `Scenario Outline tables missing in task.meta.livedoc. Outline: "${outlineTitle}"`
            );
        }

        scenarioOutline.tables = this.buildScenarioOutlineTablesFromMeta(metaTables);
        if (Array.isArray(firstExampleLiveDoc?.scenarioOutline?.tags)) {
            scenarioOutline.tags = firstExampleLiveDoc.scenarioOutline.tags;
        }
        if (typeof firstExampleLiveDoc?.scenarioOutline?.description === 'string') {
            scenarioOutline.description = firstExampleLiveDoc.scenarioOutline.description;
        }
        
        // Build template steps from the first example's step definitions
        if (exampleSuites.length > 0 && exampleSuites[0].tasks) {
            for (const task of exampleSuites[0].tasks) {
                if (task.type === 'test') {
                    const livedocMeta = this.getLiveDocMetaFromTask(task);
                    if (
                        typeof livedocMeta?.step?.rawTitle !== 'string' ||
                        typeof livedocMeta?.step?.type !== 'string'
                    ) {
                        throw new Error(
                            `Scenario Outline step template metadata missing (expected livedoc.step.rawTitle/type). Outline: "${outlineTitle}" Step: "${task.name}"`
                        );
                    }
                    const step = new model.StepDefinition(scenarioOutline, "");
                    step.rawTitle = livedocMeta.step.rawTitle;
                    step.type = livedocMeta.step.type;
                    scenarioOutline.steps.push(step);
                }
            }
        }
        
        // Build scenario examples from each example suite
        for (let i = 0; i < exampleSuites.length; i++) {
            const example = this.buildScenarioExampleFromSuite(exampleSuites[i], scenarioOutline, i + 1);
            scenarioOutline.examples.push(example);
        }
        
        return scenarioOutline;
    }
    
    private buildBackgroundFromSuite(suite: any, feature: model.Feature): model.Background {
        const background = new model.Background(feature);

        const parsed = this.parseTitleBlock(String(suite?.name ?? '').replace(/^Background:\s*/i, ''));
        background.title = parsed.title;
        background.description = parsed.description;
        background.tags = parsed.tags;
        const forcePending = suite?.mode === 'skip' || suite?.mode === 'todo';
        
        // Build steps
        for (const task of (suite.tasks || [])) {
            if (task.type === 'test') {
                const step = this.buildStepFromTest(task, background, forcePending);
                background.addStep(step);
            }
        }
        
        return background;
    }
    
    private buildScenarioFromSuite(suite: any, feature: model.Feature): model.Scenario {
        const scenario = new model.Scenario(feature);

        const parsed = this.parseTitleBlock(String(suite?.name ?? '').replace(/^Scenario:\s*/i, ''));
        scenario.title = parsed.title;
        scenario.description = parsed.description;
        scenario.tags = parsed.tags;
        const forcePending = suite?.mode === 'skip' || suite?.mode === 'todo';
        
        // Build steps
        for (const task of (suite.tasks || [])) {
            if (task.type === 'test') {
                const step = this.buildStepFromTest(task, scenario, forcePending);
                scenario.addStep(step);
            }
        }
        
        scenario.executionTime = suite.result?.duration || 0;
        return scenario;
    }
    
    private buildScenarioExampleFromSuite(suite: any, scenarioOutline: model.ScenarioOutline, sequence: number): model.ScenarioExample {
        const example = new model.ScenarioExample(scenarioOutline.parent, scenarioOutline);
        example.title = `Example ${sequence}`;
        example.sequence = sequence;
        example.displayTitle = suite.name;
        const forcePending = suite?.mode === 'skip' || suite?.mode === 'todo';
        
        // Single source of truth: use task.meta.livedoc payload (exact example values).
        const livedocMeta = this.findFirstLiveDocStepMetaInSuite(suite);
        const metaExampleValues = livedocMeta?.scenarioOutline?.example?.values;
        if (!metaExampleValues || typeof metaExampleValues !== 'object') {
            throw new Error(
                `Scenario Outline example values missing in task.meta.livedoc. Outline: "${scenarioOutline.title}" Example suite: "${suite?.name ?? ''}"`
            );
        }

        example.example = this.sanitizeExampleKeys(metaExampleValues);
        example.exampleRaw = example.example; // For now, treat them the same
        
        // Build steps
        for (const task of (suite.tasks || [])) {
            if (task.type === 'test') {
                const step = this.buildStepFromTest(task, example, forcePending);
                example.addStep(step);
            }
        }
        
        example.executionTime = suite.result?.duration || 0;
        return example;
    }

    private getLiveDocMetaFromTask(task: any): any | undefined {
        const meta = task?.meta as any;
        const livedoc = meta?.livedoc;
        if (!livedoc || typeof livedoc !== 'object') return undefined;
        return livedoc;
    }

    private findFirstLiveDocStepMetaInSuite(suite: any): any | undefined {
        const tasks = suite?.tasks || [];
        for (const task of tasks) {
            if (task?.type !== 'test') continue;
            const livedoc = this.getLiveDocMetaFromTask(task);
            if (livedoc?.kind === 'step') return livedoc;
        }
        return undefined;
    }

    private buildScenarioOutlineTablesFromMeta(metaTables: any[]): model.Table[] {
        const tables: model.Table[] = [];

        for (const raw of metaTables) {
            const table = new model.Table();
            table.name = typeof raw?.name === 'string' ? raw.name : '';
            table.description = typeof raw?.description === 'string' ? raw.description : '';
            table.dataTable = Array.isArray(raw?.dataTable) ? raw.dataTable : [];
            tables.push(table);
        }

        return tables;
    }

    private parseTitleBlock(text: string): { title: string; description: string; tags: string[] } {
        const parser = new DescriptionParser();
        parser.parseDescription(text || '');
        return {
            title: parser.title || '',
            description: parser.description || '',
            tags: Array.isArray(parser.tags) ? parser.tags : []
        };
    }
    
    private sanitizeName(name: string): string {
        // Remove spaces and apostrophes - same logic as Parser
        return name.replace(/[ `'']/g, "");
    }
    
    private buildStepFromTest(
        task: any,
        parent: model.Scenario | model.Background | model.ScenarioExample,
        forcePending: boolean = false
    ): model.StepDefinition {
        const name = task.name;
        const meta = this.getLiveDocMetaFromTask(task);
        if (meta?.kind !== 'step') {
            throw new Error(
                `Step metadata missing (expected task.meta.livedoc.kind="step"). Test: "${name}"`
            );
        }
        if (typeof meta?.step?.type !== 'string' || typeof meta?.step?.rawTitle !== 'string') {
            throw new Error(
                `Step metadata incomplete (expected livedoc.step.type/rawTitle). Test: "${name}"`
            );
        }

        const stepType = meta.step.type;
        const stepTitle = this.extractStepTitle(name);
        
        const step = new model.StepDefinition(parent, stepTitle);
        step.type = stepType;
        
        // Single source of truth: transported template (placeholders) from meta.
        step.rawTitle = meta.step.rawTitle;
        
        step.displayTitle = name;
        
        // Parse description and dataTable from multiline step name
        this.parseStepContent(name, step);
        
        // Set status based on test result
        const duration = task.result?.duration || 0;

        // Vitest can represent skipped tests via task.mode without a result.
        if (forcePending || task.mode === 'skip' || task.mode === 'todo') {
            step.setStatus(model.SpecStatus.pending, duration);
        } else if (!task.result) {
            step.setStatus(model.SpecStatus.unknown, duration);
        } else if (task.result.state === 'pass') {
            step.setStatus(model.SpecStatus.pass, duration);
        } else if (task.result.state === 'fail') {
            step.setStatus(model.SpecStatus.fail, duration);
            if (task.result.errors && task.result.errors.length > 0) {
                const error = task.result.errors[0];
                step.exception.message = error.message || '';
                step.exception.stackTrace = error.stack || '';
                // Retrieve code from error if available (attached in livedoc.ts)
                if ((error as any).code) {
                    step.code = (error as any).code;
                }
            }
        }
        
        return step;
    }

    private sanitizeExampleKeys(exampleValues: unknown): Record<string, unknown> {
        if (!exampleValues || typeof exampleValues !== 'object') return {};

        const values = exampleValues as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(values)) {
            sanitized[this.sanitizeName(String(key))] = value;
        }
        return sanitized;
    }
    
    private extractStepTitle(stepName: string): string {
        // Handle multiline step names by only matching the first line
        const match = stepName.match(/^(?:Given|When|Then|And|But)\s+(.+?)(?:\n|$)/i);
        if (match) {
            return match[1];
        }
        const indentedMatch = stepName.match(/^\s+(?:and|but)\s+(.+?)(?:\n|$)/i);
        if (indentedMatch) {
            return indentedMatch[1];
        }
        // Return only the first line if no match
        return stepName.split('\n')[0];
    }
    
    private parseStepContent(stepName: string, step: model.StepDefinition): void {
        // Split the step name into lines
        const lines = stepName.split('\n');
        if (lines.length <= 1) {
            return; // No additional content
        }
        
        // Skip the first line (it's the title)
        const contentLines: string[] = [];
        let i = 1;
        
        // Look for table or description
        let foundTable = false;
        const tableLines: string[] = [];
        
        while (i < lines.length) {
            const line = lines[i].trim();
            
            if (line.startsWith('|') && line.endsWith('|')) {
                foundTable = true;
                tableLines.push(line);
            } else if (foundTable && line === '') {
                // Empty line after table - continue to check for description
            } else if (line !== '') {
                contentLines.push(lines[i]); // Keep original indentation for description
            }
            
            i++;
        }
        
        // Parse data table if found
        if (tableLines.length > 0) {
            step.dataTable = this.parseDataTableFromLines(tableLines);
        }
        
        // Set description (text that isn't part of the table)
        if (contentLines.length > 0) {
            // Find minimum indentation
            let minIndent = Infinity;
            for (const line of contentLines) {
                if (line.trim() !== '') {
                    const indent = line.length - line.trimLeft().length;
                    if (indent < minIndent) {
                        minIndent = indent;
                    }
                }
            }
            
            // Remove common indentation
            const descLines = contentLines.map(line => 
                line.length >= minIndent ? line.substring(minIndent) : line
            );
            
            // Trim empty lines from start and end
            while (descLines.length > 0 && descLines[0].trim() === '') {
                descLines.shift();
            }
            while (descLines.length > 0 && descLines[descLines.length - 1].trim() === '') {
                descLines.pop();
            }
            
            step.description = descLines.join('\n');
        }
    }
    
    private parseDataTableFromLines(lines: string[]): any[] {
        const table: any[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // Split by | and remove empty first/last elements
            const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
            table.push(cells);
        }
        
        return table;
    }
    
    private setLiveDocOptions(options: LiveDocReporterOptions): void {
        // Access protected method through inheritance chain
        (this.liveDocSpec as any).setOptions(options);
    }

    private createPathFromFile(filename: string, rootPath: string): string {
        // Access protected method through inheritance chain
        return (this.liveDocSpec as any).createPathFromFile(filename, rootPath);
    }

    // ============================================
    // Specification Pattern Methods
    // ============================================

    private buildSpecificationFromSuite(suite: any, filepath: string): model.Specification {
        const specification = new model.Specification();

        const parsed = this.parseTitleBlock(String(suite?.name ?? '').replace(/^Specification:\s*/i, ''));
        specification.title = parsed.title;
        specification.description = parsed.description;
        specification.tags = parsed.tags;
        specification.filename = filepath;
        
        // Process tasks - detect rules and rule outlines
        for (const task of (suite.tasks || [])) {
            if (task.type === 'suite') {
                // RuleOutline suites contain child tests with livedoc.kind === 'ruleExample'
                const exampleTests = (task.tasks || []).filter((t: any) => {
                    if (t.type !== 'test') return false;
                    const meta = this.getLiveDocMetaFromTask(t);
                    return meta?.kind === 'ruleExample';
                });
                if (exampleTests.length > 0) {
                    const ruleOutline = this.buildRuleOutlineFromSuite(task, specification);
                    specification.rules.push(ruleOutline);
                }
            } else if (task.type === 'test') {
                // Check if this is a simple Rule (test starting with "Rule:")
                if (task.name.startsWith('Rule:')) {
                    const rule = this.buildRuleFromTest(task, specification);
                    specification.rules.push(rule);
                }
            }
        }
        
        specification.executionTime = suite.result?.duration || 0;
        return specification;
    }
    
    private buildRuleFromTest(task: any, specification: model.Specification): model.Rule {
        const rule = new model.Rule(specification);
        const meta = this.getLiveDocMetaFromTask(task);
        if (meta?.kind !== 'rule') {
            throw new Error(
                `Rule metadata missing (expected task.meta.livedoc.kind="rule"). Test: "${task?.name ?? ''}"`
            );
        }
        if (typeof meta?.rule?.title !== 'string' || typeof meta?.rule?.description !== 'string') {
            throw new Error(
                `Rule metadata incomplete (expected livedoc.rule.title/description). Test: "${task?.name ?? ''}"`
            );
        }

        rule.title = meta.rule.title;
        rule.description = meta.rule.description;
        if (Array.isArray(meta?.rule?.tags)) {
            rule.tags = meta.rule.tags;
        }
        
        // Set status based on task result
        const taskState = task.result?.state || 'unknown';
        const status = this.mapTaskStateToSpecStatus(taskState);
        const duration = task.result?.duration || 0;
        rule.setStatus(status, duration);
        
        if (task.result?.errors && task.result.errors.length > 0) {
            const error = task.result.errors[0];
            rule.error = error;
            rule.exception.message = error.message || '';
            rule.exception.stackTrace = error.stack || '';
            if (error.actual !== undefined) rule.exception.actual = String(error.actual);
            if (error.expected !== undefined) rule.exception.expected = String(error.expected);
            
            // Retrieve code from error if available (attached in livedoc.ts)
            if ((error as any).code) {
                rule.code = (error as any).code;
            }
        }
        
        return rule;
    }
    
    private buildRuleOutlineFromSuite(suite: any, specification: model.Specification): model.RuleOutline {
        const ruleOutline = new model.RuleOutline(specification);

        const exampleTests = (suite.tasks || []).filter((t: any) => {
            if (t.type !== 'test') return false;
            const meta = this.getLiveDocMetaFromTask(t);
            return meta?.kind === 'ruleExample';
        });

        const firstMeta = exampleTests.length > 0 ? this.getLiveDocMetaFromTask(exampleTests[0]) : null;
        const outlineMeta = firstMeta?.ruleOutline;

        // Prefer metadata (supports description/tables/tags like ScenarioOutline)
        if (outlineMeta && typeof outlineMeta.title === 'string') {
            ruleOutline.title = outlineMeta.title;
            ruleOutline.description = String(outlineMeta.description || '');
            if (Array.isArray(outlineMeta.tags)) {
                ruleOutline.tags = outlineMeta.tags;
            }
            if (Array.isArray(outlineMeta.tables)) {
                ruleOutline.tables = outlineMeta.tables as any;
            }
        } else {
            // Fallback to suite name parsing
            const parsed = this.parseTitleBlock(
                String(suite?.name ?? '').replace(/^Rule\s+Outline:\s*/i, '').replace(/^Rule:\s*/i, '')
            );
            ruleOutline.title = parsed.title;
            ruleOutline.description = parsed.description;
            ruleOutline.tags = parsed.tags;
        }
        
        // Build rule examples from each example test
        for (let i = 0; i < exampleTests.length; i++) {
            const example = this.buildRuleExampleFromTest(exampleTests[i], ruleOutline, i + 1);
            ruleOutline.examples.push(example);
        }
        
        // Compute RuleOutline status from examples
        // If any example fails, the outline fails
        // If all examples pass, the outline passes
        // If all examples are pending/skipped, the outline is pending
        if (ruleOutline.examples.length > 0) {
            const hasFailed = ruleOutline.examples.some(e => e.status === model.SpecStatus.fail);
            const allPassed = ruleOutline.examples.every(e => e.status === model.SpecStatus.pass);
            const allPending = ruleOutline.examples.every(e => e.status === model.SpecStatus.pending);
            
            if (hasFailed) {
                ruleOutline.status = model.SpecStatus.fail;
            } else if (allPassed) {
                ruleOutline.status = model.SpecStatus.pass;
            } else if (allPending) {
                ruleOutline.status = model.SpecStatus.pending;
            } else {
                // Mix of pass and pending
                ruleOutline.status = model.SpecStatus.pass;
            }
        }
        
        ruleOutline.executionTime = suite.result?.duration || 0;
        return ruleOutline;
    }
    
    private buildRuleExampleFromTest(task: any, ruleOutline: model.RuleOutline, sequence: number): model.RuleExample {
        const example = new model.RuleExample(ruleOutline.parent, ruleOutline);
        // Title comes from the actual test name (materialized), but remove the "Rule:" or "Example N:" prefix.
        const ruleTitle = String(task.name || '').replace(/^(Rule|Example\s+\d+):\s*/i, '').trim();
        example.title = ruleTitle || ruleOutline.title;
        example.sequence = sequence;
        example.displayTitle = task.name;

        const meta = this.getLiveDocMetaFromTask(task);
        if (meta?.kind !== 'ruleExample') {
            throw new Error(
                `Rule Outline example metadata missing (expected task.meta.livedoc.kind="ruleExample"). Rule: "${ruleOutline.title}" Test: "${task?.name ?? ''}"`
            );
        }

        const values = meta?.ruleOutline?.example?.values;
        const valuesRaw = meta?.ruleOutline?.example?.valuesRaw;
        if (!values || typeof values !== 'object') {
            throw new Error(
                `Rule Outline example values missing in task.meta.livedoc. Rule: "${ruleOutline.title}" Test: "${task?.name ?? ''}"`
            );
        }

        example.example = this.sanitizeExampleKeys(values);
        example.exampleRaw = valuesRaw && typeof valuesRaw === 'object' ? this.sanitizeExampleKeys(valuesRaw) : example.example;
        
        // Set status based on task result
        const taskState = task.result?.state || 'unknown';
        const status = this.mapTaskStateToSpecStatus(taskState);
        const duration = task.result?.duration || 0;
        example.setStatus(status, duration);
        
        if (task.result?.errors && task.result.errors.length > 0) {
            const error = task.result.errors[0];
            example.error = error;
            example.exception.message = error.message || '';
            example.exception.stackTrace = error.stack || '';
            if (error.actual !== undefined) example.exception.actual = String(error.actual);
            if (error.expected !== undefined) example.exception.expected = String(error.expected);

            // Retrieve code from error if available (attached in livedoc.ts)
            if ((error as any).code) {
                example.code = (error as any).code;
            }
        }
        
        return example;
    }
    
    private mapTaskStateToSpecStatus(taskState: string): model.SpecStatus {
        switch (taskState) {
            case 'passed':
            case 'pass':
                return model.SpecStatus.pass;
            case 'failed':
            case 'fail':
                return model.SpecStatus.fail;
            case 'skipped':
            case 'pending':
                return model.SpecStatus.pending;
            default:
                return model.SpecStatus.unknown;
        }
    }

    // ============================================
    // Regular Suite (describe) Methods
    // ============================================

    private buildVitestSuiteFromTask(task: any, filepath: string, parent: model.VitestSuite | null = null): model.VitestSuite {
        const suite = new model.VitestSuite(parent, task.name, 'suite');
        suite.filename = filepath;
        
        // Process child tasks
        for (const childTask of (task.tasks || [])) {
            if (childTask.type === 'suite') {
                const childSuite = this.buildVitestSuiteFromTask(childTask, filepath, suite);
                suite.children.push(childSuite);
            } else if (childTask.type === 'test') {
                const test = this.buildVitestTestFromTask(childTask, suite);
                suite.tests.push(test);
                // Update suite statistics
                suite.statistics.updateStats(test.status, test.duration);
            }
        }
        
        return suite;
    }

    private buildVitestTestFromTask(task: any, parent: model.VitestSuite): model.LiveDocTest<model.VitestSuite> {
        const test = new model.LiveDocTest<model.VitestSuite>(parent, task.name);
        
        // Set status based on task result
        if (task.mode === 'skip' || task.mode === 'todo') {
            test.status = model.SpecStatus.pending;
        } else {
            const taskState = task.result?.state || 'unknown';
            test.status = this.mapTaskStateToSpecStatus(taskState);
        }
        test.duration = task.result?.duration || 0;
        
        if (task.result?.errors && task.result.errors.length > 0) {
            const exception = new model.Exception();
            exception.message = task.result.errors[0].message || '';
            exception.stackTrace = task.result.errors[0].stack || '';
            test.exception = exception;
        }
        
        return test;
    }
    
}

