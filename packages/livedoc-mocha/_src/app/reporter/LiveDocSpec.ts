import * as fs from "fs-extra";
import * as strip from "strip-ansi";

import * as model from "../model";
import { Chalk } from "chalk";
import * as cliTable from "cli-table2";

import { LiveDocReporter, HeaderType } from "./LiveDocReporter";

enum StatusIdentifiers {
    pass = '√',
    fail = 'X',
    pending = '-',
    bang = '!',
    statusBarPass = "+",
    statusBarFail = "X",
    statusBarPending = "-",
};

export class LiveDocReporterOptions {
    auto: boolean = false;
    spec: boolean = false;
    summary: boolean = false;
    list: boolean = false;
    silent: boolean = false;
    output: string = "";

    public setDefaults(): void {
        this.spec = true;
        this.summary = true;
    }

    public enableSilent(): void {
        this.auto = this.spec = this.summary = this.list = false;
    }
};

export class LiveDocSpec extends LiveDocReporter {
    protected options: LiveDocReporterOptions;
    private suiteIndent: number = 0;

    protected setOptions(options: LiveDocReporterOptions) {
        this.options = new LiveDocReporterOptions();
        if (!(options as any).detailLevel) {
            // Default value
            this.options.setDefaults();
        } else {
            const userOptions = (options as any).detailLevel.split("+");
            this.options.output = options.output;
            userOptions.forEach(option => {
                this.options[option] = true;
            });
            // the special option of silent will redefine the values to all be false
            if (this.options.silent) {
                this.options.enableSilent();
            }
        }
    }

    executionStart(): void {
        // If the option to output a file has been defined delete the file first if it exists
        if (this.options.output) {
            if (fs.existsSync(this.options.output)) {
                fs.unlinkSync(this.options.output);
            }
        }
    }

    executionEnd(results: model.ExecutionResults): void {
        if (results.features.length > 0)
            this.outputFeatureExecutionSummary(results);

        if (results.suites.length > 0)
            this.outputSuiteExecutionSummary(results);

        this.outputExceptionReport(results);
    }

    featureStart(feature: model.Feature): void {
        if (this.options.spec)
            this.outputFeature(feature);
    }

    featureEnd(feature: model.Feature): void {
        if (this.options.spec) {
            this.writeLine(" ");
            if (feature.ruleViolations.length > 0) {
                this.writeLine(this.colorTheme.statusFail("    WARNING: Rule violations"));
                this.writeRuleViolations(feature.ruleViolations);
            }
        }
    }

    scenarioStart(scenario: model.Scenario): void {
        if (this.options.spec)
            this.outputScenario(scenario);
    }

    scenarioEnd(scenario: model.Scenario): void {
        if (this.options.spec) {
            this.writeLine(" ");

            // Output any warnings
            if (scenario.ruleViolations.length > 0 || scenario.steps.filter(step => step.ruleViolations.length > 0).length > 0) {
                this.writeLine(this.colorTheme.statusFail("    WARNING: Rule violations"));
                this.writeRuleViolations(scenario.ruleViolations);
                scenario.steps.forEach(step => {
                    this.writeRuleViolations(step.ruleViolations);
                })
            }
        }
    }

    scenarioOutlineStart(scenario: model.ScenarioOutline): void {
        if (this.options.spec)
            this.outputScenarioOutline(scenario);
    }

    scenarioOutlineEnd(scenario: model.ScenarioOutline): void {
    }

    scenarioExampleStart(example: model.ScenarioExample): void {
        if (this.options.spec) {
            this.writeLine(this.formatKeywordTitle("Example", example.sequence.toString(), this.colorTheme.keyword, this.colorTheme.scenarioTitle, 4));
        }
    }

    scenarioExampleEnd(example: model.ScenarioExample): void {
        if (this.options.spec)
            this.writeLine(" ");
    }

    stepExampleStart(step: model.StepDefinition): void {
    }

    stepExampleEnd(step: model.StepDefinition): void {
        if (this.options.spec)
            this.outputStep(step, false);
    }

    backgroundStart(background: model.Background): void {
        if (this.options.spec) {
            this.writeLine(this.formatKeywordTitle("Background", background.title, this.colorTheme.keyword, this.colorTheme.backgroundTitle, 4));
        }
    }

    backgroundEnd(background: model.Background): void { }

    stepStart(step: model.StepDefinition): void {
    }

    stepEnd(step: model.StepDefinition): void {
        if (this.options.spec)
            this.outputStep(step, false);
    }

