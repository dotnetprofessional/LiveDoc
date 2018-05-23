import { ReporterTheme } from "./ReporterTheme";
import * as model from "../model";
import { TextBlockReader } from "../parser/TextBlockReader";
import { ReportWriter } from "./ReportWriter";
import { Chalk } from "chalk";
import { ColorTheme } from "./ColorTheme";
import * as cliTable from "cli-table2";
import * as diff from "diff";

enum StatusIdentifiers {
    pass = '√',
    fail = 'X',
    pending = '-',
    bang = '!',
    statusBarPass = "+",
    statusBarFail = "X",
    statusBarPending = "-",
};

export enum DetailLevel {
    auto = "auto",
    verbose = "verbose",
    summary = "summary",
    list = "list"
}

export class LiveDocReporterOptions {
    detailLevel: DetailLevel
};

export class DefaultReporter implements ReporterTheme {
    private _options: LiveDocReporterOptions;
    private suiteIndent: number = 0;

    public get options(): LiveDocReporterOptions {
        if (!this._options) {
            // Default value
            this._options = { detailLevel: DetailLevel.verbose };
        } else if (!this._options.detailLevel || this._options.detailLevel === DetailLevel.auto) {
            this._options.detailLevel = DetailLevel.verbose;
        }

        return this._options;
    }

    public set options(options: LiveDocReporterOptions) {
        this._options = options;
    }

    public colorTheme: ColorTheme;

    executionStart(output: ReportWriter): void {
    }

    executionEnd(results: model.ExecutionResults, output: ReportWriter): void {
        if (results.features.length > 0)
            this.outputFeatureExecutionSummary(results, output);

        if (results.suites.length > 0)
            this.outputSuiteExecutionSummary(results, output);

        this.outputExceptionReport(results, output);
    }

    featureStart(feature: model.Feature, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            this.outputFeature(feature, output);
    }

    featureEnd(feature: model.Feature, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            output.writeLine(" ");
    }

    scenarioStart(scenario: model.Scenario, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            this.outputScenario(scenario, output);
    }

    scenarioEnd(scenario: model.Scenario, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            output.writeLine(" ");
    }

    scenarioOutlineStart(scenario: model.ScenarioOutline, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            this.outputScenarioOutline(scenario, output);
    }

    scenarioOutlineEnd(scenario: model.ScenarioOutline, output: ReportWriter): void {
    }

