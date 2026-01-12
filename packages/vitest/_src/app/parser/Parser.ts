import { TextBlockReader } from "./TextBlockReader";
import * as model from "../model/index";
import { RuleViolations } from "../model/RuleViolations";
import { ParserException } from "../model/index";
import type { DataTableRow } from "../types";

export class LiveDocGrammarParser {
    private formatDisplayTitle(description: string, prefix: string, indentLevel: number): string {
        const parser = new DescriptionParser();
        return `${prefix}: ${parser.applyIndenting(description, indentLevel)}`;
    }

    private formatStepDisplayTitle(description: string, prefix: string, indentLevel: number): string {
        const parser = new DescriptionParser();
        let padding = "";
        if (["and", "but"].includes(prefix)) {
            padding = "  ";
        }
        return `${padding}${prefix} ${parser.applyIndenting(description, indentLevel)}`;
    }

    public createFeature(description: string, filename: string): model.Feature {
        const parser = new DescriptionParser();
        const feature = new model.Feature();
        const type = "Feature";

        parser.parseDescription(description);

        feature.title = parser.title;
        feature.displayTitle = this.formatDisplayTitle(description, type, 4);
        feature.description = parser.description;
        feature.tags = parser.tags;
        feature.filename = filename;

        // Validate we have a description
        if (!parser.title) {
            feature.addViolation(
                RuleViolations.enforceTitle,
                `${type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`,
                parser.title
            );
        }
        return feature;
    }

    public addBackground(feature: model.Feature, description: string): model.Background {
        if (feature.background) {
            throw new ParserException(
                "Can not have more than one background defined",
                "Duplicate Background",
                feature.filename
            );
        }

        const background = new model.Background(feature);
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        background.title = parser.title;
        background.description = parser.description;
        background.displayTitle = this.formatDisplayTitle(description, "Background", 4);
        background.tags = parser.tags;

        feature.background = background;
        (feature as any).generateId(background);

        return background;
    }

    public addScenario(feature: model.Feature, description: string): model.Scenario {
        const type = "Scenario";
        const scenario = new model.Scenario(feature);
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        scenario.title = parser.title;
        scenario.description = parser.description;
        scenario.displayTitle = this.formatDisplayTitle(description, type, 6);
        scenario.tags = parser.tags;
        feature.addScenario(scenario);

        return scenario;
    }

    public addScenarioOutline(feature: model.Feature, description: string): model.ScenarioOutline {
        const type = "Scenario Outline";
        const scenarioOutline = new model.ScenarioOutline(feature);
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        scenarioOutline.title = parser.title;
        scenarioOutline.description = parser.description;
        scenarioOutline.displayTitle = this.formatDisplayTitle(description, type, 6);
        scenarioOutline.tags = parser.tags;
        scenarioOutline.tables = parser.tables;

        // Parse steps from the description and add as blueprints
        const textReader = new TextBlockReader(description);
        // Skip title line
        textReader.next();
        
        while (textReader.next()) {
            const line = textReader.line!.trim();
            const stepMatch = line.match(/^(Given|When|Then|And|But)\s+(.+)$/i);
            if (stepMatch) {
                const stepType = stepMatch[1].toLowerCase();
                // Use existing createStep logic but for blueprint
                const blueprintStep = this.createStep(stepType, line.substring(line.indexOf(stepMatch[1]) + stepMatch[1].length).trim(), undefined);
                
                // Read until next step or Example keyword to find docstrings/tables
                while (textReader.next()) {
                    const nextLine = textReader.line!.trim();
                    if (nextLine.match(/^(Given|When|Then|And|But|Examples:)/i)) {
                        // Back up one line so the main loop can process it
                        (textReader as any).currentIndex--;
                        break;
                    }
                    if (nextLine.startsWith('"""')) {
                        blueprintStep.docStringRaw = parser.parseDocString(textReader);
                        blueprintStep.docString = blueprintStep.docStringRaw;
                    } else if (nextLine.startsWith('|') && nextLine.endsWith('|')) {
                        blueprintStep.dataTable = parser.parseDataTable(textReader);
                    }
                }
                scenarioOutline.blueprintSteps.push(blueprintStep);
            }
        }

        this.addExamplesAsScenarios(scenarioOutline, parser);

        feature.scenarios.push(scenarioOutline);


        // Validate we have a description
        if (!parser.title) {
            scenarioOutline.addViolation(
                RuleViolations.enforceTitle,
                `${type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`,
                parser.title
            );
        }

        return scenarioOutline;
    }

