import { TextBlockReader } from "./TextBlockReader";
import * as model from "../model";
import { RuleViolations } from "../model/RuleViolations";

var moment = require("moment");

export class LiveDocGrammarParser {

    private formatDisplayTitle(description: string, prefix: string, indentLevel: number) {
        const parser = new DescriptionParser();
        return `${prefix}: ${parser.applyIndenting(description, indentLevel)}`;
    }

    private formatStepDisplayTitle(description: string, prefix: string, indentLevel: number) {
        const parser = new DescriptionParser();
        let padding = "";
        if (["and", "but"].indexOf(prefix) >= 0) {
            padding = "  ";
        }
        return `${padding}${prefix} ${parser.applyIndenting(description, indentLevel)}`;
    }

    public createFeature(description: string, filename: string): model.Feature {
        const parser = new DescriptionParser();
        const feature = new model.Feature();
        const type = "Feature";

        parser.parseDescription(description);

        // This is the top level feature 
        feature.title = parser.title;
        feature.displayTitle = this.formatDisplayTitle(description, type, 4);
        feature.description = parser.description;
        feature.tags = parser.tags;
        feature.rawDescription = description;
        feature.filename = filename;


        // validate we have a description!
        if (!parser.title) {
            feature.addViolation(RuleViolations.enforceTitle, `${type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`, parser.title);
        }
        return feature;
    }

    public addBackground(feature: model.Feature, description: string): model.Background {
        const background = new model.Background(feature);
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        background.title = parser.title;
        background.description = parser.description;
        background.displayTitle = this.formatDisplayTitle(description, "Background", 4);
        background.tags = parser.tags;
        background.rawDescription = description;
        feature.background = background;

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
        scenario.rawDescription = description;
        feature.scenarios.push(scenario);
        scenario.sequence = feature.scenarios.length;

        // validate we have a description!
        if (!parser.title) {
            scenario.addViolation(RuleViolations.enforceTitle, `${type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`, parser.title);
        }
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
        scenarioOutline.rawDescription = description;
        scenarioOutline.tables = parser.tables;

        this.addExamplesAsScenarios(scenarioOutline, parser);

        feature.scenarios.push(scenarioOutline);

        // validate we have a description!
        if (!parser.title) {
            scenarioOutline.addViolation(RuleViolations.enforceTitle, `${type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`, parser.title);
        }

        return scenarioOutline;
    }

    private addExamplesAsScenarios(scenarioOutline: model.ScenarioOutline, parser: DescriptionParser) {
        // merge all example tables into a single array for processing
        parser.tables.forEach(table => {
            this.addExample(scenarioOutline, table, parser);
        });

        if (scenarioOutline.examples.length === 0) {
            // Oh dear seems they either forgot the table or its not structured correctly.
            throw new model.LiveDocRuleViolation(RuleViolations.error, "A scenarioOutline was defined but does not contain any Examples. Did you mean to use a scenario or forget the Examples keyword?", scenarioOutline.title);
        }
    }

    private addExample(scenarioOutline: model.ScenarioOutline, table: model.Table, parser: DescriptionParser) {
        // merge all tables into a single array for processing
        if (!table.dataTable || table.dataTable.length <= 1) {
            throw TypeError("Data tables must have at least a header row plus a data row.");
        }
        const headerRow: string[] = [];
        table.dataTable[0].forEach(item => {
            // copy the header names removing spaces and apostrophes
            headerRow.push(parser.sanitizeName(item));
        });

        for (let i = 1; i < table.dataTable.length; i++) {
            const dataRow = table.dataTable[i];
            const scenario = new model.ScenarioExample(scenarioOutline.parent, scenarioOutline);
            // Don't want to repeat the table etc for every scenario iteration
            scenario.rawDescription = scenarioOutline.title;
            scenario.displayTitle = this.formatDisplayTitle(scenarioOutline.title, "Scenario", 6);
            scenario.example = parser.getTableRowAsEntity(headerRow, dataRow);
            scenario.exampleRaw = parser.getTableRowAsEntity(headerRow, dataRow, false);
            // scenario.title = parser.bind(scenarioOutline.title, scenario.example);
            scenario.displayTitle = parser.bind(scenarioOutline.displayTitle, scenario.example);
            scenarioOutline.examples.push(scenario);
            scenario.sequence = scenarioOutline.examples.length;
        }

    }