    suiteStart(suite: model.MochaSuite): void {
        if (suite.title == "root") {
            // Only output if there's something recorded against the root
            if (suite.children.length === 0 || suite.tests.length === 0) {
                return;
            }
        }
        if (this.options.spec) {
            this.suiteIndent += 2;
            this.writeLine(" ");
            this.writeLine(this.applyBlockIndent(this.colorTheme.featureTitle(suite.title), this.suiteIndent));
        }
    }

    suiteEnd(suite: model.MochaSuite): void {
        if (this.options.spec) {
            this.suiteIndent -= 2;
        }
    }

    testStart(test: model.LiveDocTest<model.MochaSuite>): void {
    }

    testEnd(test: model.LiveDocTest<model.MochaSuite>): void {
        if (this.options.spec) {
            this.outputTest(test);
        }
    }

    protected writeRuleViolations(violations: model.LiveDocRuleViolation[]) {
        violations.forEach(violation => {
            this.writeLine(this.colorTheme.statusFail(`${" ".repeat(5)} * ${violation.message}`));
        });
    }

    protected writeLine(text: string) {
        super.writeLine(text);

        // determine if it should be output to a file as well
        if (this.options.output) {
            // If colors have been applied they need to be stripped before writing to the file
            if (this.mochaOptions.useColors) {
                text = strip(text);
            }
            fs.appendFileSync(this.options.output, text + "\n");
        }
    }

    private outputFeature(feature: model.Feature) {
        let indent = 2;
        this.writeLine(this.formatKeywordTitle("Feature", feature.title, this.colorTheme.keyword, this.colorTheme.featureTitle, indent));
        indent += 2;
        if (feature.tags.length > 0) this.writeLine(this.applyBlockIndent(this.formatTags(feature.tags), indent));
        if (feature.description.length > 0) this.writeLine(this.formatDescription(feature.description, indent, this.colorTheme.featureDescription));
    }

