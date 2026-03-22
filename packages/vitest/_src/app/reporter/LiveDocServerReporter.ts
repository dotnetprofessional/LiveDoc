// @ts-nocheck
import type { Reporter } from 'vitest/reporters';
import type { Vitest } from 'vitest/node';
import { LiveDocViewerReporter } from './LiveDocViewerReporter';
import * as model from '../model/index';
import { SpecStatus } from '../model/SpecStatus';
import { Exception } from '../model/Exception';
import { DescriptionParser } from '../parser/Parser';
import { generateStabilityId } from '@swedevtools/livedoc-schema';
import { livedoc } from '../livedoc';

type Node = any;
type ExampleTable = any;
type TypedValue = any;

const SpecKind: any = {
    Feature: 'Feature',
    Background: 'Background',
    Scenario: 'Scenario',
    ScenarioOutline: 'ScenarioOutline',
    Step: 'Step',
    Rule: 'Rule',
    RuleOutline: 'RuleOutline',
    Specification: 'Specification',
    Container: 'Container',
    Test: 'Test'
};

/**
 * Vitest Reporter that automatically discovers a LiveDoc server and posts results.
 * This is a convenience wrapper around LiveDocViewerReporter.
 */
export default class LiveDocServerReporter implements Reporter {
    private serverUrl: string | null = null;
    private isAvailable = false;
    private project = "default";
    private environment = "local";

    private viewerReporter: LiveDocViewerReporter | null = null;

    async onInit(ctx: Vitest) {
        this.project = ctx.config.name || "default";
        this.environment = (ctx.config as any).mode || this.environment;

        // Highest priority: allow explicitly wiring the server via environment.
        // This is useful when port-file discovery isn't available (e.g., different process/user).
        const envServerUrl = process.env.LIVEDOC_SERVER_URL || process.env.LIVEDOC_PUBLISH_SERVER;
        if (envServerUrl) {
            this.serverUrl = envServerUrl;
            this.isAvailable = true;

            this.viewerReporter = new LiveDocViewerReporter({
                server: this.serverUrl,
                project: this.project,
                environment: this.environment,
                silent: true
            });
            return;
        }
        
        // Prefer explicit publish server if configured (keeps server+viewer in sync).
        if (livedoc.options.publish.enabled && livedoc.options.publish.server) {
            this.serverUrl = livedoc.options.publish.server;
            this.isAvailable = true;

            this.viewerReporter = new LiveDocViewerReporter({
                server: this.serverUrl,
                project: this.project,
                environment: this.environment,
                silent: true
            });
            return;
        }

        // Otherwise, try to discover server
        try {
            // Use dynamic import to avoid circular dependencies or issues if @swedevtools/livedoc-server is not available
            // @ts-ignore
            const { discoverServer } = await import('@swedevtools/livedoc-server');
            const serverInfo = await discoverServer();
            if (serverInfo) {
                this.serverUrl = serverInfo.url;
                this.isAvailable = true;

                this.viewerReporter = new LiveDocViewerReporter({
                    server: this.serverUrl,
                    project: this.project,
                    environment: this.environment,
                    silent: true
                });
            }
        } catch (e) {
            this.isAvailable = false;
        }
    }

    async onTestRunEnd(testModules: readonly any[]): Promise<void> {
        if (!this.isAvailable || !this.serverUrl) return;

        try {
            const results = this.buildExecutionResults(testModules);
            const viewerReporter = this.viewerReporter || new LiveDocViewerReporter({
                server: this.serverUrl,
                project: this.project,
                environment: this.environment,
                silent: true
            });

            this.viewerReporter = viewerReporter;
            await viewerReporter.execute(results);
        } catch {
            // silent
        }
    }