    public createStep(type: string, description: string): model.StepDefinition {
        const parser = new DescriptionParser();
        parser.parseDescription(description);

        const step = new model.StepDefinition(null, parser.title);

        let indentation = 10;

        // This is the top level feature
        step.descriptionRaw = description;
        step.description = parser.description;
        step.docString = parser.docString;
        step.docStringRaw = parser.docString;
        step.dataTable = parser.dataTable;
        step.valuesRaw = parser.quotedValues;
        step.displayTitle = this.formatStepDisplayTitle(description, type, indentation);
        step.values = parser.coerceValues(step.valuesRaw);
        step.type = type;

        return step;
    }
}

export class DescriptionParser {
    public title: string = "";
    public description: string = "";
    public text: string = "";
    public tags: string[] = [];
    public tables: model.Table[] = [];
    public dataTable: DataTableRow[];
    public docString: string = "";
    public quotedValues: string[];

    constructor () {
        this.jsonDateParser = this.jsonDateParser.bind(this);
    }


    public parseDescription(text: string) {
        this.text = text;
        const textReader = new TextBlockReader(text);
        if (textReader.next()) {
            this.title = textReader.line.trim();

            // quoted values are only found in the title
            this.quotedValues = this.parseQuotedValues(textReader);
        }
        let descriptionIndex = -1;
        const descriptionLines: string[] = [];

        while (textReader.next()) {
            const line = textReader.line.trim();
            if (line.startsWith("@")) {
                this.tags.push(...line.replace(/@/g, '').split(' '));
            } else if (line.toLocaleLowerCase().startsWith("examples")) {
                // scenario outline table
                this.tables.push(this.parseTable(textReader));
            } else if (line.startsWith("|") && line.endsWith("|")) {
                // given/when/then data table
                this.dataTable = this.parseDataTable(textReader)
            } else if (line.startsWith('"""')) {
                this.docString = this.parseDocString(textReader);
            } else {
                // Add the rest to the description
                if (descriptionIndex < 0) {
                    // find the first non-whitespace character and use that as the split line
                    descriptionIndex = this.getFirstNonBlankIndex(textReader.line);
                }
                // TODO: may want to optimize later
                descriptionLines.push(this.trimStart(textReader.line, descriptionIndex));
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


    public getTableRowAsEntity(headerRow: DataTableRow, dataRow: DataTableRow, shouldCoerce: boolean = true): object {
        let entity = {};
        for (let p = 0; p < headerRow.length; p++) {
            // Copy column to header key
            entity[headerRow[p].toString()] = shouldCoerce ? this.coerceValue(dataRow[p]) : dataRow[p];
        }
        return entity;
    }

    public getTable(tableArray: DataTableRow[]): DataTableRow[] {
        let table: DataTableRow[] = [];

        if (tableArray.length === 0) {
            return table;
        }

        let header = tableArray[0];
        for (let i = 1; i < tableArray.length; i++) {
            let rowData = tableArray[i];
            let row: DataTableRow = {};
            for (let column = 0; column < rowData.length; column++) {
                // Copy column to header key
                row[header[column]] = this.coerceValue(rowData[column]);
            }
            table.push(row);
        }
        return table;
    }

    public coerceValues(values: string[]): any[] {
        const coercedArray = [];
        values.forEach(value => {
            coercedArray.push(this.coerceValue(value));
        });

        return coercedArray;
    }

    public coerceValue(valueString: string): any {
        // Use JSON.parse to do type conversion, if that fails return the original string
        try {
            return JSON.parse(valueString, this.jsonDateParser);
        } catch (e) {
            // Ok so its a string, but it could still be a special one!
            // Try checking if its a date
            const maybeDate = this.getMomentDate(valueString);
            if (maybeDate.isValid()) {
                return maybeDate.toDate();
            }

            return valueString;
        }
    }

    private getMomentDate(value: string) {
        var formats = [
            moment.ISO_8601,
            "MM/DD/YYYY"
        ];
        return moment(value, formats, true);
    }

    private jsonDateParser(key, value) {
        const maybeDate = this.getMomentDate(value);
        if (maybeDate.isValid()) {
            return maybeDate.toDate();
        }
        return value;
    }

    private isCommentedLine(line: string) {
        return line.startsWith("#") || line.startsWith("//");
    }

    private parseTable(textReader: TextBlockReader): model.Table {
        var table = new model.Table();
        table.name = textReader.line.trim().substr("Examples:".length).trim();
        while (textReader.next()) {

            if (!textReader.line.trim().startsWith("|")) {
                // Add this line to the description
                table.description += textReader.line + "\n";
            } else {
                break;
            }
        }

        // Check we didn't exhaust the text block
        if (textReader.line != null) {
            // Ok must have found the data table
            const dataTable = this.parseDataTable(textReader);
            table.dataTable = dataTable;
        }
        return table;
    }

    private parseDataTable(textReader: TextBlockReader): DataTableRow[] {
        // Looks like part of a table
        let line = textReader.line.trim();
        const dataTable: DataTableRow[] = [];

        while (line && line.startsWith("|") || this.isCommentedLine(line)) {
            // check if this is a line that has been commented
            if (!this.isCommentedLine(line)) {
                const rowData = line.split("|");
                let row: any[] = [];
                for (let i = 1; i < rowData.length - 1; i++) {
                    const valueString = rowData[i].trim();
                    row.push(valueString);
                }
                dataTable.push(row);
            }

            if (textReader.next()) {
                line = textReader.line.trim();
            } else {
                line = null;
            }
        }
        return dataTable;
    }

    private parseDocString(textReader: TextBlockReader): string {
        let docLines = [];
        const docStringStartIndex = textReader.line.indexOf('"');
        while (textReader.next()) {
            const trimmedLine = textReader.line.trim();
            if (trimmedLine.startsWith('"""')) {
                // end of the docString so can stop processing
                break;
            }
            docLines.push(this.trimStart(textReader.line, docStringStartIndex));
        }
        return docLines.join('\n');
    }

    private parseQuotedValues(textReader: TextBlockReader): string[] {
        let arrayOfValues = textReader.line.match(/(["'](.*?)["'])+/g);
        let results = [];
        if (arrayOfValues) {
            arrayOfValues.forEach(element => {
                const valueString = element.substr(1, element.length - 2).trim();
                results.push(valueString);
            });
        }
        return results;
    }

    private getFirstNonBlankIndex(text: string): number {
        for (let i = 0; i < text.length; i++) {
            if (text.charAt(i) != " ") {
                return i;
            }
        }
        return -1;
    }

    private trimStart(text: string, index: number) {
        if (index === -1) {
            return "";
        }
        if (index <= text.length) {
            return text.substr(index);
        }
        else {
            return text;
        }
    }

    public applyIndenting(text: string, spacing: number) {
        // This code needs to handle already indented lines
        const textReader = new TextBlockReader(text);

        // The first line is the title so ignore indenting for that
        let title = "";
        if (textReader.next()) {
            title = textReader.line;
        }
        // Now attempt to read the rest of the body if there is one and formatted based on the
        // indenting of the first line
        let textLines = [];
        textLines.push(title);
        let textIndentingStartIndex = -1;
        while (textReader.next()) {
            if (textIndentingStartIndex < 0) {
                textIndentingStartIndex = this.getFirstNonBlankIndex(textReader.line);
            }
            textLines.push(" ".repeat(spacing) + this.trimStart(textReader.line, textIndentingStartIndex));
        }

        return textLines.join('\n');
    }

    public bind(content, model) {
        var regex = new RegExp("<[^>]+>", "g");
        return content.replace(regex, (item, pos, originalText) => {
            return this.applyBinding(item, model);
        });
    }

    private applyBinding(item, model) {
        var key = this.sanitizeName(item.substr(1, item.length - 2));
        if (model.hasOwnProperty(key)) {
            return model[key];
        } else {
            return item;
        }
    }

    public sanitizeName(name: string): string {
        // removing spaces and apostrophes
        return name.replace(/[ `’']/g, "");
    }


}