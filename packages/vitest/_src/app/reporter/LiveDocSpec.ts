import { appendFileSync, existsSync, unlinkSync } from "fs";
import stripAnsi from "strip-ansi";
import * as model from "../model/index";
import CliTable3 from "cli-table3";
import { LiveDocReporter, HeaderType } from "./LiveDocReporter";
import wordwrap from "wordwrap";
import type { DataTableRow } from "../types";

const wrap = wordwrap(140);

enum StatusIdentifiers {
    pass = '√',
    fail = 'X',
    pending = '-',
    bang = '!',
    statusBarPass = "+",
    statusBarFail = "X",
    statusBarPending = "-",
}

export class LiveDocReporterOptions {
    auto: boolean = false;
    spec: boolean = false;
    summary: boolean = false;
    list: boolean = false;
    headers: boolean = false;
    silent: boolean = false;
    output: string = "";

    /**
     * Used to remove text from the header during summary output in Spec Reporter
     * This option is mostly used when testing across a mono-repo and want to remove
     * mono-repo specifics
     */
    public removeHeaderText: string = "";

    public setDefaults(): void {
        this.spec = true;
        this.summary = true;
        this.headers = true;
    }

    public enableSilent(): void {
        this.auto = this.spec = this.summary = this.list = false;
    }
}

export class LiveDocSpec extends LiveDocReporter {
    protected options: LiveDocReporterOptions = new LiveDocReporterOptions();
    private suiteIndent: number = 0;
    private static errorCount: number = 0;

    protected setOptions(options: LiveDocReporterOptions) {
        const raw = options as any;

        this.options = new LiveDocReporterOptions();

        const hasDetailLevel = typeof raw.detailLevel === 'string' && raw.detailLevel.trim().length > 0;
        const hasProcessedFlags = ['auto', 'spec', 'summary', 'list', 'headers', 'silent']
            .some((k) => typeof raw[k] === 'boolean');

        if (hasDetailLevel) {
            const userOptions = raw.detailLevel.split("+");
            userOptions.forEach((option: string) => {
                (this.options as any)[option] = true;
            });
        } else if (hasProcessedFlags) {
            // LiveDocSpecReporter passes a pre-parsed LiveDocReporterOptions (booleans only).
            // Respect those flags instead of falling back to the default spec output.
            this.options.auto = !!raw.auto;
            this.options.spec = !!raw.spec;
            this.options.summary = !!raw.summary;
            this.options.list = !!raw.list;
            this.options.headers = !!raw.headers;
            this.options.silent = !!raw.silent;
        } else {
            // Default value
            this.options.setDefaults();
        }

        // the special option of silent will redefine the values to all be false
        if (this.options.silent) {
            this.options.enableSilent();
        }

        // Always set output and removeHeaderText after processing detailLevel / flags
        this.options.output = raw.output || "";
        this.options.removeHeaderText = raw.removeHeaderText || "";
    }

    executionStart(): void {
        // If the option to output a file has been defined delete the file first if it exists
        if (this.options.output) {
            if (existsSync(this.options.output)) {
                unlinkSync(this.options.output);
            }
        }
    }

