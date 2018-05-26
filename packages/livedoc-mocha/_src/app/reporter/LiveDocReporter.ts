import * as model from "../model"
// import { LiveDocContext } from "../LiveDocContext";
// import * as cliTable from "cli-table2";
// import { TextBlockReader } from "../parser/TextBlockReader";
// import chalk from "chalk";
import { SpecStatus } from "../model/SpecStatus";
import { LiveDocContext } from "../LiveDocContext";
import * as fvn from "fnv-plus";
import { ExecutionResults } from "../model";
import { LiveDocOptions } from "../LiveDocOptions";
import * as fs from "fs-extra";
import * as strip from "strip-ansi";
import { ColorTheme } from "./ColorTheme";

//import * as fs from "fs-extra";

/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base;

export class LiveDocReporter {
    private outputFile: string;
    protected options: Object;
    protected colorTheme: ColorTheme;

    constructor (runner, protected mochaOptions) {
        Base.call(this, runner);
        const _this = this;
        const livedocOptions: LiveDocOptions = mochaOptions.livedoc;

        this.colorTheme = livedocOptions.reporterOptions.colors;
        this.setOptions(mochaOptions.reporterOptions);

        // If the option to output a file has been defined delete the file first if it exists
        const outputFile = this.mochaOptions.reporterOptions && this.mochaOptions.reporterOptions.output;
        if (outputFile) {
            this.outputFile = outputFile;
            if (fs.existsSync(outputFile)) {
                fs.unlinkSync(outputFile);
            }
        }

        let executionResults: ExecutionResults;

        this.executionStart();

        runner.on('suite', function (suite) {
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
        });

        runner.on('suite end', function (suite) {
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
        });

        runner.on('test', function (test: any) {
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
        });

        runner.on('test end', function (test: any) {
            const step: model.LiveDocTest<any> = test.step;

            if (step.id) {
                step.code = test.fn ? test.fn.toString() : "";
                step.executionTime = test.duration || 0;
                step.setStatus(step.status);
            }

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
        });

        runner.on('pass', function (test: Mocha.ITest) {
            if (!(test as any).id)
                (test as any).step.status = SpecStatus.pass;
        });

        runner.on('fail', function (test: any) {
            const step: model.LiveDocTest<any> = test.step;
            if (!step) {
                // For some reason we dont' have a step 
                return;
            }
            if (!(test as any).id) {
                step.status = SpecStatus.fail;
                test = test as any;
                if (test.err) {
                    step.exception.actual = test.err.actual || "";
                    step.exception.expected = test.err.expected || "";
                    step.exception.stackTrace = test.err.stack || "";
                    step.exception.message = test.err.message || "";
                }
            }
        });

        runner.on('pending', function (test: Mocha.ITest) {
            if (!(test as any).id)
                (test as any).step.status = SpecStatus.pending;
        });

        runner.on('end', function (test) {
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
        });

    }

    /**
     * adds the text to the reporters output stream
     * 
     * @param {string} text 
     */
    protected writeLine(text: string) {
        if (text) {
            console.log(text);

            // determine if it should be output to a file as well
            if (this.outputFile) {
                // If colors have been applied they need to be stripped before writing to the file
                if (this.mochaOptions.useColors) {
                    text = strip(text);
                }
                fs.appendFileSync(this.outputFile, text + "\n");
            }
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

    protected suiteStart(suite: model.LiveDocSuite): void { }

    protected suiteEnd(suite: model.LiveDocSuite): void { }

    protected testStart(test: model.LiveDocTest<model.MochaSuite>): void { }

    protected testEnd(test: model.LiveDocTest<model.MochaSuite>): void { }
    //#endregion
}
