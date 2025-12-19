import * as model from "../model/index";
import { TextBlockReader } from "../parser/TextBlockReader";
import * as diff from "diff";
import CliTable3 from "cli-table3";
import { ColorTheme } from "./ColorTheme";
import * as path from "path";
import stripAnsi from "strip-ansi";
import wordwrap from "wordwrap";

const wrap = (text: string) => {
    const terminalWidth = Math.min(process.stdout.columns || 120, 120);
    return wordwrap(terminalWidth)(text);
};

/**
 * Base class for all LiveDoc reporters providing formatting utilities
 * and abstract methods for feature/scenario/step hooks
 */
export abstract class LiveDocReporter {
    protected colorTheme: ColorTheme;
    protected useColors: boolean = true;

    constructor(colorTheme: ColorTheme, useColors: boolean = true) {
        this.colorTheme = colorTheme;
        this.useColors = useColors;
    }

    /**
     * Returns a string highlighting the differences between the actual
     * and expected strings.
     */
    protected createUnifiedDiff(actual: any, expected: any): string {
        const indent = '';
        const _this = this;
        
        function cleanUp(line: string) {
            if (line[0] === '+') {
                return indent + _this.colorTheme.statusPass(line);
            }
            if (line[0] === '-') {
                return indent + _this.colorTheme.statusFail(line);
            }
            if (line.match(/@@/)) {
                return '--';
            }
            if (line.match(/\\ No newline/)) {
                return null;
            }
            return indent + line;
        }
        
        function notBlank(line: string | null) {
            return typeof line !== 'undefined' && line !== null;
        }
        
        const msg = diff.createPatch('string', actual.toString(), expected.toString());
        const lines = msg.split('\n').splice(5);
        return (
            '\n' +
            _this.colorTheme.statusPass('+ expected') +
            ' ' +
            _this.colorTheme.statusFail('- actual') +
            '\n\n' +
            lines
                .map(cleanUp)
                .filter(notBlank)
                .join('\n')
        );
    }

    /**
     * Returns the content indented by the number of spaces specified
     */
    protected applyBlockIndent(content: string, indent: number): string {
        const reader: TextBlockReader = new TextBlockReader(content);
        const indentPadding = " ".repeat(indent);
        const lines: string[] = [];
        
        while (reader.next()) {
            lines.push(indentPadding + reader.line);
        }

        return lines.join("\n");
    }

    /**
     * Will highlight matches based on the supplied regEx with the supplied color
     */
    protected highlight(content: string, regex: RegExp, color: any): string {
        return content.replace(regex, (item) => {
            return color(item);
        });
    }

    /**
     * Will return the string substituting placeholders defined with <..> with 
     * the value from the example
     */
    protected bind(content: string, model: any, color: any): string {
        if (!model) return content;

        const regex = new RegExp("<[^>]+>", "g");
        return content.replace(regex, (item) => {
            return color(this.applyBinding(item, model));
        });
    }

    /**
     * Will return the string substituting placeholders defined with {{..}} with 
     * the value from the passed parameter
     */
    protected secondaryBind(content: string, model: any, color: any): string {
        if (!model) return content;

        const regex = new RegExp("{{[^}]+}}", "g");
        return content.replace(regex, (item) => {
            return color(this.applyBinding(item, model, 2));
        });
    }

    private applyBinding(item: string, model: any, bindingSyntaxLength = 1): string {
        const key = this.sanitizeName(item.substr(bindingSyntaxLength, item.length - bindingSyntaxLength * 2));
        if (model.hasOwnProperty(key)) {
            return model[key];
        } else {
            throw new Error(`Binding error: '${key}' does not exist in model. Verify the spelling and that the name still exists in the bound model.`);
        }
    }

