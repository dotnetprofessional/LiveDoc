import type { Reporter } from 'vitest/reporters';
import type { Vitest } from 'vitest/node';
import { LiveDocSpec, LiveDocReporterOptions } from './LiveDocSpec';
import { DefaultColorTheme } from './ColorTheme';
import { LiveDocReporter } from './LiveDocReporter';
import * as model from '../model/index';

/**
 * Vitest Reporter that provides enhanced BDD output using LiveDocSpec
 * Follows the pattern from JUnitReporter and SummaryReporter
 */
export default class LiveDocSpecReporter implements Reporter {
    private liveDocSpec: LiveDocSpec;
    private options: LiveDocReporterOptions;

    constructor(options: any = {}) {
        this.options = new LiveDocReporterOptions();
        
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

        // Output execution results with post-reporter support
        await this.liveDocSpec.executionEnd(results, (this.options as any).rawOptions);
    }
    
    private buildFeatureFromSuite(suite: any, filepath: string): model.Feature {
        const feature = new model.Feature();
        
        // Extract feature title and description from suite name
        const lines = suite.name.split('\n');
        feature.title = lines[0].trim();
        feature.filename = filepath;
        
        if (lines.length > 1) {
            feature.description = lines.slice(1)
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0)
                .join('\n');
        }
        
        // Process tasks - detect backgrounds, scenarios, and scenario outlines
        let backgroundSuite: any = null;
        