    private addExamplesAsScenarios(scenarioOutline: model.ScenarioOutline, parser: DescriptionParser): void {
        // Merge all example tables into a single array for processing
        parser.tables.forEach(table => {
            this.addExample(scenarioOutline, table, parser);
        });

        if (scenarioOutline.examples.length === 0) {
            throw new model.LiveDocRuleViolation(
                RuleViolations.error,
                "A scenarioOutline was defined but does not contain any Examples. Did you mean to use a scenario or forget the Examples keyword?",
                scenarioOutline.title
            );
        }
    }

    private addExample(
        scenarioOutline: model.ScenarioOutline,
        table: model.Table,
        parser: DescriptionParser
    ): void {
        if (!table.dataTable || table.dataTable.length <= 1) {
            throw TypeError("Data tables must have at least a header row plus a data row.");
        }

        const headerRow: string[] = [];
        (table.dataTable[0] as any[]).forEach((item: any) => {
            // Copy the header names removing spaces and apostrophes
            headerRow.push(parser.sanitizeName(item));
        });

        for (let i = 1; i < table.dataTable.length; i++) {
            const dataRow = table.dataTable[i];
            const scenario = new model.ScenarioExample(scenarioOutline.parent, scenarioOutline);
            scenario.displayTitle = this.formatDisplayTitle(scenarioOutline.title, "Scenario", 6);
            scenario.example = parser.getTableRowAsEntity(headerRow, dataRow);
            scenario.exampleRaw = parser.getTableRowAsEntity(headerRow, dataRow, false);
            scenario.title = scenarioOutline.title;
            scenarioOutline.examples.push(scenario);
            scenario.sequence = scenarioOutline.examples.length;
        }
    }

    public createStep(type: string, description: string, passedParam?: object | (() => object)): model.StepDefinition {
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        const step = new model.StepDefinition(null as any, parser.title);

        const indentation = 10;

        step.description = parser.description;
        step.docString = parser.docString;
        step.docStringRaw = parser.docString;
        step.dataTable = parser.dataTable;
        step.valuesRaw = parser.quotedValues;
        step.displayTitle = this.formatStepDisplayTitle(description, type, indentation);
        step.rawTitle = step.title;
        step.values = parser.coerceValues(step.valuesRaw);
        step.paramsRaw = parser.namedValues;
        step.params = parser.coerceNamedValues(step.paramsRaw);
        step.type = type;
        step.passedParam = passedParam;

        return step;
    }

    public applyPassedParams(step: model.StepDefinition): void {
        const parser = new DescriptionParser();

        step.displayTitle = parser.secondaryBind(step.displayTitle, step.passedParam);
        step.docString = parser.secondaryBind(step.docString, step.passedParam);
    }

    // ============================================
    // Specification Pattern Methods
    // ============================================

    public createSpecification(description: string, filename: string): model.Specification {
        const parser = new DescriptionParser();
        const specification = new model.Specification();
        const type = "Specification";

        parser.parseDescription(description);

        specification.title = parser.title;
        specification.displayTitle = this.formatDisplayTitle(description, type, 4);
        specification.description = parser.description;
        specification.tags = parser.tags;
        specification.filename = filename;

        // Validate we have a description
        if (!parser.title) {
            specification.addViolation(
                RuleViolations.enforceTitle,
                `${type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`,
                parser.title
            );
        }
        return specification;
    }

    public addRule(specification: model.Specification, description: string): model.Rule {
        const type = "Rule";
        const rule = new model.Rule(specification);
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        rule.title = parser.title;
        rule.description = parser.description;
        rule.displayTitle = this.formatDisplayTitle(description, type, 6);
        rule.tags = parser.tags;
        specification.addRule(rule);

        return rule;
    }

    public addRuleOutline(specification: model.Specification, description: string): model.RuleOutline {
        const type = "Rule Outline";
        const ruleOutline = new model.RuleOutline(specification);
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        ruleOutline.title = parser.title;
        ruleOutline.description = parser.description;
        ruleOutline.displayTitle = this.formatDisplayTitle(description, type, 6);
        ruleOutline.tags = parser.tags;
        ruleOutline.tables = parser.tables;

        this.addRuleExamples(ruleOutline, parser);

        specification.rules.push(ruleOutline);

        // Validate we have a description
        if (!parser.title) {
            ruleOutline.addViolation(
                RuleViolations.enforceTitle,
                `${type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`,
                parser.title
            );
        }

        return ruleOutline;
    }

    private addRuleExamples(ruleOutline: model.RuleOutline, parser: DescriptionParser): void {
        // Merge all example tables into a single array for processing
        parser.tables.forEach(table => {
            this.addRuleExample(ruleOutline, table, parser);
        });

        if (ruleOutline.examples.length === 0) {
            throw new model.LiveDocRuleViolation(
                RuleViolations.error,
                "A ruleOutline was defined but does not contain any Examples. Did you mean to use a rule or forget the Examples keyword?",
                ruleOutline.title
            );
        }
    }