    protected escapeRegExp(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    protected sanitizeName(name: string): string {
        // removing spaces and apostrophes
        return name.replace(/[ `'']/g, "");
    }

    /**
     * Returns a formatted table of the dataTable data
     */
    protected formatTable(dataTable: any[][], headerStyle: HeaderType, includeRowId: boolean = false, runningTotal: number = 0): string {
        // Safety check
        if (!dataTable || dataTable.length === 0 || !dataTable[0]) {
            return "";
        }
        
        // Determine the formatting based on table size etc
        if (headerStyle === HeaderType.none) {
            headerStyle = HeaderType.Top;
            if (dataTable[0].length === 2) {
                // A two column table typically means the items are key, value
                headerStyle = HeaderType.Left;
            } else if (!isNaN(Number(dataTable[0][0].trim()))) {
                // first value is a number so likely not a header left or top
                headerStyle = HeaderType.none;
            }
        }

        const table: any = new CliTable3({});

        for (let i = 0; i < dataTable.length; i++) {
            // make a copy so we don't corrupt the original
            table.push(dataTable[i].slice());

            // Format the cell within the row if necessary
            switch (headerStyle) {
                case HeaderType.Left:
                    table[i][0] = this.colorTheme.dataTableHeader(wrap(dataTable[i][0]));
                    const rowColor = this.colorTheme.dataTable;
                    for (let c = 1; c < table[i].length; c++) {
                        table[i][c] = rowColor(wrap(dataTable[i][c]));
                    }
                    break;
                case HeaderType.Top:
                    const offset = includeRowId ? 1 : 0;
                    if (i === 0) {
                        if (includeRowId) {
                            table[i][0] = " ";
                        }
                        for (let c = 0; c < dataTable[0].length; c++) {
                            table[i][c + offset] = this.colorTheme.dataTableHeader(wrap(dataTable[0][c]));
                        }
                    } else {
                        let rowColor: any = this.colorTheme.dataTable;
                        if (table[i][0].toString().indexOf("Total") >= 0) {
                            rowColor = rowColor.bold;
                        }
                        if (includeRowId) {
                            table[i][0] = rowColor((i + runningTotal).toString());
                        }
                        if (table[0].length > 1 && table[i].length === 1) {
                            // this is a header row used in the summary table
                            table[i][0 + offset] = this.colorTheme.summaryHeader(wrap(dataTable[i][0]));
                        } else {
                            for (let c = 0; c < dataTable[i].length; c++) {
                                table[i][c + offset] = rowColor(wrap(dataTable[i][c]));
                            }
                        }
                    }
                    break;
            }
        }
        return table.toString();
    }

    /**
     * Finds the common root path from an array of file paths
     */
    public static findRootPath(strs: string[]): string {
        if (!strs || strs.length === 0)
            return "";
        if (strs.length === 1)
            return path.dirname(strs[0]);

        // as we're dealing with root paths, need to ensure the strings
        // are only paths
        for (let i = 0; i < strs.length; i++) {
            // ensure any \ are converted to / as well
            strs[i] = path.dirname(strs[i]);
        }
        
        // find the shortest string
        let shortestString = "";
        let shortestLength = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < strs.length; i++) {
            if (strs[i].length < shortestLength) {
                shortestString = strs[i];
                shortestLength = shortestString.length;
            }
        }

        const matchPrefix = function (prefix: string) {
            for (let i = 0; i < strs.length; i++) {
                if (!strs[i].startsWith(prefix)) {
                    return false;
                }
            }
            return true;
        }

        let l = 0;
        let h = shortestString.length - 1;

        let scp = "";
        while (l <= h) {
            const mid = Math.floor((l + h) / 2);
            const prefix = shortestString.substr(0, mid + 1);
            if (matchPrefix(prefix)) {
                scp = prefix;
                l = mid + 1;
            } else {
                h = mid - 1;
            }
        }
        return scp;
    }

    protected createPathFromFile(filename: string, rootPath: string): string {
        const stripPath = filename.substr(rootPath.length);
        if (rootPath.length === 0 || stripPath === "") {
            return "";
        } else {
            let dirPath = path.parse(stripPath).dir;
            if (dirPath.startsWith(path.sep)) {
                return dirPath.substr(1);
            } else {
                return dirPath;
            }
        }
    }

    /**
     * Adds the text to the reporters output stream
     */
    protected writeLine(text: string): void {
        if (text) {
            if (!this.useColors) {
                text = stripAnsi(text);
            }
            console.log(text);
        }
    }

    /**
     * Adds the text to the reporters output stream without a line return
     */
    protected write(text: string): void {
        if (text) {
            if (!this.useColors) {
                text = stripAnsi(text);
            }
            process.stdout.write(text);
        }
    }

    //#region Abstract Reporting Interface - Subclasses can override these

    protected executionStart(): void { }
    protected executionEnd(_results: model.ExecutionResults): void { }
    protected featureStart(_feature: model.Feature): void { }
    protected featureEnd(_feature: model.Feature): void { }
    protected scenarioStart(_scenario: model.Scenario): void { }
    protected scenarioEnd(_scenario: model.Scenario): void { }
    protected scenarioOutlineStart(_scenario: model.ScenarioOutline): void { }
    protected scenarioOutlineEnd(_scenario: model.ScenarioOutline): void { }
    protected scenarioExampleStart(_example: model.ScenarioExample): void { }
    protected scenarioExampleEnd(_example: model.ScenarioExample): void { }
    protected backgroundStart(_background: model.Background): void { }
    protected backgroundEnd(_background: model.Background): void { }
    protected stepStart(_step: model.StepDefinition): void { }
    protected stepEnd(_step: model.StepDefinition): void { }
    protected stepExampleStart(_step: model.StepDefinition): void { }
    protected stepExampleEnd(_step: model.StepDefinition): void { }
    protected suiteStart(_suite: model.VitestSuite): void { }
    protected suiteEnd(_suite: model.VitestSuite): void { }
    protected testStart(_test: model.LiveDocTest<model.VitestSuite>): void { }
    protected testEnd(_test: model.LiveDocTest<model.VitestSuite>): void { }

    //#endregion
}

export enum HeaderType {
    none,
    Top,
    Left
}
/// <reference path='../types.d.ts' />