        for (const task of (suite.tasks || [])) {
            if (task.type === 'suite') {
                // Check if this is a background
                if (task.name.startsWith('Background:')) {
                    backgroundSuite = task;
                    continue;
                }
                
                // Check if this is a scenario (starts with "Scenario:")
                if (task.name.startsWith('Scenario:')) {
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
        }
        
        // Build background if exists
        if (backgroundSuite) {
            feature.background = this.buildBackgroundFromSuite(backgroundSuite, feature);
        }
        
        return feature;
    }
    
    private buildScenarioOutlineFromNestedStructure(suite: any, feature: model.Feature): model.ScenarioOutline {
        const scenarioOutline = new model.ScenarioOutline(feature);
        const cleanName = suite.name.replace(/^Scenario:\s*/, '').split('\n')[0].trim();
        scenarioOutline.title = cleanName;
        
        // Get example suites
        const exampleSuites = (suite.tasks || []).filter((t: any) => 
            t.type === 'suite' && t.name.startsWith('Example ')
        );
        
        // Build template steps from the first example's step definitions
        if (exampleSuites.length > 0 && exampleSuites[0].tasks) {
            for (const task of exampleSuites[0].tasks) {
                if (task.type === 'test') {
                    const step = new model.StepDefinition(scenarioOutline, "");
                    step.rawTitle = this.extractStepTemplate(task.name, scenarioOutline.tables);
                    step.type = this.extractStepType(task.name);
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
        background.title = suite.name.replace(/^Background:\s*/, '').split('\n')[0].trim();
        
        // Build steps
        for (const task of (suite.tasks || [])) {
            if (task.type === 'test') {
                const step = this.buildStepFromTest(task, background);
                background.addStep(step);
            }
        }
        
        return background;
    }
    
    private buildScenarioFromSuite(suite: any, feature: model.Feature): model.Scenario {
        const scenario = new model.Scenario(feature);
        const cleanName = suite.name;
        scenario.title = cleanName.replace(/^Scenario:\s*/, '').split('\n')[0].trim();
        
        // Parse description if available
        const lines = cleanName.split('\n');
        if (lines.length > 1) {
            scenario.description = lines.slice(1)
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0 && !l.startsWith('Examples:'))
                .join('\n');
        }
        
        // Build steps
        for (const task of (suite.tasks || [])) {
            if (task.type === 'test') {
                const step = this.buildStepFromTest(task, scenario);
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
        
        // Extract example data from the scenario outline tables using sequence number
        example.example = this.extractExampleDataBySequence(scenarioOutline, sequence);
        example.exampleRaw = example.example; // For now, treat them the same
        
        // Build steps
        for (const task of (suite.tasks || [])) {
            if (task.type === 'test') {
                const step = this.buildStepFromTest(task, example);
                example.addStep(step);
            }
        }
        
        example.executionTime = suite.result?.duration || 0;
        return example;
    }
    
    private extractExampleDataBySequence(scenarioOutline: model.ScenarioOutline, sequence: number): any {
        // Use sequence number to pick the correct row from the tables
        // Sequence numbers span across all tables
        if (scenarioOutline.tables && scenarioOutline.tables.length > 0) {
            let currentSequence = 0;
            
            for (const table of scenarioOutline.tables) {
                if (table.dataTable && table.dataTable.length > 1) {
                    // dataTable[0] is header, data rows start at index 1
                    const dataRowCount = table.dataTable.length - 1;
                    
                    if (sequence <= currentSequence + dataRowCount) {
                        // The sequence is in this table
                        const rowIndexInTable = sequence - currentSequence; // 1-based within this table
                        const headerRow = table.dataTable[0] as any;
                        const dataRow = table.dataTable[rowIndexInTable] as any;
                        
                        // Convert to object with sanitized keys
                        const example: any = {};
                        for (let i = 0; i < headerRow.length && i < dataRow.length; i++) {
                            const key = this.sanitizeName(String(headerRow[i]));
                            example[key] = dataRow[i];
                        }
                        return example;
                    }
                    
                    currentSequence += dataRowCount;
                }
            }
        }
        return {};
    }
    
    private sanitizeName(name: string): string {
        // Remove spaces and apostrophes - same logic as Parser
        return name.replace(/[ `'']/g, "");
    }
    
    private buildStepFromTest(task: any, parent: model.Scenario | model.Background | model.ScenarioExample): model.StepDefinition {
        const name = task.name;
        const stepType = this.extractStepType(name);
        const stepTitle = this.extractStepTitle(name);
        
        const step = new model.StepDefinition(parent, stepTitle);
        step.type = stepType;
        
        // For ScenarioExample steps, use the template step's rawTitle (with placeholders)
        // Otherwise use the executed step's title
        if (parent instanceof model.ScenarioExample && parent.scenarioOutline && parent.scenarioOutline.steps) {
            const stepIndex = parent.steps.length; // Index of the step we're about to add
            if (stepIndex < parent.scenarioOutline.steps.length) {
                step.rawTitle = parent.scenarioOutline.steps[stepIndex].rawTitle;
            } else {
                step.rawTitle = stepTitle;
            }
        } else {
            step.rawTitle = stepTitle;
        }
        
        step.displayTitle = name;
        
        // Parse description and dataTable from multiline step name
        this.parseStepContent(name, step);
        
        // Set status based on test result
        const duration = task.result?.duration || 0;
        
        if (!task.result) {
            step.setStatus(model.SpecStatus.unknown, duration);
        } else if (task.result.state === 'pass') {
            step.setStatus(model.SpecStatus.pass, duration);
        } else if (task.result.state === 'fail') {
            step.setStatus(model.SpecStatus.fail, duration);
            if (task.result.errors && task.result.errors.length > 0) {
                const error = task.result.errors[0];
                step.exception.message = error.message || '';
                step.exception.stackTrace = error.stack || '';
            }
        } else if (task.mode === 'skip' || task.mode === 'todo') {
            step.setStatus(model.SpecStatus.pending, duration);
        }
        
        return step;
    }
    
    private extractStepType(stepName: string): string {
        // Handle multiline step names by only matching the first line
        const match = stepName.match(/^(given|when|then|and|but)\s+/i);
        if (match) {
            return match[1].toLowerCase();
        }
        const indentedMatch = stepName.match(/^\s+(and|but)\s+/i);
        if (indentedMatch) {
            return indentedMatch[1].toLowerCase();
        }
        return 'given';
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
    
    private extractStepTemplate(stepName: string, tables: any[]): string {
        // Replace actual values from the first example row with placeholders
        let template = this.extractStepTitle(stepName);
        
        if (tables.length > 0 && tables[0].dataTable && tables[0].dataTable.length >= 2) {
            const exampleTable = tables[0].dataTable as string[][];
            const headers = exampleTable[0]; // Column names
            const firstRow = exampleTable[1]; // First example values
            
            // Replace each value from the first row with its corresponding placeholder
            for (let i = 0; i < headers.length; i++) {
                const columnName = headers[i].trim();
                const value = firstRow[i].trim();
                
                // Create the placeholder (e.g., "<Customer's Country>")
                const placeholder = `<${columnName}>`;
                
                // Replace all occurrences of the value with the placeholder
                // Use word boundaries to avoid replacing partial matches (e.g., "it" in "with")
                const regex = new RegExp(`\\b${this.escapeRegex(value)}\\b`, 'g');
                template = template.replace(regex, placeholder);
            }
        }
        
        return template;
    }
    
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        
        // Extract specification title and description from suite name
        const fullName = suite.name.replace(/^Specification:\s*/, '');
        const lines = fullName.split('\n');
        specification.title = lines[0].trim();
        specification.filename = filepath;
        
        if (lines.length > 1) {
            specification.description = lines.slice(1)
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0)
                .join('\n');
        }
        
        // Process tasks - detect rules and rule outlines
        for (const task of (suite.tasks || [])) {
            if (task.type === 'suite') {
                // Check if this is a Rule Outline (has Example children)
                if (task.name.startsWith('Rule:')) {
                    const exampleTests = (task.tasks || []).filter((t: any) => 
                        t.type === 'test' && t.name.startsWith('Example ')
                    );
                    
                    if (exampleTests.length > 0) {
                        // This is a Rule Outline with nested examples
                        const ruleOutline = this.buildRuleOutlineFromSuite(task, specification);
                        specification.rules.push(ruleOutline);
                    }
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
        const fullName = task.name.replace(/^Rule:\s*/, '');
        const lines = fullName.split('\n');
        rule.title = lines[0].trim();
        
        if (lines.length > 1) {
            rule.description = lines.slice(1)
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0)
                .join('\n');
        }
        
        // Set status based on task result
        const taskState = task.result?.state || 'unknown';
        rule.status = this.mapTaskStateToSpecStatus(taskState);
        rule.executionTime = task.result?.duration || 0;
        
        if (task.result?.errors && task.result.errors.length > 0) {
            rule.error = task.result.errors[0];
        }
        
        return rule;
    }
    
    private buildRuleOutlineFromSuite(suite: any, specification: model.Specification): model.RuleOutline {
        const ruleOutline = new model.RuleOutline(specification);
        const fullName = suite.name.replace(/^Rule:\s*/, '');
        const lines = fullName.split('\n');
        ruleOutline.title = lines[0].trim();
        
        if (lines.length > 1) {
            ruleOutline.description = lines.slice(1)
                .map((l: string) => l.trim())
                .filter((l: string) => l.length > 0)
                .join('\n');
        }
        
        // Build rule examples from each example test
        const exampleTests = (suite.tasks || []).filter((t: any) => 
            t.type === 'test' && t.name.startsWith('Example ')
        );
        
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
        example.title = `Example ${sequence}`;
        example.sequence = sequence;
        example.displayTitle = task.name;
        
        // Extract example data from the task name if available
        // Format is "Example N: value1, value2, ..."
        const match = task.name.match(/^Example \d+:\s*(.*)$/);
        if (match) {
            // Values are comma-separated, but we don't have column names
            // Store as a simple key-value with index-based keys
            const values = match[1].split(',').map((v: string) => v.trim());
            example.example = {};
            values.forEach((v: string, idx: number) => {
                (example.example as any)[`value${idx}`] = v;
            });
            example.exampleRaw = example.example;
        }
        
        // Set status based on task result
        const taskState = task.result?.state || 'unknown';
        example.status = this.mapTaskStateToSpecStatus(taskState);
        example.executionTime = task.result?.duration || 0;
        
        if (task.result?.errors && task.result.errors.length > 0) {
            example.error = task.result.errors[0];
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
        const taskState = task.result?.state || 'unknown';
        test.status = this.mapTaskStateToSpecStatus(taskState);
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