    private addRuleExample(
        ruleOutline: model.RuleOutline,
        table: model.Table,
        parser: DescriptionParser
    ): void {
        if (!table.dataTable || table.dataTable.length <= 1) {
            throw TypeError("Data tables must have at least a header row plus a data row.");
        }

        const headerRow: string[] = [];
        (table.dataTable[0] as any[]).forEach((item: any) => {
            // Copy the header names removing spaces and apostrophes
            headerRow.push(parser.sanitizeName(item));
        });

        for (let i = 1; i < table.dataTable.length; i++) {
            const dataRow = table.dataTable[i];
            const ruleExample = new model.RuleExample(ruleOutline.parent, ruleOutline);
            ruleExample.displayTitle = this.formatDisplayTitle(ruleOutline.title, "Rule", 6);
            ruleExample.example = parser.getTableRowAsEntity(headerRow, dataRow);
            ruleExample.exampleRaw = parser.getTableRowAsEntity(headerRow, dataRow, false);
            ruleExample.title = ruleOutline.title;
            ruleOutline.examples.push(ruleExample);
            ruleExample.sequence = ruleOutline.examples.length;
        }
    }
}

export class DescriptionParser {
    public title: string = "";
    public description: string = "";
    public text: string = "";
    public tags: string[] = [];
    public tables: model.Table[] = [];
    public dataTable: DataTableRow[] = [];
    public docString: string = "";
    public quotedValues: string[] = [];
    public namedValues: Record<string, string> = {};

    public parseDescription(text: string): void {
        this.text = text;
        const textReader = new TextBlockReader(text);
        
        if (textReader.next()) {
            this.title = textReader.line!.trim();
            // Quoted values are only found in the title
            this.quotedValues = this.parseQuotedValues(textReader);
            this.namedValues = this.parseNamedValues(textReader);
        }

        let descriptionIndex = -1;
        const descriptionLines: string[] = [];

        while (textReader.next()) {
            const line = textReader.line!.trim();
            
            if (line.startsWith("@")) {
                this.tags.push(...line.replace(/@/g, '').split(' ').filter(t => t));
            } else if (line.toLowerCase().startsWith("examples")) {
                // Scenario outline table
                this.tables.push(this.parseTable(textReader));
            } else if (line.startsWith("|") && line.endsWith("|")) {
                // Given/when/then data table
                this.dataTable = this.parseDataTable(textReader);
            } else if (line.startsWith('"""')) {
                this.docString = this.parseDocString(textReader);
            } else {
                // Add the rest to the description
                if (descriptionIndex < 0 && textReader.line) {
                    // Find the first non-whitespace character and use that as the split line
                    descriptionIndex = this.getFirstNonBlankIndex(textReader.line);
                }
                descriptionLines.push(this.trimStart(textReader.line || "", descriptionIndex));
            }
        }

        // Strip blank lines from start and end of description
        while (descriptionLines.length !== 0) {
            if (!descriptionLines[0]) {
                descriptionLines.shift();
                continue;
            }
            if (!descriptionLines[descriptionLines.length - 1]) {
                descriptionLines.pop();
                continue;
            }
            break;
        }

        this.description = descriptionLines.join("\n");
    }

    public getTableRowAsEntity(
        headerRow: DataTableRow,
        dataRow: DataTableRow,
        shouldCoerce: boolean = true
    ): DataTableRow {
        const entity: DataTableRow = {};
        const headers = headerRow as any[];
        const data = dataRow as any[];
        for (let p = 0; p < headers.length; p++) {
            entity[headers[p].toString()] = shouldCoerce 
                ? this.coerceValue(data[p]) 
                : data[p];
        }
        return entity;
    }

    public coerceValues(values: string[]): any[] {
        return values.map(value => this.coerceValue(value));
    }

    public coerceNamedValues(namedValues: Record<string, string>): Record<string, any> {
        const results: Record<string, any> = {};
        for (const key in namedValues) {
            results[key] = this.coerceValue(namedValues[key]);
        }
        return results;
    }

    public coerceValue(valueString: string): any {
        try {
            return JSON.parse(valueString, (_key, value) => this.convertToDateIfPossible(value));
        } catch {
            return this.convertToDateIfPossible(valueString);
        }
    }

    private convertToDateIfPossible(value: any): string | Date {
        if (typeof value !== 'string') return value;
        
        if (/^(\d{4}|\d{2})[-\/]\d{2}[-\/](\d{4}|\d{2})/.test(value)) {
            return new Date(value);
        }
        return value;
    }