    async executionEnd(results: model.ExecutionResults, options?: any): Promise<void> {
        // Output detailed spec if requested
        if (this.options.spec && results.features.length > 0) {
            results.features.forEach(feature => {
                // Output feature
                this.outputFeature(feature);
                this.writeLine(" ");
                
                // Output background if exists
                if (feature.background) {
                    this.writeLine(this.formatKeywordTitle("Background", feature.background.title, this.colorTheme.keyword, this.colorTheme.backgroundTitle, 4));
                    feature.background.steps.forEach(step => {
                        this.outputStep(step, false);
                    });
                    this.writeLine(" ");
                }
                
                // Output scenarios
                feature.scenarios.forEach(scenario => {
                    if (scenario.constructor.name === "ScenarioOutline") {
                        const scenarioOutline = scenario as model.ScenarioOutline;
                        this.outputScenarioOutline(scenarioOutline);
                        
                        // Output each example execution
                        scenarioOutline.examples.forEach(example => {
                            this.writeLine(this.formatKeywordTitle("Example", example.sequence.toString(), this.colorTheme.keyword, this.colorTheme.scenarioTitle, 4));
                            example.steps.forEach(step => {
                                this.outputStep(step, false);
                            });
                            this.writeLine(" ");
                        });
                    } else {
                        // Output scenario
                        this.outputScenario(scenario);
                        scenario.steps.forEach(step => {
                            this.outputStep(step, false);
                        });
                        this.writeLine(" ");
                        
                        // Output any warnings
                        if (scenario.ruleViolations.length > 0 || scenario.steps.filter(step => step.ruleViolations.length > 0).length > 0) {
                            this.writeLine(this.colorTheme.statusFail("    WARNING: Rule violations"));
                            this.writeRuleViolations(scenario.ruleViolations);
                            scenario.steps.forEach(step => {
                                this.writeRuleViolations(step.ruleViolations);
                            });
                        }
                    }
                });
                
                // Output feature end warnings
                if (feature.ruleViolations.length > 0) {
                    this.writeLine(this.colorTheme.statusFail("    WARNING: Rule violations"));
                    this.writeRuleViolations(feature.ruleViolations);
                }
            });
        }

        // Output detailed specification output if requested
        if (this.options.spec && results.specifications.length > 0) {
            results.specifications.forEach(spec => {
                this.outputSpecificationDetails(spec);
            });
        }
        
        // Output detailed suite output if requested
        if (this.options.spec && results.suites.length > 0) {
            results.suites.forEach(suite => {
                this.outputSuiteDetails(suite);
            });
        }
        
        // Output summary tables
        if (results.features.length > 0)
            this.outputFeatureExecutionSummary(results);

        if (results.specifications.length > 0)
            this.outputSpecificationExecutionSummary(results);

        if (results.suites.length > 0)
            this.outputSuiteExecutionSummary(results);

        this.outputExceptionReport(results);

        // Execute post-reporters if configured
        if (options?.postReporters && Array.isArray(options.postReporters)) {
            for (const reporter of options.postReporters) {
                await reporter.execute(results, options);
            }
        }
    }
    
    private outputSuiteDetails(suite: model.VitestSuite): void {
        this.suiteStart(suite);
        suite.tests.forEach(test => {
            this.testStart(test);
            this.testEnd(test);
        });
        suite.children.forEach(child => {
            this.outputSuiteDetails(child);
        });
        this.suiteEnd(suite);
    }

    private outputSpecificationDetails(spec: model.Specification): void {
        // Output specification header
        this.writeLine(this.formatKeywordTitle("Specification", spec.title, this.colorTheme.keyword, this.colorTheme.featureTitle, 2));
        if (spec.description) {
            this.writeLine(this.formatDescription(spec.description, 4, this.colorTheme.featureDescription));
        }
        this.writeLine(" ");

        // Output each rule
        for (const rule of spec.rules) {
            if (rule instanceof model.RuleOutline) {
                // Output Rule Outline with status indicator (like regular rules)
                const status = this.getStatusIndicator(rule.status);
                this.writeLine(`    ${status} ${this.colorTheme.keyword("Rule Outline:")} ${this.colorTheme.scenarioTitle(rule.title)}`);
                if (rule.description) {
                    this.writeLine(this.formatDescription(rule.description, 6, this.colorTheme.scenarioDescription));
                }
                
                // Output each example
                for (const example of rule.examples) {
                    const exampleStatus = this.getStatusIndicator(example.status);
                    const exampleTitle = `Example ${example.sequence}`;
                    this.writeLine(`      ${exampleStatus} ${this.colorTheme.stepTitle(exampleTitle)}`);
                }
                this.writeLine(" ");
            } else {
                // Output simple Rule
                const status = this.getStatusIndicator(rule.status);
                this.writeLine(`    ${status} ${this.colorTheme.keyword("Rule:")} ${this.colorTheme.stepTitle(rule.title)}`);
            }
        }
        this.writeLine(" ");
    }

    private getStatusIndicator(status: model.SpecStatus): string {
        switch (status) {
            case model.SpecStatus.pass:
                return this.colorTheme.statusPass("✓");
            case model.SpecStatus.fail:
                return this.colorTheme.statusFail("✗");
            case model.SpecStatus.pending:
                return this.colorTheme.statusPending("○");
            default:
                return this.colorTheme.statusPending("?");
        }
    }