    scenarioExampleStart(example: model.ScenarioExample, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose) {
            const lines: string[] = [];
            lines.push(this.formatKeywordTitle("Example", example.sequence.toString(), this.colorTheme.keyword, this.colorTheme.scenarioTitle, 4));

            output.writeLine(lines);
        }
    }

    scenarioExampleEnd(example: model.ScenarioExample, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            output.writeLine(" ");
    }

    stepExampleStart(step: model.StepDefinition, output: ReportWriter): void {
    }

    stepExampleEnd(step: model.StepDefinition, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            this.outputStep(step, false, output);
    }

    backgroundStart(background: model.Background, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose) {
            const lines: string[] = [];
            lines.push(this.formatKeywordTitle("Background", background.title, this.colorTheme.keyword, this.colorTheme.backgroundTitle, 4));

            output.writeLine(lines);
        }
    }

    backgroundEnd(background: model.Background, output: ReportWriter): void { }

    stepStart(step: model.StepDefinition, output: ReportWriter): void {
    }

    stepEnd(step: model.StepDefinition, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose)
            this.outputStep(step, false, output);
    }

    suiteStart(suite: any, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose) {
            this.suiteIndent += 2;
            output.writeLine(" ");
            output.writeLine(this.applyBlockIndent(this.colorTheme.featureTitle(suite.title), this.suiteIndent));
        }
    }

    suiteEnd(suite: any, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose) {
            this.suiteIndent -= 2;
        }
    }

    testStart(test: any, output: ReportWriter): void {
    }

    testEnd(test: any, output: ReportWriter): void {
        if (this.options.detailLevel === DetailLevel.verbose) {
            this.outputTest(test, output);
        }
    }

    private outputFeature(feature: model.Feature, output: ReportWriter) {
        const lines: string[] = [];
        let indent = 2;
        lines.push(this.formatKeywordTitle("Feature", feature.title, this.colorTheme.keyword, this.colorTheme.featureTitle, indent));
        indent += 2;
        if (feature.tags.length > 0) lines.push(this.applyBlockIndent(this.formatTags(feature.tags), indent));
        if (feature.description.length > 0) lines.push(this.formatDescription(feature.description, indent, this.colorTheme.featureDescription));

        output.writeLine(lines);
    }

    private outputScenarioOutline(scenario: model.ScenarioOutline, output: ReportWriter) {
        let indent = 4;

        output.writeLine(this.formatKeywordTitle("Scenario Outline", scenario.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
        indent += 2;
        if (scenario.tags.length > 0) output.writeLine(this.applyBlockIndent(this.formatTags(scenario.tags), indent));
        if (scenario.description.length > 0) output.writeLine(this.formatDescription(scenario.description, indent, this.colorTheme.scenarioDescription));

        // display the steps
        scenario.steps.forEach(step => {
            this.outputStep(step, true, output);
        });

        output.writeLine(" "); // line break
        indent += 2;
        for (let i = 0; i < scenario.tables.length; i++) {
            // Output the Examples table
            output.writeLine(this.applyBlockIndent(this.colorTheme.keyword("Examples: " + scenario.tables[i].name), indent));
            output.writeLine(this.applyBlockIndent(this.formatTable(scenario.tables[i].dataTable, HeaderType.Top), indent));
        }
    }

    private outputScenario(scenario: model.Scenario, output: ReportWriter) {
        const lines: string[] = [];
        let indent = 4;
        lines.push(this.formatKeywordTitle("Scenario", scenario.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
        indent += 2;
        if (scenario.tags.length > 0) lines.push(this.applyBlockIndent(this.formatTags(scenario.tags), indent));
        if (scenario.description.length > 0) lines.push(this.formatDescription(scenario.description, indent, this.colorTheme.scenarioDescription));

        output.writeLine(lines);
    }

    private outputFeatureExecutionSummary(results: model.ExecutionResults, output: ReportWriter) {
        const headerRow = [
            "Feature",
            "Scenarios",
            "status",
            "Pass",
            "Fail",
            "Pending",
            "Warnings"
        ];

        const statistics: DataTableRow[] = [];
        statistics.push(headerRow);

        results.features.forEach(feature => {
            // Add the stats for the feature
            const stats = feature.statistics;
            const statusBar = this.statusBar(stats.passPercent, stats.failedPercent, stats.pendingPercent);

            statistics.push([
                this.formatLine(feature.title),
                feature.scenarios.length,
                statusBar,
                feature.statistics.passCount,
                feature.statistics.failedCount,
                feature.statistics.pendingCount,
                feature.statistics.totalRuleViolations
            ]);

            if (this.options.detailLevel !== DetailLevel.list) {
                return;
            }
            // Output the specific scenarios for the feature
            feature.scenarios.forEach(scenario => {
                const stats = scenario.statistics;
                const statusBar = this.statusBar(stats.passPercent, stats.failedPercent, stats.pendingPercent);
                statistics.push([
                    this.formatLine("  " + scenario.title),
                    " ",
                    statusBar,
                    scenario.statistics.passCount,
                    scenario.statistics.failedCount,
                    scenario.statistics.pendingCount,
                    scenario.statistics.totalRuleViolations
                ]);
            });

        });

        // Now add a totals row
        const totalStats = {
            total: results.features.reduce((pv, cv) => pv + cv.statistics.totalCount, 0),
            scenarios: results.features.reduce((pv, cv) => pv + cv.scenarios.length, 0),
            pass: results.features.reduce((pv, cv) => pv + cv.statistics.passCount, 0),
            failed: results.features.reduce((pv, cv) => pv + cv.statistics.failedCount, 0),
            pending: results.features.reduce((pv, cv) => pv + cv.statistics.pendingCount, 0),
            warnings: results.features.reduce((pv, cv) => pv + cv.statistics.totalRuleViolations, 0),
        };

        statistics.push([
            "Totals (" + results.features.length + ")",
            totalStats.scenarios,
            this.statusBar(totalStats.pass / totalStats.total, totalStats.failed / totalStats.total, totalStats.pending / totalStats.total),
            totalStats.pass,
            totalStats.failed,
            totalStats.pending,
            totalStats.warnings
        ])

        output.writeLine(this.applyBlockIndent(this.formatTable(statistics, HeaderType.Top), 2));
    }

    private formatLine(text: string): string {
        const maxLen = 60;
        if (text.length > maxLen) {
            return text.substr(0, maxLen) + "...";
        } else {
            return text;
        }
    }

    private outputSuiteExecutionSummary(results: model.ExecutionResults, output: ReportWriter) {
        const headerRow = [
            "Suite",
            "status",
            "Pass",
            "Fail",
            "Pending"
        ];

        const statistics: DataTableRow[] = [];
        statistics.push(headerRow);

        results.suites.forEach(suite => {
            // Add the stats for the feature
            const stats = suite.statistics;
            const statusBar = this.statusBar(stats.passPercent, stats.failedPercent, stats.pendingPercent);

            statistics.push([
                suite.title,
                statusBar,
                suite.statistics.passCount,
                suite.statistics.failedCount,
                suite.statistics.pendingCount
            ]);
        });

        // Now add a totals row
        const totalStats = {
            total: results.suites.reduce((pv, cv) => pv + cv.statistics.totalCount, 0),
            pass: results.suites.reduce((pv, cv) => pv + cv.statistics.passCount, 0),
            failed: results.suites.reduce((pv, cv) => pv + cv.statistics.failedCount, 0),
            pending: results.suites.reduce((pv, cv) => pv + cv.statistics.pendingCount, 0),
            warnings: results.suites.reduce((pv, cv) => pv + cv.statistics.totalRuleViolations, 0),
        };

        statistics.push([
            "Totals (" + results.features.length + ")",
            this.statusBar(totalStats.pass / totalStats.total, totalStats.failed / totalStats.total, totalStats.pending / totalStats.total),
            totalStats.pass,
            totalStats.failed,
            totalStats.pending,
        ])

        output.writeLine(this.applyBlockIndent(this.formatTable(statistics, HeaderType.Top), 2));
    }

    private statusBar(passPercent: number, failedPercent: number, pendingPercent: number) {
        const calcBar = (symbol: string, percent: number) => {
            let bar = symbol.repeat(barSize * percent);
            if (percent > 0 && bar.length === 0) {
                bar = symbol;
            }
            return bar;
        };

        const barSize = 30;
        let passBar = calcBar(StatusIdentifiers.statusBarPass, passPercent);
        let failBar = calcBar(StatusIdentifiers.statusBarFail, failedPercent);
        let pendingBar = calcBar(StatusIdentifiers.statusBarPending, pendingPercent);


        while (passBar.length + failBar.length + pendingBar.length > barSize) {
            const longest = Math.max(passBar.length, failBar.length, pendingBar.length);
            if (passBar.length === longest) {
                passBar = passBar.substr(0, passBar.length - 1);
            } else if (failBar.length === longest) {
                failBar = failBar.substr(0, failBar.length - 1);
            } else {
                pendingBar = pendingBar.substr(0, pendingBar.length - 1);
            }
        }

        return this.colorTheme.statusPass.inverse(passBar) +
            this.colorTheme.statusFail.inverse(failBar) +
            this.colorTheme.statusPending.inverse(pendingBar);
    }

    private outputExceptionReport(results: model.ExecutionResults, output: ReportWriter) {
        results.features.forEach(feature => {
            this.outputFeatureError(feature, output);
        });

        this.suiteIndent = 0;
        results.suites.forEach(suite => {
            this.suiteIndent += 2;
            this.outputSuiteError(suite, output);
            this.suiteIndent -= 2;
        });
    }

    private outputFeatureError(feature: model.Feature, output: ReportWriter) {
        // Validate that the feature has errors
        if (feature.statistics.failedCount > 0) {
            const lines: string[] = [];
            let indent = 2;
            output.writeLine(this.formatKeywordTitle("Feature", feature.title, this.colorTheme.keyword, this.colorTheme.featureTitle, indent));
            indent += 2;

            // This will repeat the feature/scenario detail but at a minimized level, enough to provide
            // context.
            feature.scenarios.forEach(scenario => {
                if (scenario.statistics.failedCount > 0) {
                    if (scenario.constructor.name === "ScenarioOutline") {
                        const scenarioOutline = scenario as model.ScenarioOutline;
                        output.writeLine(this.formatKeywordTitle("Scenario Outline", scenarioOutline.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
                        // display the steps
                        scenarioOutline.steps.forEach(step => {
                            this.outputStep(step, true, output);
                        });

                        // TODO: Consider highlighting Example row in Examples output for those that failed
                        // output.writeLine(" "); // line break
                        // indent += 2;
                        // for (let i = 0; i < scenarioOutline.tables.length; i++) {
                        //     // Output the Examples table
                        //     output.writeLine(this.applyBlockIndent(this.colorTheme.keyword("Examples: " + scenarioOutline.tables[i].name), indent));
                        //     output.writeLine(this.applyBlockIndent(this.formatTable(scenarioOutline.tables[i].dataTable, HeaderType.Top), indent));
                        // }

                        output.writeLine(" "); // line break
                        indent += 2;

                        // Now output any example that has errors
                        scenarioOutline.examples.forEach(example => {
                            if (example.statistics.failedCount > 0) {
                                output.writeLine(this.formatKeywordTitle("Example", example.sequence.toString(), this.colorTheme.statusFail, this.colorTheme.scenarioTitle, 4));
                                example.steps.forEach(step => {
                                    this.outputStep(step, false, output);
                                    if (step.status === model.SpecStatus.fail) {
                                        this.outputStepError(step, output);
                                    }
                                });
                            }
                        });
                    } else {
                        output.writeLine(this.formatKeywordTitle("Scenario", scenario.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
                        scenario.steps.forEach(step => {
                            this.outputStep(step, false, output);
                            if (step.status === model.SpecStatus.fail) {
                                this.outputStepError(step, output);
                            }
                        });
                    }
                }
            });
        }
    }

    private outputSuiteError(suite: model.MochaSuite, output: ReportWriter) {
        // Validate that the Suite has errors
        if (suite.statistics.failedCount > 0) {
            let indent = 2;
            output.writeLine(this.applyBlockIndent(this.colorTheme.featureTitle(suite.title), this.suiteIndent + indent));
            this.suiteIndent += 2;

            suite.tests.forEach(test => {
                this.outputTest(test, output);
                if (test.status === model.SpecStatus.fail) {
                    this.outputStepError(test, output);
                }
            });
            this.suiteIndent -= 2;

            // Mocha Suites can have any level of depth
            suite.children.forEach(child => {
                this.suiteIndent += 2;
                this.outputSuiteError(child, output);
                this.suiteIndent -= 2;
            });
        }
    }

    private outputStepError(step: model.LiveDocTest<any>, output: ReportWriter) {
        const color = this.colorTheme.dataTable;

        const table = new cliTable({
            chars: {
                'top': color('─')
                , 'top-mid': color('┬')
                , 'top-left': color('┌')
                , 'top-right': color('┐')
                , 'bottom': color('─')
                , 'bottom-mid': color('┴')
                , 'bottom-left': color('└')
                , 'bottom-right': color('┘')
                , 'left': color('│')
                , 'left-mid': color('├')
                , 'mid': color('─')
                , 'mid-mid': color('┼')
                , 'right': color('│')
                , 'right-mid': color('┤')
                , 'middle': color('│')
            }
        });
        table.push([{ colSpan: 2, content: color('Error') }]);
        table.push(["Message", step.exception.message]);
        if (step.exception.expected) {
            table.push(["Diff", this.createUnifiedDiff(step.exception.actual, step.exception.expected)]);
        }
        table.push(["Code", step.code.replace(/\r/g, "")]);
        table.push(["Stack trace", step.exception.stackTrace]);
        if (step.constructor.name === "StepDefinition") {
            table.push(["Filename", step.parent.parent.filename]);
        } else {
            table.push(["Filename", step.parent.filename]);
        }

        output.writeLine(table.toString());
    }

    private outputStep(step: model.StepDefinition, useDefinition: boolean, output: ReportWriter) {
        const lines: string[] = [];
        let indent = 6;
        let titleColor = this.colorTheme.stepDescription;

        let hangingIndent = 0;
        if (["and", "but"].indexOf(step.type) >= 0) {
            hangingIndent = 2;
        }

        let indicator: string;
        if (useDefinition) {
            indicator = this.colorTheme.statusUnknown("");
            titleColor = this.colorTheme.statusPass;
        } else {
            switch (step.status) {
                case model.SpecStatus.pass:
                    indicator = this.colorTheme.statusPass(StatusIdentifiers.pass);
                    titleColor = this.colorTheme.statusPass;
                    break;
                case model.SpecStatus.pending:
                    indicator = this.colorTheme.statusPending(StatusIdentifiers.pending);
                    titleColor = this.colorTheme.statusPending;
                    break;
                case model.SpecStatus.fail:
                    indicator = this.colorTheme.statusFail(StatusIdentifiers.fail);
                    titleColor = this.colorTheme.statusFail;
                    break;
                case model.SpecStatus.unknown:
                    indicator = this.colorTheme.statusUnknown(StatusIdentifiers.bang);
                    titleColor = this.colorTheme.statusUnknown;
                    break;
            }
        }
        let title: string = step.title;
        if ((step.parent as model.ScenarioExample).example) {
            if (useDefinition) {
                // Apply any binding if necessary
                title = this.highlight(title, new RegExp("<[^>]+>", "g"), this.colorTheme.valuePlaceholders);
            } else {
                // Apply any binding if necessary
                title = this.bind(step.title, (step.parent as model.ScenarioExample).example, this.colorTheme.valuePlaceholders);
            }
        }

        // Now highlight any values within the title
        title = this.highlight(title, /('[^']+')|("[^"]+")/g, this.colorTheme.valuePlaceholders)

        lines.push(`${" ".repeat(indent)}${indicator} ${" ".repeat(hangingIndent)}${this.colorTheme.stepKeyword(step.type)} ${titleColor(title)}`);
        indent += 4;
        if (step.description) lines.push(this.applyBlockIndent(step.description, indent + hangingIndent));
        if (step.docString) {

            let docString = step.docStringRaw;
            if (step.docString != docString) {
                if (useDefinition) {
                    // output the docString before binding
                    docString = this.highlight(step.docStringRaw, new RegExp("<[^>]+>", "g"), this.colorTheme.valuePlaceholders);
                } else {
                    docString = this.bind(step.docStringRaw, (step.parent as model.ScenarioExample).example, this.colorTheme.valuePlaceholders);
                }
            } else {
                // non scenario outline based doc string
                docString = step.docString;
            }

            lines.push(this.applyBlockIndent(this.colorTheme.docString(`"""\n${docString}\n"""`), indent + hangingIndent));
        }
        if (step.dataTable) lines.push(this.applyBlockIndent(this.formatTable(step.dataTable, HeaderType.none), indent + hangingIndent));

        output.writeLine(lines);
    }

    private outputTest(step: model.LiveDocTest<any>, output: ReportWriter) {
        const lines: string[] = [];
        let indent = 2;
        let titleColor = this.colorTheme.stepDescription;

        let indicator: string;
        switch (step.status) {
            case model.SpecStatus.pass:
                indicator = this.colorTheme.statusPass(StatusIdentifiers.pass);
                titleColor = this.colorTheme.statusPass;
                break;
            case model.SpecStatus.pending:
                indicator = this.colorTheme.statusPending(StatusIdentifiers.pending);
                titleColor = this.colorTheme.statusPending;
                break;
            case model.SpecStatus.fail:
                indicator = this.colorTheme.statusFail(StatusIdentifiers.fail);
                titleColor = this.colorTheme.statusFail;
                break;
            case model.SpecStatus.unknown:
                indicator = this.colorTheme.statusUnknown(StatusIdentifiers.bang);
                titleColor = this.colorTheme.statusUnknown;
                break;
        }

        lines.push(`${" ".repeat(this.suiteIndent + indent)}${indicator} ${titleColor(step.title)}`);

        output.writeLine(lines);
    }

    private formatKeywordTitle(keyword: string, title: string, keywordColor: Chalk, titleColor: Chalk, indent: number): string {
        return `${" ".repeat(indent)}${keywordColor(keyword + ": ")}${titleColor(title)}`;
    }

    private formatDescription(description: string, indent: number, theme: Chalk) {
        const formattedBlock = this.applyBlockIndent(description, indent);
        return theme(formattedBlock);
    }

    private formatTags(tags: string[]): string {
        const output = tags.map((tag) => {
            return this.colorTheme.tags("@" + tag);
        });

        return output.join(" ");
    }

    private applyBlockIndent(content: string, indent: number): string {
        const reader: TextBlockReader = new TextBlockReader(content);

        const indentPadding = " ".repeat(indent);
        let lines: string[] = [];
        while (reader.next()) {
            lines.push(indentPadding + reader.line);
        }

        return lines.join("\n");
    }

    private highlight(content, regex: RegExp, color: Chalk) {
        return content.replace(regex, (item, pos, originalText) => {
            return color(item);
        });

    }

    public bind(content, model, color: Chalk) {
        var regex = new RegExp("<[^>]+>", "g");
        return content.replace(regex, (item, pos, originalText) => {
            return color(this.applyBinding(item, model));
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

    private sanitizeName(name: string): string {
        // removing spaces and apostrophes
        return name.replace(/[ `’']/g, "");
    }

    private formatTable(dataTable: DataTableRow[], headerStyle: HeaderType) {
        // const headers = step.dataTable[0];
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

        const table = new cliTable({});

        for (let i = 0; i < dataTable.length; i++) {
            // make a copy so we don't corrupt the original
            table.push(dataTable[i].slice());

            // Format the cell within the row if necessary
            switch (headerStyle) {
                case HeaderType.Left:
                    table[i][0] = this.colorTheme.dataTableHeader(dataTable[i][0]);
                    let rowColor = this.colorTheme.dataTable;
                    for (let c = 1; c < table[i].length; c++) {
                        table[i][c] = rowColor(table[i][c]);
                    }
                    break;
                case HeaderType.Top:
                    if (i === 0) {
                        for (let c = 0; c < dataTable[0].length; c++) {
                            table[0][c] = this.colorTheme.dataTableHeader(dataTable[0][c]);
                        }
                    } else {
                        let rowColor = this.colorTheme.dataTable;
                        if (table[i][0].indexOf("Total") >= 0) {
                            rowColor = rowColor.bold;
                        }
                        for (let c = 0; c < table[i].length; c++) {
                            table[i][c] = rowColor(table[i][c]);
                        }
                    }

                    break;
            }
        }
        return table.toString();
    }

    //#region Diff

    private createDiff(actual: string, expected: string): string {
        var diffResult = diff.diffWordsWithSpace(actual, expected);
        let result: string = "";

        diffResult.forEach((part) => {
            // green for additions, red for deletions
            // grey for common parts
            var color = part.added ? this.colorTheme.statusPass :
                part.removed ? this.colorTheme.statusFail : this.colorTheme.statusPending;
            result += color(part.value);
        });

        return result;
    }

    private createUnifiedDiff(actual, expected) {
        var indent = '';
        const _this = this;
        function cleanUp(line) {
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
        function notBlank(line) {
            return typeof line !== 'undefined' && line !== null;
        }
        var msg = diff.createPatch('string', actual, expected);
        var lines = msg.split('\n').splice(5);
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

    //#endregion
}

enum HeaderType {
    none,
    Top,
    Left
}