    private isCommentedLine(line: string): boolean {
        return line.startsWith("#") || line.startsWith("//");
    }

    private parseTable(textReader: TextBlockReader): model.Table {
        const table = new model.Table();
        table.name = textReader.line!.trim().substring("Examples:".length).trim();
        
        while (textReader.next()) {
            if (!textReader.line!.trim().startsWith("|")) {
                // Add this line to the description
                table.description += textReader.line + "\n";
            } else {
                break;
            }
        }

        // Check we didn't exhaust the text block
        if (textReader.line !== null) {
            // Must have found the data table
            const dataTable = this.parseDataTable(textReader);
            table.dataTable = dataTable;
        }
        return table;
    }

    public parseDataTable(textReader: TextBlockReader): DataTableRow[] {
        let line = textReader.line!.trim();
        const dataTable: DataTableRow[] = [];

        while (line && (line.startsWith("|") || this.isCommentedLine(line))) {
            if (!this.isCommentedLine(line)) {
                const rowData = line.split("|");
                const row: any[] = [];
                for (let i = 1; i < rowData.length - 1; i++) {
                    row.push(rowData[i].trim());
                }
                dataTable.push(row);
            }

            if (textReader.next()) {
                line = textReader.line!.trim();
            } else {
                line = "";
            }
        }
        return dataTable;
    }

    public parseDocString(textReader: TextBlockReader): string {
        const docLines: string[] = [];
        const docStringStartIndex = textReader.line!.indexOf('"');
        
        while (textReader.next()) {
            const trimmedLine = textReader.line!.trim();
            if (trimmedLine.startsWith('"""')) {
                // End of the docString
                break;
            }
            docLines.push(this.trimStart(textReader.line!, docStringStartIndex));
        }
        return docLines.join('\n');
    }

    private parseQuotedValues(textReader: TextBlockReader): string[] {
        const arrayOfValues = textReader.line!.match(/(["'](.*?)["'])+/g);
        const results: string[] = [];
        
        if (arrayOfValues) {
            arrayOfValues.forEach(element => {
                const valueString = element.substring(1, element.length - 1).trim();
                results.push(valueString);
            });
        }
        return results;
    }

    private parseNamedValues(textReader: TextBlockReader): Record<string, string> {
        const regex = /<([^:>]+):([^>]+)>/g;
        const results: Record<string, string> = {};
        let match;

        while ((match = regex.exec(textReader.line!)) !== null) {
            const name = this.sanitizeName(match[1].trim());
            const value = match[2].trim();
            results[name] = value;
        }
        return results;
    }

    private getFirstNonBlankIndex(text: string): number {
        for (let i = 0; i < text.length; i++) {
            if (text.charAt(i) !== " ") {
                return i;
            }
        }
        return -1;
    }

    private trimStart(text: string, index: number): string {
        if (index === -1) {
            return "";
        }
        if (index <= text.length) {
            return text.substring(index);
        } else {
            return text;
        }
    }

    public applyIndenting(text: string, spacing: number): string {
        const textReader = new TextBlockReader(text);

        // The first line is the title so ignore indenting for that
        let title = "";
        if (textReader.next()) {
            title = textReader.line!;
        }

        const textLines: string[] = [title];
        let textIndentingStartIndex = -1;
        
        while (textReader.next()) {
            if (textIndentingStartIndex < 0) {
                textIndentingStartIndex = this.getFirstNonBlankIndex(textReader.line!);
            }
            textLines.push(" ".repeat(spacing) + this.trimStart(textReader.line!, textIndentingStartIndex));
        }

        return textLines.join('\n');
    }

    public bind(content: string, model: any): string {
        const regex = /<([^>]+)>/g;
        return content.replace(regex, (_match, item) => {
            return this.applyBinding(item, model);
        });
    }

    public secondaryBind(content: string, model: any): string {
        if (!model) return content;

        const regex = /{{[^}]+}}/g;
        return content.replace(regex, (item) => {
            return this.applyBinding(item, model, 2);
        });
    }

    private applyBinding(item: string, model: any, bindingSyntaxLength: number = 1): string {
        const key = this.sanitizeName(
            item.substr(bindingSyntaxLength, item.length - bindingSyntaxLength * 2)
        );
        
        if (model && model.hasOwnProperty(key)) {
            return model[key];
        } else {
            throw new Error(
                `Binding error: '${key}' does not exist in model. Verify the spelling and that the name still exists in the bound model.`
            );
        }
    }

    public sanitizeName(name: string): string {
        // Remove spaces and apostrophes
        return name.replace(/[ `'']/g, "");
    }
}