    private buildExecutionResults(testModules: readonly any[]): model.ExecutionResults {
        const features: model.Feature[] = [];
        const specifications: model.Specification[] = [];
        const suites: model.VitestSuite[] = [];

        for (const testModule of testModules) {
            const file = testModule.task || testModule;
            const filepath = (file as any).filepath || "";

            for (const task of (file as any).tasks || []) {
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

        const childSuites = (task.tasks || []).filter((t: any) => t?.type === 'suite');

        // IMPORTANT: Build Background first (matches LiveDocSpecReporter behavior).
        const backgroundSuite = childSuites.find((t: any) => typeof t?.name === 'string' && t.name.startsWith('Background:'));
        if (backgroundSuite) {
            feature.background = this.buildBackgroundFromTask(backgroundSuite, feature);
        }

        for (const child of childSuites) {
            if (child === backgroundSuite) continue;
            const name = String(child?.name ?? '');

            if (!name.startsWith('Scenario:')) continue;

            // Vitest represents Scenario Outlines as a "Scenario:" suite with nested "Example ..." suites.
            const exampleSuites = (child.tasks || []).filter((t: any) =>
                t?.type === 'suite' && typeof t?.name === 'string' && t.name.startsWith('Example ')
            );

            if (exampleSuites.length > 0) {
                feature.addScenario(this.buildScenarioOutlineFromNestedStructure(child, feature));
            } else {
                feature.addScenario(this.buildScenarioFromTask(child, feature));
            }
        }
        return feature;
    }

    private buildBackgroundFromTask(task: any, parent: model.Feature): model.Background {
        const parsed = this.parseTitleBlock(String(task?.name ?? '').replace(/^Background:\s*/i, ''));
        const background = new model.Background(parent);
        background.title = parsed.title;
        background.description = parsed.description;
        background.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                background.addStep(this.buildStepFromTask(child, background));
            }
        }

        return background;
    }

    private buildScenarioFromTask(task: any, parent: model.Feature): model.Scenario {
        const parsed = this.parseTitleBlock(task.name.replace('Scenario:', '').replace('Background:', '').trim());
        const scenario = new model.Scenario(parent);
        scenario.title = parsed.title;
        scenario.description = parsed.description;
        scenario.tags = parsed.tags;

        for (const child of (task.tasks || [])) {
            if (child.type === 'test') {
                scenario.addStep(this.buildStepFromTask(child, scenario));
            }
        }
        return scenario;
    }

    private buildScenarioOutlineFromNestedStructure(task: any, parent: model.Feature): model.ScenarioOutline {
        const parsed = this.parseTitleBlock(String(task?.name ?? '').replace(/^Scenario:\s*/i, ''));

        const outline = new model.ScenarioOutline(parent);
        outline.title = parsed.title;
        outline.description = parsed.description;
        outline.tags = parsed.tags;

        const exampleSuites = (task.tasks || []).filter((t: any) =>
            t?.type === 'suite' && typeof t?.name === 'string' && t.name.startsWith('Example ')
        );

        const firstExampleSuite = exampleSuites[0];
        const firstStepTask = (firstExampleSuite?.tasks || []).find((t: any) => t?.type === 'test');
        const firstMeta = firstStepTask ? this.getLiveDocMetaFromTask(firstStepTask) : undefined;

        // Prefer the authoritative metadata from livedoc.ts for tables/description/tags.
        const metaTables = firstMeta?.scenarioOutline?.tables;
        if (Array.isArray(metaTables) && metaTables.length > 0) {
            outline.tables = this.buildScenarioOutlineTablesFromMeta(metaTables);
        }
        if (Array.isArray(firstMeta?.scenarioOutline?.tags)) {
            outline.tags = firstMeta.scenarioOutline.tags;
        }
        if (typeof firstMeta?.scenarioOutline?.description === 'string') {
            outline.description = firstMeta.scenarioOutline.description;
        }

        // Build template steps (rawTitle/type/docString/dataTable/values/code) from the first example suite.
        if (firstExampleSuite?.tasks) {
            for (const t of firstExampleSuite.tasks) {
                if (t?.type !== 'test') continue;
                const parsedStep = this.parseStepDetails(t);
                const meta = this.getLiveDocMetaFromTask(t);

                const step = new model.StepDefinition(outline, parsedStep.title);
                step.rawTitle = parsedStep.title;
                step.type = parsedStep.keyword;
                step.docString = parsedStep.docString || "";
                step.docStringRaw = parsedStep.docStringRaw || "";
                
                if (parsedStep.dataTable) {
                    step.dataTable = parsedStep.dataTable;
                }
                if (Array.isArray(meta?.step?.values)) {
                    step.values = meta.step.values;
                }
                if (typeof meta?.step?.code === 'string') {
                    (step as any).code = meta.step.code;
                }
                outline.steps.push(step);
            }
        }

        // Build examples
        for (let i = 0; i < exampleSuites.length; i++) {
            const suite = exampleSuites[i];
            const example = new model.ScenarioExample(parent, outline);
            example.title = `Example ${i + 1}`;
            example.sequence = i + 1;
            example.displayTitle = suite?.name ?? example.title;

            const exampleFirstStepTask = (suite?.tasks || []).find((t: any) => t?.type === 'test');
            const exampleMeta = exampleFirstStepTask ? this.getLiveDocMetaFromTask(exampleFirstStepTask) : undefined;
            const values = exampleMeta?.scenarioOutline?.example?.values;
            if (values && typeof values === 'object') {
                const sanitized = this.sanitizeExampleKeys(values);
                example.example = sanitized;
                example.exampleRaw = sanitized;
            } else {
                example.example = {} as any;
                example.exampleRaw = {} as any;
            }

            for (const stepTask of (suite?.tasks || [])) {
                if (stepTask?.type !== 'test') continue;
                example.addStep(this.buildStepFromTask(stepTask, example));
            }

            outline.examples.push(example);
        }

        return outline;
    }

