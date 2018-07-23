import * as model from "../model"
import { TextBlockReader } from "../parser/TextBlockReader";
import * as diff from "diff";
import * as cliTable from "cli-table2";
import { Chalk } from "chalk";

import { SpecStatus } from "../model/SpecStatus";
import { LiveDocContext } from "../LiveDocContext";
import * as fvn from "fnv-plus";
import { ExecutionResults } from "../model";
import { LiveDocOptions } from "../LiveDocOptions";
import * as strip from "strip-ansi";
import { ColorTheme } from "./ColorTheme";

var Base = require('mocha').reporters.Base

/**
 * Module dependencies.
 */

export abstract class LiveDocReporter extends Base {
    protected options: Object;
    protected colorTheme: ColorTheme;

    constructor (runner, protected mochaOptions) {
        super(runner);
        const _this = this;
        const livedocOptions: LiveDocOptions = mochaOptions.livedoc;

        this.colorTheme = livedocOptions.reporterOptions.colors;
        this.setOptions(mochaOptions.reporterOptions);

        let executionResults: ExecutionResults;

        this.executionStart();

        runner.on('suite', function (suite) {
            try {

                const livedocContext: LiveDocContext = suite.livedoc;

                // Add a unique Id
                const testContainer = _this.getTestContainer(suite);
                if (!testContainer) {
                    return;
                }
                testContainer.id = `${testContainer.parent ? testContainer.parent.id + "-" : ""}${fvn.hash(testContainer.title).str()}`;

                // Notify reporter
                switch (livedocContext.type) {
                    case "Feature":
                        _this.featureStart(testContainer);
                        break;
                    case "Background":
                        _this.backgroundStart(testContainer);
                        break;
                    case "Scenario":
                        _this.scenarioStart(testContainer);
                        break;
                    case "Scenario Outline":
                        // Check if this is an Example or the original    
                        if (testContainer.sequence === 1) {
                            _this.scenarioOutlineStart(testContainer.scenarioOutline);
                        }

                        _this.scenarioExampleStart(testContainer);
                        break;
                    default:
                        _this.suiteStart(testContainer);
                }
            }
            catch (e) {
                console.error("Reporter error: ", e);
            }
        });

        runner.on('suite end', function (suite) {
            try {
                const livedocContext: LiveDocContext = suite.livedoc;
                const testContainer = _this.getTestContainer(suite);
                if (!testContainer) {
                    return;
                }

                switch (livedocContext.type) {
                    case "Feature":
                        _this.featureEnd(testContainer);
                        break;
                    case "Background":
                        _this.backgroundEnd(testContainer);
                        break;
                    case "Scenario":
                        _this.scenarioEnd(testContainer);
                        break;
                    case "Scenario Outline":
                        _this.scenarioExampleEnd(testContainer);

                        if (testContainer.sequence === testContainer.scenarioOutline.examples.length) {
                            _this.scenarioOutlineEnd(testContainer);
                        }
                        break;
                    default:
                        _this.suiteEnd(testContainer);
                }
            }
            catch (e) {
                console.error("Reporter error: ", e);
            }
        });

        runner.on('test', function (test: any) {
            try {
                const step: model.LiveDocTest<any> = test.step;
                if (!step.id) {
                    step.id = `${step.parent.id}-${fvn.hash(test.title).str()}`;
                }

                if (step.constructor.name === "StepDefinition") {
                    const stepDefinition = step as model.StepDefinition;
                    if (stepDefinition.parent.constructor.name === "ScenarioExample") {
                        _this.stepExampleStart(test.step);
                    } else {
                        _this.stepStart(test.step);
                    }
                } else {
                    _this.testStart(step);
                }
            }
            catch (e) {
                console.error("Reporter error: ", e);
            }
        });

        runner.on('test end', function (test: any) {
            try {
                const step: model.LiveDocTest<any> = test.step;

                step.code = test.fn ? test.fn.toString() : "";
                step.duration = test.duration || 0;
                step.setStatus(step.status, step.duration);

                if (step.constructor.name === "StepDefinition") {
                    const stepDefinition = step as model.StepDefinition;
                    if (stepDefinition.parent.constructor.name === "ScenarioExample") {
                        _this.stepExampleEnd(test.step);
                    } else {
                        _this.stepEnd(test.step);
                    }
                } else {
                    _this.testEnd(step);
                }

                // locate the executionResults
                if (!executionResults) {
                    executionResults = _this.getExecutionResults(test);
                }
            }
            catch (e) {
                console.error("Reporter error: ", e);
            }
        });

        runner.on('pass', function (test: Mocha.ITest) {
            (test as any).step.status = SpecStatus.pass;
        });

        runner.on('fail', function (test: any) {
            try {
                const step: model.LiveDocTest<any> = test.step;
                if (!step) {
                    // For some reason we dont' have a step 
                    return;
                }
                step.status = SpecStatus.fail;
                test = test as any;
                if (test.err) {
                    step.exception.actual = test.err.actual || "";
                    step.exception.expected = test.err.expected || "";
                    step.exception.stackTrace = test.err.stack || "";
                    step.exception.message = test.err.message || "";
                }
            }
            catch (e) {
                console.error("Reporter error: ", e);
            }
        });

        runner.on('pending', function (test: Mocha.ITest) {
            (test as any).step.status = SpecStatus.pending;
        });

        runner.on('end', function (test) {
            try {
                // results have all tests that have been defined, not just
                // those that were executed. As such need to remove those
                // that were not executed

                const actualResults = new ExecutionResults();
                executionResults.features.forEach((feature, index) => {
                    if (feature.statistics.totalCount !== 0) {
                        const featureClone = Object.assign(new model.Feature(), feature);
                        actualResults.features.push(featureClone);
                        // Now remove any scenarios don't have any results
                        featureClone.scenarios = featureClone.scenarios.filter(scenario => scenario.statistics.totalCount !== 0);
                    }
                });

                executionResults.suites.forEach((suite, index) => {
                    if (suite.statistics.totalCount !== 0) {
                        const suite = executionResults.suites[index];
                        actualResults.suites.push(suite);
                        // Now remove any scenarios don't have any results
                        suite.children = suite.children.filter(child => child.statistics.totalCount !== 0);
                    }
                });
                _this.executionEnd(actualResults);
                // Now execute any post reporters
                if (livedocOptions.postReporters) {
                    livedocOptions.postReporters.forEach(async (reporter) => {
                        try {
                            const instance = new (reporter as any);
                            const result = instance.execute(actualResults, mochaOptions.reporterOptions || {});
                            if (result && result["then"]) {
                                await result;
                            }
                        } catch (e) {
                            console.log(e);
                        }
                    });
                }
            }
            catch (e) {
                console.error("Reporter error: ", e);
            }
        });

    }