    featureStart(feature: model.Feature): void {
        if (this.options.spec) {
            this.outputFeature(feature);
            this.writeLine(" ");
        }
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
                });
            }
        }
    }

    scenarioOutlineStart(scenario: model.ScenarioOutline): void {
        if (this.options.spec)
            this.outputScenarioOutline(scenario);
    }

    scenarioOutlineEnd(_scenario: model.ScenarioOutline): void {
    }

    scenarioExampleStart(example: model.ScenarioExample): void {
        if (this.options.spec) {
            this.writeLine(this.formatKeywordTitle("Example", example.sequence.toString(), this.colorTheme.keyword, this.colorTheme.scenarioTitle, 4));
        }
    }

    scenarioExampleEnd(_example: model.ScenarioExample): void {
        if (this.options.spec)
            this.writeLine(" ");
    }

    stepExampleStart(_step: model.StepDefinition): void {
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

    backgroundEnd(_background: model.Background): void {
        if (this.options.spec) {
            this.writeLine(" ");
        }
    }

    stepStart(_step: model.StepDefinition): void {
    }

    stepEnd(step: model.StepDefinition): void {
        if (this.options.spec)
            this.outputStep(step, false);
    }

    suiteStart(suite: model.VitestSuite): void {
        if (suite.title === "root") {
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

    suiteEnd(_suite: model.VitestSuite): void {
        if (this.options.spec) {
            this.suiteIndent -= 2;
        }
    }

    testStart(_test: model.LiveDocTest<model.VitestSuite>): void {
    }

    testEnd(test: model.LiveDocTest<model.VitestSuite>): void {
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
            if (this.useColors) {
                text = stripAnsi(text);
            }
            appendFileSync(this.options.output, text + "\n");
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
            this.writeLine(this.applyBlockIndent(this.formatTable(scenario.tables[i].dataTable as any[][], HeaderType.Top, true, runningTotal), indent));
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

        let currentPath = "";
        results.features.forEach(feature => {
            const headerPath = feature.path.replace(this.options.removeHeaderText, '');
            if (this.options.headers && currentPath !== headerPath) {
                currentPath = feature.path.replace(this.options.removeHeaderText, "");
                statistics.push([currentPath ? currentPath.toUpperCase().replace(/[_-]/g, " ") : "ROOT"]);
            }
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
        ]);

        this.writeLine(this.applyBlockIndent(this.formatTable(statistics as any[][], HeaderType.Top), 2));
    }

    private formatLine(text: string): string {
        const maxLen = 60;
        if (text.length > maxLen) {
            return text.substr(0, maxLen) + "...";
        } else {
            return text;
        }
    }

    private outputSpecificationExecutionSummary(results: model.ExecutionResults) {
        const headerRow = [
            "Specification",
            "Rules",
            "status",
            "Pass",
            "Fail",
            "Pending",
            "Elapsed"
        ];

        if (!this.options.summary && !this.options.list) {
            return;
        }
        const statistics: DataTableRow[] = [];
        statistics.push(headerRow);

        results.specifications.forEach(spec => {
            // Calculate statistics for the specification
            const rules = spec.rules;
            let passCount = 0;
            let failCount = 0;
            let pendingCount = 0;
            let totalDuration = spec.executionTime || 0;

            rules.forEach(rule => {
                if (rule instanceof model.RuleOutline) {
                    // Count examples
                    rule.examples.forEach(example => {
                        if (example.status === model.SpecStatus.pass) passCount++;
                        else if (example.status === model.SpecStatus.fail) failCount++;
                        else pendingCount++;
                        totalDuration += example.executionTime || 0;
                    });
                } else {
                    if (rule.status === model.SpecStatus.pass) passCount++;
                    else if (rule.status === model.SpecStatus.fail) failCount++;
                    else pendingCount++;
                    totalDuration += rule.executionTime || 0;
                }
            });

            const totalRules = passCount + failCount + pendingCount;
            const passPercent = totalRules > 0 ? passCount / totalRules : 0;
            const failPercent = totalRules > 0 ? failCount / totalRules : 0;
            const pendingPercent = totalRules > 0 ? pendingCount / totalRules : 0;
            const statusBar = this.statusBar(passPercent, failPercent, pendingPercent);

            statistics.push([
                this.formatLine(spec.title),
                rules.length,
                statusBar,
                passCount,
                failCount,
                pendingCount,
                totalDuration
            ]);

            if (!this.options.list) {
                return;
            }
            // Output the specific rules for the specification
            rules.forEach(rule => {
                let rulePass = 0, ruleFail = 0, rulePending = 0, ruleDuration = 0;
                
                if (rule instanceof model.RuleOutline) {
                    rule.examples.forEach(ex => {
                        if (ex.status === model.SpecStatus.pass) rulePass++;
                        else if (ex.status === model.SpecStatus.fail) ruleFail++;
                        else rulePending++;
                        ruleDuration += ex.executionTime || 0;
                    });
                } else {
                    if (rule.status === model.SpecStatus.pass) rulePass = 1;
                    else if (rule.status === model.SpecStatus.fail) ruleFail = 1;
                    else rulePending = 1;
                    ruleDuration = rule.executionTime || 0;
                }

                const ruleTotal = rulePass + ruleFail + rulePending;
                const ruleStatusBar = this.statusBar(
                    ruleTotal > 0 ? rulePass / ruleTotal : 0,
                    ruleTotal > 0 ? ruleFail / ruleTotal : 0,
                    ruleTotal > 0 ? rulePending / ruleTotal : 0
                );

                statistics.push([
                    this.formatLine("  " + rule.title),
                    " ",
                    ruleStatusBar,
                    rulePass,
                    ruleFail,
                    rulePending,
                    ruleDuration
                ]);
            });
        });

        // Now add a totals row
        let totalPass = 0, totalFail = 0, totalPending = 0, totalDuration = 0, totalRulesCount = 0;
        results.specifications.forEach(spec => {
            spec.rules.forEach(rule => {
                if (rule instanceof model.RuleOutline) {
                    rule.examples.forEach(ex => {
                        if (ex.status === model.SpecStatus.pass) totalPass++;
                        else if (ex.status === model.SpecStatus.fail) totalFail++;
                        else totalPending++;
                        totalDuration += ex.executionTime || 0;
                    });
                    totalRulesCount++;
                } else {
                    if (rule.status === model.SpecStatus.pass) totalPass++;
                    else if (rule.status === model.SpecStatus.fail) totalFail++;
                    else totalPending++;
                    totalDuration += rule.executionTime || 0;
                    totalRulesCount++;
                }
            });
        });

        const grandTotal = totalPass + totalFail + totalPending;
        statistics.push([
            "Totals (" + results.specifications.length + ")",
            totalRulesCount,
            this.statusBar(
                grandTotal > 0 ? totalPass / grandTotal : 0,
                grandTotal > 0 ? totalFail / grandTotal : 0,
                grandTotal > 0 ? totalPending / grandTotal : 0
            ),
            totalPass,
            totalFail,
            totalPending,
            totalDuration
        ]);

        this.writeLine(this.applyBlockIndent(this.formatTable(statistics as any[][], HeaderType.Top), 2));
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
            // Add the stats for the suite
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
            // Output the specific children for the suite
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
        ]);

        this.writeLine(this.applyBlockIndent(this.formatTable(statistics as any[][], HeaderType.Top), 2));
    }

    private statusBar(passPercent: number, failedPercent: number, pendingPercent: number): string {
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

        const bar = (this.colorTheme.statusPass as any).inverse(passBar) +
            (this.colorTheme.statusFail as any).inverse(failBar) +
            (this.colorTheme.statusPending as any).inverse(pendingBar);

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

            // Output any errors occurring in the Backgrounds
            if (feature.background && feature.background.statistics.failedCount > 0) {
                const background = feature.background;
                this.writeLine(this.formatKeywordTitle("Background", background.title, this.colorTheme.keyword, this.colorTheme.backgroundTitle, indent));
                // display the steps
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

    private outputSuiteError(suite: model.VitestSuite) {
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

            // Vitest Suites can have any level of depth
            suite.children.forEach(child => {
                this.suiteIndent += 2;
                this.outputSuiteError(child);
                this.suiteIndent -= 2;
            });
        }
    }

    private outputStepError(step: model.LiveDocTest<any>) {
        const color = this.colorTheme.dataTable;
        LiveDocSpec.errorCount++;

        const table: any = new CliTable3({
            chars: {
                'top': color('─'),
                'top-mid': color('┬'),
                'top-left': color('┌'),
                'top-right': color('┐'),
                'bottom': color('─'),
                'bottom-mid': color('┴'),
                'bottom-left': color('└'),
                'bottom-right': color('┘'),
                'left': color('│'),
                'left-mid': color('├'),
                'mid': color('─'),
                'mid-mid': color('┼'),
                'right': color('│'),
                'right-mid': color('┤'),
                'middle': color('│')
            }
        });
        
        table.push([{ colSpan: 2, content: color('Error: ' + LiveDocSpec.errorCount) }]);
        table.push(["Message", wrap(step.exception.message)]);
        if (step.exception.expected) {
            table.push(["Diff", wrap(this.createUnifiedDiff(step.exception.actual, step.exception.expected))]);
        }
        table.push(["Code", wrap(step.code.replace(/\r/g, ""))]);
        table.push(["Stack trace", wrap(step.exception.stackTrace)]);
        if (step.constructor.name === "StepDefinition") {
            table.push(["Filename", wrap(step.parent.parent.filename)]);
        } else {
            table.push(["Filename", wrap(step.parent.filename)]);
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
        
        let title: string = step.rawTitle;
        // Check if this is a scenario outline step (template or executed)
        const isScenarioOutlineStep = step.parent instanceof model.ScenarioOutline || (step.parent as model.ScenarioExample).example;
        
        if (isScenarioOutlineStep) {
            if (useDefinition) {
                // Apply any binding if necessary
                title = this.highlight(step.rawTitle, new RegExp("<[^>]+>", "g"), this.colorTheme.valuePlaceholders);
            } else {
                // Apply any binding if necessary
                title = this.bind(step.rawTitle, (step.parent as model.ScenarioExample).example, this.colorTheme.valuePlaceholders);
            }
        }

        // Special formatting for passedParams
        if (step.passedParam) {
            if (useDefinition) {
                // Apply any binding if necessary
                title = this.highlight(title, new RegExp("{[^}]+}", "g"), this.colorTheme.valuePlaceholders);
            } else {
                // Apply any binding if necessary
                title = this.secondaryBind(title, step.passedParam, this.colorTheme.valuePlaceholders);
            }
        }

        // Now highlight any values within the title
        title = this.highlight(title, /('[^']+')|("[^"]+")/g, this.colorTheme.valuePlaceholders);

        this.writeLine(`${" ".repeat(indent)}${indicator} ${" ".repeat(hangingIndent)}${this.colorTheme.stepKeyword(step.type)} ${titleColor(title)}`);
        indent += 4;
        if (step.description && step.description.trim()) {
            this.writeLine(this.applyBlockIndent(step.description, indent + hangingIndent));
        }
        if (step.docString) {
            let docString = step.docStringRaw;
            if (step.docString !== docString) {
                if (useDefinition) {
                    // output the docString before binding
                    docString = this.highlight(step.docStringRaw, new RegExp("<[^>]+>", "g"), this.colorTheme.valuePlaceholders);
                    docString = this.highlight(docString, new RegExp("{[^}]+}", "g"), this.colorTheme.valuePlaceholders);
                } else {
                    // bind using example and passedParams if available
                    docString = this.bind(step.docStringRaw, (step.parent as model.ScenarioExample).example, this.colorTheme.valuePlaceholders);
                    docString = this.secondaryBind(docString, step.passedParam, this.colorTheme.valuePlaceholders);
                }
            } else {
                // non scenario outline based doc string
                docString = step.docString;
            }

            this.writeLine(this.applyBlockIndent(this.colorTheme.docString(`"""\n${docString}\n"""`), indent + hangingIndent));
        }
        if (step.dataTable && step.dataTable.length > 0) {
            this.writeLine(this.applyBlockIndent(this.formatTable(step.dataTable as any[][], HeaderType.none), indent + hangingIndent));
        }
    }

    private outputTest(step: model.LiveDocTest<model.VitestSuite>) {
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

    private formatKeywordTitle(keyword: string, title: string, keywordColor: any, titleColor: any, indent: number): string {
        return `${" ".repeat(indent)}${keywordColor(keyword + ": ")}${titleColor(title)}`;
    }

    private formatDescription(description: string, indent: number, theme: any) {
        const formattedBlock = this.applyBlockIndent(description, indent);
        return theme(formattedBlock);
    }

    private formatTags(tags: string[]): string {
        const output = tags.map((tag) => {
            return this.colorTheme.tags("@" + tag);
        });

        return output.join(" ");
    }
}