    private buildStepFromTask(task: any, parent: any): model.StepDefinition {
        const name = String(task?.name ?? '');
        const meta = this.getLiveDocMetaFromTask(task);

        const parsedStep = this.parseStepDetails(task);

        const step = new model.StepDefinition(parent, parsedStep.title);
        step.type = parsedStep.keyword;
        step.rawTitle = parsedStep.title;
        step.displayTitle = name;

        if (typeof parsedStep.docStringRaw === 'string' && parsedStep.docStringRaw.trim().length > 0) {
            step.docStringRaw = parsedStep.docStringRaw;
        }
        if (typeof parsedStep.docString === 'string' && parsedStep.docString.trim().length > 0) {
            step.docString = parsedStep.docString;
        }

        if (parsedStep.dataTable) {
            step.dataTable = parsedStep.dataTable;
        }

        const codeFromMeta = typeof meta?.step?.code === 'string' ? String(meta.step.code) : undefined;
        if (codeFromMeta && codeFromMeta.trim().length > 0) {
            (step as any).code = codeFromMeta;
        }

        // Reconstruct docString-like blocks + data tables from multiline step names.
        // This is how LiveDoc transports these across Vitest worker boundaries.
        this.parseStepContent(name, step);
        
        const state = task.result?.state || 'pending';
        step.status = this.mapStateToStatus(state);
        step.duration = task.result?.duration || 0;

        // Read attachments from task meta (synced after step execution)
        if (Array.isArray(meta?.step?.attachments) && meta.step.attachments.length > 0) {
            step.attachments = meta.step.attachments;
        }

        if (task.result?.errors?.length > 0) {
            const ex = new Exception();
            const err = task.result.errors[0];
            ex.message = err.message;
            ex.stackTrace = err.stack;

            // Preserve assertion details when available (used by viewer/text reporter diff formatting)
            if (typeof (err as any).actual !== 'undefined') {
                (ex as any).actual = (err as any).actual;
            }
            if (typeof (err as any).expected !== 'undefined') {
                (ex as any).expected = (err as any).expected;
            }

            // Preserve source code snippet when available (attached by livedoc.ts step handler)
            if (typeof (err as any).code === 'string' && String((err as any).code).trim().length > 0) {
                (step as any).code = String((err as any).code);
            }
            step.exception = ex;
        }

        return step;
    }