    //#region Common Routines

    /**
     * Returns a string highlighting the differences between the actual
     * and expected strings.
     *
     * @protected
     * @param {*} actual
     * @param {*} expected
     * @returns {string}
     * @memberof LiveDocReporter
     */
    protected createUnifiedDiff(actual, expected): string {
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
        var msg = diff.createPatch('string', actual.toString(), expected.toString());
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

    /**
     * returns the context indented by the number of spaces specified by {number}
     *
     * @protected
     * @param {string} content
     * @param {number} indent
     * @returns {string}
     * @memberof LiveDocReporter
     */
    protected applyBlockIndent(content: string, indent: number): string {
        const reader: TextBlockReader = new TextBlockReader(content);

        const indentPadding = " ".repeat(indent);
        let lines: string[] = [];
        while (reader.next()) {
            lines.push(indentPadding + reader.line);
        }

        return lines.join("\n");
    }

    /**
     * Will highlight matches based on the supplied regEx wit the supplied color
     *
     * @protected
     * @param {*} content
     * @param {RegExp} regex
     * @param {Chalk} color
     * @returns {string}
     * @memberof LiveDocReporter
     */
    protected highlight(content, regex: RegExp, color: Chalk): string {
        return content.replace(regex, (item, pos, originalText) => {
            return color(item);
        });

    }

    /**
     * Will return the string substituting placeholders defined with <..> with 
     * the value from the example
     *
     * @protected
     * @param {*} content
     * @param {*} model
     * @param {Chalk} color
     * @returns {string}
     * @memberof LiveDocReporter
     */
    protected bind(content, model, color: Chalk): string {
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

    /**
     * Returns a formatted table of the dataTable data
     *
     * @protected
     * @param {DataTableRow[]} dataTable
     * @param {HeaderType} headerStyle
     * @param {boolean} [includeRowId=false]
     * @param {number} [runningTotal=0]
     * @returns {string}
     * @memberof LiveDocReporter
     */
    protected formatTable(dataTable: DataTableRow[], headerStyle: HeaderType, includeRowId: boolean = false, runningTotal: number = 0): string {
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
                        table[i][c] = rowColor(dataTable[i][c]);
                    }
                    break;
                case HeaderType.Top:
                    const offset = includeRowId ? 1 : 0;
                    if (i === 0) {
                        if (includeRowId) {
                            table[i][0] = " ";
                        }
                        for (let c = 0; c < dataTable[0].length; c++) {
                            table[i][c + offset] = this.colorTheme.dataTableHeader(dataTable[0][c]);
                        }
                    } else {
                        let rowColor = this.colorTheme.dataTable;
                        if (table[i][0].indexOf("Total") >= 0) {
                            rowColor = rowColor.bold;
                        }
                        if (includeRowId) {
                            table[i][0] = rowColor((i + runningTotal).toString());
                        }
                        for (let c = 0; c < dataTable[i].length; c++) {
                            table[i][c + offset] = rowColor(dataTable[i][c]);
                        }
                    }

                    break;
            }
        }
        return table.toString();
    }

    //#endregion
    /**
     * adds the text to the reporters output stream
     * 
     * @param {string} text 
     */
    protected writeLine(text: string): void {
        if (text) {
            if (!this.mochaOptions.useColors) {
                // colors are added by default, setting chalk.level can affect other reporters
                // so remove colors if no-color specified
                text = strip(text);
            }
            console.log(text);
        }
    }

    /**
     * adds the text to the reporters output stream
     * without a line return
     * 
     * @param {string} text 
     */
    protected write(text: string): void {
        if (text) {
            if (!this.mochaOptions.useColors) {
                // colors are added by default, setting chalk.level can affect other reporters
                // so remove colors if no-color specified
                text = strip(text);
            }
            // Output without a line return
            process.stdout.write(text);
        }
    }

    private getExecutionResults(test: any): ExecutionResults {
        if (test.parent.root) {
            return test.parent.livedocResults;
        } else {
            return this.getExecutionResults(test.parent);
        }
    }

    private getTestContainer(suite: any) {
        // Add a unique Id based on the title
        const livedocContext: LiveDocContext = suite.livedoc;

        // Add any additional 
        if (livedocContext) {
            switch (livedocContext.type) {
                case "Scenario":
                case "Scenario Outline":
                    return livedocContext.scenario;
                case "Background":
                    return livedocContext.feature.background;
                case "Feature":
                    return livedocContext.feature;
                case "context":
                case "describe":
                    return suite.livedoc;
            }
        }
    }

    //#region Reporting Interface

    protected setOptions(options: Object) {
        this.options = options;
    }

    protected executionStart(): void { }

    protected executionEnd(results: model.ExecutionResults): void { }

    protected featureStart(feature: model.Feature): void { }

    protected featureEnd(feature: model.Feature): void { }

    protected scenarioStart(scenario: model.Scenario): void { }

    protected scenarioEnd(scenario: model.Scenario): void { }

    protected scenarioOutlineStart(scenario: model.ScenarioOutline): void { }

    protected scenarioOutlineEnd(scenario: model.ScenarioOutline): void { }

    protected scenarioExampleStart(example: model.ScenarioExample): void { }

    protected scenarioExampleEnd(example: model.ScenarioExample): void { }

    protected backgroundStart(background: model.Background): void { }

    protected backgroundEnd(background: model.Background): void { }

    protected stepStart(step: model.StepDefinition): void { }

    protected stepEnd(step: model.StepDefinition): void { }

    protected stepExampleStart(step: model.StepDefinition): void { }

    protected stepExampleEnd(step: model.StepDefinition): void { }

    protected suiteStart(suite: model.MochaSuite): void { }

    protected suiteEnd(suite: model.MochaSuite): void { }

    protected testStart(test: model.LiveDocTest<model.MochaSuite>): void { }

    protected testEnd(test: model.LiveDocTest<model.MochaSuite>): void { }
    //#endregion
}

export enum HeaderType {
    none,
    Top,
    Left
}