    private outputScenarioOutline(scenario: model.ScenarioOutline) {
        let indent = 4;

        this.writeLine(this.formatKeywordTitle("Scenario Outline", scenario.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
        indent += 2;
        if (scenario.tags.length > 0) this.writeLine(this.applyBlockIndent(this.formatTags(scenario.tags), indent));
        if (scenario.description.length > 0) this.writeLine(this.formatDescription(scenario.description, indent, this.colorTheme.scenarioDescription));

        // display the steps
        scenario.steps.forEach(step => {
            this.outputStep(step, true);
        });

        this.writeLine(" "); // line break
        indent += 2;
        let runningTotal = 0;
        for (let i = 0; i < scenario.tables.length; i++) {
            // Output the Examples table
            this.writeLine(this.applyBlockIndent(this.colorTheme.keyword("Examples: " + scenario.tables[i].name), indent));
            this.writeLine(this.applyBlockIndent(this.formatTable(scenario.tables[i].dataTable, HeaderType.Top, true, runningTotal), indent));
            runningTotal += scenario.tables[i].dataTable.length - 1; // due to header row
        }
    }

    private outputScenario(scenario: model.Scenario) {
        let indent = 4;
        this.writeLine(this.formatKeywordTitle("Scenario", scenario.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
        indent += 2;
        if (scenario.tags.length > 0) this.writeLine(this.applyBlockIndent(this.formatTags(scenario.tags), indent));
        if (scenario.description.length > 0) this.writeLine(this.formatDescription(scenario.description, indent, this.colorTheme.scenarioDescription));
    }

    private outputFeatureExecutionSummary(results: model.ExecutionResults) {
        const headerRow = [
            "Feature",
            "Scenarios",
            "status",
            "Pass",
            "Fail",
            "Pending",
            "Warnings",
            "Elapsed"
        ];

        if (!this.options.summary && !this.options.list) {
            return;
        }
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
                feature.statistics.totalRuleViolations,
                feature.statistics.duration
            ]);

            if (!this.options.list) {
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
                    scenario.statistics.totalRuleViolations,
                    scenario.statistics.duration
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
            elapsedTime: results.features.reduce((pv, cv) => pv + cv.statistics.duration, 0),
        };

        statistics.push([
            "Totals (" + results.features.length + ")",
            totalStats.scenarios,
            this.statusBar(totalStats.pass / totalStats.total, totalStats.failed / totalStats.total, totalStats.pending / totalStats.total),
            totalStats.pass,
            totalStats.failed,
            totalStats.pending,
            totalStats.warnings,
            totalStats.elapsedTime
        ])

        this.writeLine(this.applyBlockIndent(this.formatTable(statistics, HeaderType.Top), 2));
    }

    private formatLine(text: string): string {
        const maxLen = 60;
        if (text.length > maxLen) {
            return text.substr(0, maxLen) + "...";
        } else {
            return text;
        }
    }

    private outputSuiteExecutionSummary(results: model.ExecutionResults) {
        const headerRow = [
            "Suite",
            "Children",
            "status",
            "Pass",
            "Fail",
            "Pending",
            "Elapsed"
        ];

        const statistics: DataTableRow[] = [];
        statistics.push(headerRow);

        results.suites.forEach(suite => {
            // Add the stats for the feature
            const stats = suite.statistics;
            const statusBar = this.statusBar(stats.passPercent, stats.failedPercent, stats.pendingPercent);

            statistics.push([
                suite.title,
                suite.children.length,
                statusBar,
                suite.statistics.passCount,
                suite.statistics.failedCount,
                suite.statistics.pendingCount,
                suite.statistics.duration
            ]);

            if (!this.options.list) {
                return;
            }
            // Output the specific scenarios for the feature
            suite.children.forEach(child => {
                const stats = child.statistics;
                const statusBar = this.statusBar(stats.passPercent, stats.failedPercent, stats.pendingPercent);
                statistics.push([
                    this.formatLine("  " + child.title),
                    " ",
                    statusBar,
                    child.statistics.passCount,
                    child.statistics.failedCount,
                    child.statistics.pendingCount,
                    child.statistics.duration
                ]);
            });

        });


        // Now add a totals row
        const totalStats = {
            total: results.suites.reduce((pv, cv) => pv + cv.statistics.totalCount, 0),
            children: results.suites.reduce((pv, cv) => pv + cv.children.length, 0),
            pass: results.suites.reduce((pv, cv) => pv + cv.statistics.passCount, 0),
            failed: results.suites.reduce((pv, cv) => pv + cv.statistics.failedCount, 0),
            pending: results.suites.reduce((pv, cv) => pv + cv.statistics.pendingCount, 0),
            warnings: results.suites.reduce((pv, cv) => pv + cv.statistics.totalRuleViolations, 0),
            elapsedTime: results.suites.reduce((pv, cv) => pv + cv.statistics.duration, 0),
        };

        statistics.push([
            "Totals (" + results.suites.length + ")",
            totalStats.children,
            this.statusBar(totalStats.pass / totalStats.total, totalStats.failed / totalStats.total, totalStats.pending / totalStats.total),
            totalStats.pass,
            totalStats.failed,
            totalStats.pending,
            totalStats.elapsedTime
        ])

        this.writeLine(this.applyBlockIndent(this.formatTable(statistics, HeaderType.Top), 2));
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

        // Now make sure the bar isn't too short
        const gap = barSize - (passBar.length + failBar.length + pendingBar.length);
        if (gap > 0) {
            const longest = Math.max(passBar.length, failBar.length, pendingBar.length);
            if (passBar.length === longest) {
                passBar += passBar.substr(0, 1);
            } else if (failBar.length === longest) {
                failBar += failBar.substr(0, 1);
            } else {
                pendingBar += pendingBar.substr(0, 1);
            }
        }

        const bar = this.colorTheme.statusPass.inverse(passBar) +
            this.colorTheme.statusFail.inverse(failBar) +
            this.colorTheme.statusPending.inverse(pendingBar);

        return bar;
    }

    private outputExceptionReport(results: model.ExecutionResults) {
        results.features.forEach(feature => {
            this.outputFeatureError(feature);
        });

        this.suiteIndent = 0;
        results.suites.forEach(suite => {
            this.suiteIndent += 2;
            this.outputSuiteError(suite);
            this.suiteIndent -= 2;
        });
    }

    private outputFeatureError(feature: model.Feature) {
        // Validate that the feature has errors
        if (feature.statistics.failedCount > 0) {
            let indent = 2;
            this.writeLine(this.formatKeywordTitle("Feature", feature.title, this.colorTheme.keyword, this.colorTheme.featureTitle, indent));
            indent += 2;

            // This will repeat the feature/scenario detail but at a minimized level, enough to provide
            // context.

            // Output any errors occurring in the Backgrounds
            if (feature.background.statistics.failedCount > 0) {
                const background = feature.background;
                this.writeLine(this.formatKeywordTitle("Background", background.title, this.colorTheme.keyword, this.colorTheme.backgroundTitle, indent));
                // display the steps
                debugger;
                background.steps.forEach(step => {
                    this.outputStep(step, false);
                    if (step.status === model.SpecStatus.fail) {
                        this.outputStepError(step);
                    }
                });
            }

            feature.scenarios.forEach(scenario => {
                if (scenario.statistics.failedCount > 0) {
                    if (scenario.constructor.name === "ScenarioOutline") {
                        const scenarioOutline = scenario as model.ScenarioOutline;
                        this.writeLine(this.formatKeywordTitle("Scenario Outline", scenarioOutline.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
                        // display the steps
                        scenarioOutline.steps.forEach(step => {
                            this.outputStep(step, true);
                        });

                        // TODO: Consider highlighting Example row in Examples output for those that failed
                        // this.writeLine(" "); // line break
                        // indent += 2;
                        // for (let i = 0; i < scenarioOutline.tables.length; i++) {
                        //     // Output the Examples table
                        //     this.writeLine(this.applyBlockIndent(this.colorTheme.keyword("Examples: " + scenarioOutline.tables[i].name), indent));
                        //     this.writeLine(this.applyBlockIndent(this.formatTable(scenarioOutline.tables[i].dataTable, HeaderType.Top), indent));
                        // }

                        this.writeLine(" "); // line break
                        indent += 2;

                        // Now output any example that has errors
                        scenarioOutline.examples.forEach(example => {
                            if (example.statistics.failedCount > 0) {
                                this.writeLine(this.formatKeywordTitle("Example", example.sequence.toString(), this.colorTheme.statusFail, this.colorTheme.scenarioTitle, 4));
                                example.steps.forEach(step => {
                                    this.outputStep(step, false);
                                    if (step.status === model.SpecStatus.fail) {
                                        this.outputStepError(step);
                                    }
                                });
                            }
                        });
                    } else {
                        this.writeLine(this.formatKeywordTitle("Scenario", scenario.title, this.colorTheme.keyword, this.colorTheme.scenarioTitle, indent));
                        scenario.steps.forEach(step => {
                            this.outputStep(step, false);
                            if (step.status === model.SpecStatus.fail) {
                                this.outputStepError(step);
                            }
                        });
                    }
                }
            });
        }
    }

    private outputSuiteError(suite: model.MochaSuite) {
        // Validate that the Suite has errors
        if (suite.statistics.failedCount > 0) {
            let indent = 2;
            this.writeLine(this.applyBlockIndent(this.colorTheme.featureTitle(suite.title), this.suiteIndent + indent));
            this.suiteIndent += 2;

            suite.tests.forEach(test => {
                this.outputTest(test);
                if (test.status === model.SpecStatus.fail) {
                    this.outputStepError(test);
                }
            });
            this.suiteIndent -= 2;

            // Mocha Suites can have any level of depth
            suite.children.forEach(child => {
                this.suiteIndent += 2;
                this.outputSuiteError(child);
                this.suiteIndent -= 2;
            });
        }
    }

    private static errorCount: number = 0;
    private outputStepError(step: model.LiveDocTest<any>) {
        const color = this.colorTheme.dataTable;
        LiveDocSpec.errorCount++;

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
        table.push([{ colSpan: 2, content: color('Error: ' + LiveDocSpec.errorCount) }]);
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

        this.writeLine(table.toString());
    }

    private outputStep(step: model.StepDefinition, useDefinition: boolean) {
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
                title = this.highlight(step.rawTitle, new RegExp("<[^>]+>", "g"), this.colorTheme.valuePlaceholders);
            } else {
                // Apply any binding if necessary
                title = this.bind(step.rawTitle, (step.parent as model.ScenarioExample).example, this.colorTheme.valuePlaceholders);
            }
        }

        // Now highlight any values within the title
        title = this.highlight(title, /('[^']+')|("[^"]+")/g, this.colorTheme.valuePlaceholders)

        this.writeLine(`${" ".repeat(indent)}${indicator} ${" ".repeat(hangingIndent)}${this.colorTheme.stepKeyword(step.type)} ${titleColor(title)}`);
        indent += 4;
        if (step.description) this.writeLine(this.applyBlockIndent(step.description, indent + hangingIndent));
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

            this.writeLine(this.applyBlockIndent(this.colorTheme.docString(`"""\n${docString}\n"""`), indent + hangingIndent));
        }
        if (step.dataTable) this.writeLine(this.applyBlockIndent(this.formatTable(step.dataTable, HeaderType.none), indent + hangingIndent));
    }

    private outputTest(step: model.LiveDocTest<model.MochaSuite>) {
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

        this.writeLine(`${" ".repeat(this.suiteIndent + indent)}${indicator} ${titleColor(step.title)}`);
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

    //#region Diff

    // private createDiff(actual: string, expected: string): string {
    //     var diffResult = diff.diffWordsWithSpace(actual, expected);
    //     let result: string = "";

    //     diffResult.forEach((part) => {
    //         // green for additions, red for deletions
    //         // grey for common parts
    //         var color = part.added ? this.colorTheme.statusPass :
    //             part.removed ? this.colorTheme.statusFail : this.colorTheme.statusPending;
    //         result += color(part.value);
    //     });

    //     return result;
    // }


    //#endregion
}