    private getLiveDocMetaFromTask(task: any): any | undefined {
        const meta = task?.meta as any;
        const livedocMeta = meta?.livedoc;
        if (!livedocMeta || typeof livedocMeta !== 'object') return undefined;
        return livedocMeta;
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

    private sanitizeExampleKeys(values: unknown): any {
        if (!values || typeof values !== 'object') return values as any;
        const output: Record<string, any> = {};
        for (const [key, value] of Object.entries(values as Record<string, any>)) {
            output[this.sanitizeName(key)] = value;
        }
        return output;
    }

    private sanitizeName(name: string): string {
        return name.replace(/[ `'']/g, "");
    }

    private parseStepContent(stepName: string, step: model.StepDefinition): void {
        const lines = stepName.split('\n');
        if (lines.length <= 1) {
            return;
        }

        // Skip the first line (it's the title)
        const contentLines: string[] = [];
        const tableLines: string[] = [];
        let foundTable = false;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('|') && line.endsWith('|')) {
                foundTable = true;
                tableLines.push(line);
                continue;
            }

            if (foundTable && line === '') {
                continue;
            }

            if (line !== '') {
                contentLines.push(lines[i]);
            }
        }

        if (tableLines.length > 0) {
            step.dataTable = this.parseDataTableFromLines(tableLines);
        }

        if (contentLines.length > 0) {
            let minIndent = Infinity;
            for (const l of contentLines) {
                if (l.trim() !== '') {
                    const indent = l.length - l.trimLeft().length;
                    if (indent < minIndent) minIndent = indent;
                }
            }

            const descLines = contentLines.map((l) => (l.length >= minIndent ? l.substring(minIndent) : l));

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
        if (lines.length < 2) return table;

        // Parse header row
        const headers = lines[0]
            .split('|')
            .map((h) => h.trim())
            .filter((h) => h.length > 0);

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const cells = lines[i]
                .split('|')
                .map((c) => c.trim())
                .filter((c) => c.length > 0);

            const row: Record<string, string> = {};
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = cells[j] ?? '';
            }
            table.push(row);
        }

        return table;
    }

    private parseStepDetails(task: any): { 
        keyword: string; 
        title: string; 
        docString?: string; 
        docStringRaw?: string; 
        materializedDocString?: string; 
        dataTable?: any[] 
    } {
        const meta = this.getLiveDocMetaFromTask(task);
        const name = String(task.name || '');

        const keywordFromMeta = typeof meta?.step?.type === 'string' ? String(meta.step.type).toLowerCase() : undefined;
        const rawTitleFromMeta = typeof meta?.step?.rawTitle === 'string' ? String(meta.step.rawTitle) : undefined;
        const docStringFromMeta = typeof (meta as any)?.step?.docString === 'string' ? String((meta as any).step.docString) : undefined;
        const docStringRawFromMeta = typeof (meta as any)?.step?.docStringRaw === 'string' ? String((meta as any).step.docStringRaw) : undefined;
        const dataTableFromMeta = (meta as any)?.step?.dataTable;
        const materializedDocStringFromMeta = (meta as any)?.step?.materializedDocString;

        let keyword: string = '';
        let title: string = '';
        let docString: string | undefined = docStringFromMeta;
        let docStringRaw: string | undefined = docStringRawFromMeta;
        let materializedDocString: string | undefined = materializedDocStringFromMeta;
        let dataTable: any[] | undefined = dataTableFromMeta;

        if (keywordFromMeta && rawTitleFromMeta) {
            keyword = keywordFromMeta;
            title = rawTitleFromMeta;
        } else {
            // Fallback to parsing the name
            const lines = name.split('\n');
            const firstLine = lines[0].trim();
            
            // Try to extract keyword and title from first line
            const match = firstLine.match(/^(Given|When|Then|And|But)\s+(.+)$/i);
            if (match) {
                keyword = match[1].toLowerCase();
                title = match[2];
            } else {
                // Secondary match for indented and/but
                const indentedMatch = firstLine.match(/^(?:and|but)\s+(.+)$/i);
                if (indentedMatch) {
                    keyword = firstLine.split(' ')[0].toLowerCase();
                    title = indentedMatch[1];
                } else {
                    const parts = firstLine.split(' ');
                    keyword = parts[0].toLowerCase();
                    title = parts.slice(1).join(' ');
                }
            }
        }

        // Extract DocString from full name when raw wasn't provided.
        // This avoids accidentally treating bound/meta docStrings as "raw" (common for ScenarioOutline template steps).
        if (!(typeof docStringRaw === 'string' && docStringRaw.trim().length > 0)) {
            // More robust docstring extraction: match content between """ markers, including the markers.
            const docStringMatch = name.match(/("""[\s\S]*?""")/);
            if (docStringMatch) {
                const extractedRaw = docStringMatch[1].trim();
                docStringRaw = extractedRaw;

                if (!(typeof docString === 'string' && docString.trim().length > 0)) {
                    // Extract content between markers
                    const markerStart = extractedRaw.indexOf('"""');
                    const markerEnd = extractedRaw.lastIndexOf('"""');
                    if (markerEnd > markerStart + 3) {
                        docString = extractedRaw.substring(markerStart + 3, markerEnd).trim();
                    }
                }
            }
        }

        // If materializedDocString wasn't provided in meta, use docString as default
        if (!materializedDocString) {
            materializedDocString = docString;
        }

        return { keyword, title, docString, docStringRaw, materializedDocString, dataTable };
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

        const children = task.tasks || [];
        for (const child of children) {
            // Simple rule is a test task.
            if (child.type === 'test' && typeof child.name === 'string' && child.name.startsWith('Rule:')) {
                const meta = this.getLiveDocMetaFromTask(child);
                const ruleMeta = meta?.kind === 'rule' ? meta.rule : undefined;

                const ruleParsed = ruleMeta
                    ? {
                        title: String(ruleMeta.title ?? ''),
                        description: String(ruleMeta.description ?? ''),
                        tags: Array.isArray(ruleMeta.tags) ? ruleMeta.tags.map(String) : [],
                    }
                    : this.parseTitleBlock(child.name.replace('Rule:', '').trim());

                const rule = new model.Rule(spec);
                rule.title = ruleParsed.title;
                rule.description = ruleParsed.description;
                rule.tags = ruleParsed.tags;

                const state = child.result?.state || 'pending';
                const duration = child.result?.duration || 0;
                rule.status = this.mapStateToStatus(state);
                rule.executionTime = duration;

                if (child.result?.errors?.length > 0) {
                    const err = child.result.errors[0];
                    rule.error = new Error(err.message);
                    rule.exception.message = err.message;
                    rule.exception.stackTrace = err.stack;
                }

                // Use addRule to assign ids/sequence like the parser does.
                spec.addRule(rule);
                continue;
            }

            // RuleOutline is a suite with example test tasks.
            if (child.type === 'suite' && typeof child.name === 'string' && child.name.startsWith('Rule Outline:')) {
                const suiteName = String(child.name);
                const exampleTasks = (child.tasks || []).filter((t: any) => t?.type === 'test');
                const firstMeta = exampleTasks.length > 0 ? this.getLiveDocMetaFromTask(exampleTasks[0]) : undefined;
                const outlineMeta = firstMeta?.kind === 'ruleExample' ? firstMeta.ruleOutline : undefined;

                const outline = new model.RuleOutline(spec);
                outline.title = typeof outlineMeta?.title === 'string'
                    ? outlineMeta.title
                    : suiteName.replace(/^Rule Outline:\s*/i, '').trim();
                outline.description = typeof outlineMeta?.description === 'string' ? outlineMeta.description : '';
                outline.tags = Array.isArray(outlineMeta?.tags) ? outlineMeta.tags.map(String) : [];

                const metaTables = Array.isArray(outlineMeta?.tables) ? outlineMeta.tables : [];
                if (metaTables.length > 0) {
                    outline.tables = this.buildScenarioOutlineTablesFromMeta(metaTables);
                }

                // Build a stable row-order array (aligns with V3 mapping logic which uses index order).
                const flatRowsRaw: Array<Record<string, unknown>> = [];
                for (const t of metaTables) {
                    const dt = Array.isArray(t?.dataTable) ? t.dataTable : [];
                    if (dt.length < 2) continue;
                    const headers = Array.isArray(dt[0]) ? dt[0].map((h: any) => String(h)) : [];
                    for (const row of dt.slice(1)) {
                        const values = Array.isArray(row) ? row : [];
                        const obj: Record<string, unknown> = {};
                        for (let i = 0; i < headers.length; i++) {
                            const key = this.sanitizeName(headers[i]);
                            obj[key] = values[i];
                        }
                        flatRowsRaw.push(obj);
                    }
                }

                const examplesBySequence = new Map<number, model.RuleExample>();

                for (const exTask of exampleTasks) {
                    const meta = this.getLiveDocMetaFromTask(exTask);
                    if (meta?.kind !== 'ruleExample') continue;
                    const ro = meta.ruleOutline;
                    const ex = ro?.example;
                    if (!ex) continue;

                    const sequence = Number(ex.sequence);
                    if (!Number.isFinite(sequence) || sequence <= 0) continue;

                    const example = new model.RuleExample(spec, outline);
                    example.sequence = sequence;

                    const taskName = String(exTask?.name ?? '');
                    example.title = taskName.replace(/^Example\s+\d+\s*:\s*/i, '').trim() || outline.title;
                    example.description = outline.description;
                    example.tags = outline.tags;

                    const values = this.sanitizeExampleKeys(ex.values ?? {});
                    const valuesRaw = this.sanitizeExampleKeys(ex.valuesRaw ?? ex.values ?? {});
                    example.example = values;
                    example.exampleRaw = valuesRaw;

                    const state = exTask.result?.state || 'pending';
                    const duration = exTask.result?.duration || 0;
                    example.status = this.mapStateToStatus(state);
                    example.executionTime = duration;

                    if (exTask.result?.errors?.length > 0) {
                        const err = exTask.result.errors[0];
                        example.error = new Error(err.message);
                        example.exception.message = err.message;
                        example.exception.stackTrace = err.stack;
                    }

                    examplesBySequence.set(sequence, example);
                }

                const totalRows = flatRowsRaw.length;
                const maxSeq = Math.max(0, ...Array.from(examplesBySequence.keys()));
                const count = Math.max(totalRows, maxSeq);

                for (let seq = 1; seq <= count; seq++) {
                    const found = examplesBySequence.get(seq);
                    if (found) {
                        outline.examples.push(found);
                        continue;
                    }

                    // Placeholder for missing execution data (keeps row alignment stable).
                    const placeholder = new model.RuleExample(spec, outline);
                    placeholder.sequence = seq;
                    placeholder.title = outline.title;
                    placeholder.description = outline.description;
                    placeholder.tags = outline.tags;
                    placeholder.exampleRaw = flatRowsRaw[seq - 1] ?? {};
                    placeholder.example = flatRowsRaw[seq - 1] ?? {};
                    placeholder.status = model.SpecStatus.pending;
                    placeholder.executionTime = 0;
                    outline.examples.push(placeholder);
                }

                outline.executionTime = outline.examples.reduce((sum, e: any) => sum + (Number(e?.executionTime ?? 0) || 0), 0);
                outline.status = (() => {
                    const statuses = outline.examples.map((e: any) => e?.status).filter(Boolean);
                    if (statuses.some((s: any) => s === model.SpecStatus.fail)) return model.SpecStatus.fail;
                    if (statuses.some((s: any) => s === model.SpecStatus.pending)) return model.SpecStatus.pending;
                    if (statuses.length > 0 && statuses.every((s: any) => s === model.SpecStatus.pass)) return model.SpecStatus.pass;
                    return model.SpecStatus.unknown;
                })();

                spec.addRule(outline);
                continue;
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

    private mapDataTableVNext(dataTable: any[] | undefined): ExampleTable | undefined {
        if (!Array.isArray(dataTable) || dataTable.length < 1) return undefined;

        const headers = dataTable[0];
        const rows = dataTable.slice(1).map((r, i) => ({
            rowId: `unknown:row:${i}`,
            values: Array.isArray(r) ? r.map((cell: any) => ({
                value: cell,
                type: 'string' as const
            })) : []
        }));

        return {
            name: '',
            description: '',
            headers,
            rows
        };
    }

    private mapTypedValues(values: any[] | undefined): TypedValue[] {
        if (!Array.isArray(values)) return [];
        return values.map((v) => ({
            value: v,
            type: typeof v as any
        }));
    }

    private mapScenarioOutlineTables(metaTables: any[], outlineId: string): ExampleTable[] {
        return metaTables.map((t, i) => ({
            name: t.name,
            description: t.description,
            headers: t.dataTable?.[0] || [],
            rows: (t.dataTable?.slice(1) || []).map((row: any, j: number) => ({
                rowId: `${outlineId}:table:${i}:row:${j + 1}`,
                values: Array.isArray(row) ? row.map((v: any) => ({ value: v, type: 'string' })) : []
            }))
        }));
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
