import * as model from "../model"
// import { LiveDocContext } from "../LiveDocContext";
// import * as cliTable from "cli-table2";
// import { TextBlockReader } from "../parser/TextBlockReader";
// import chalk from "chalk";
import { SpecStatus } from "../model/SpecStatus";
import { LiveDocContext } from "../LiveDocContext";
import * as fvn from "fnv-plus";
import { ReportWriter } from "./ReportWriter";
import { ExecutionResults } from "../model";
import { LiveDocOptions } from "../LiveDocOptions";
import chalk from "chalk";


//import * as fs from "fs-extra";

/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base;

/**
 * Initialize a new `JSON` reporter.
 *
 * @api public
 * @param {Runner} runner
 */
function livedocReporter(runner, options) {
    new LiveDocReporter(runner, options);
}
exports = module.exports = livedocReporter;

class LiveDocReporter {
    constructor (runner, options) {
        Base.call(this, runner);
        const _this = this;
        const livedocOptions: LiveDocOptions = options.livedoc;

        const reporter = livedocOptions.reporterOptions.reporter;
        reporter.colorTheme = livedocOptions.reporterOptions.colors;
        reporter.options = options.reporterOptions;

        let executionResults: ExecutionResults;

        reporter.executionStart(new ReportWriter());

        // Only enable colors if its been specified
        if (reporter.constructor.name !== "SilentReporter" && !options.useColors) {
            chalk.level = 0;
        }
        runner.on('suite', function (suite) {
            const livedocContext: LiveDocContext = suite.livedoc;

            const reportWriter = new ReportWriter();

            // Add a unique Id
            const testContainer = _this.getTestContainer(suite);
            if (!testContainer) {
                return;
            }
            testContainer.id = fvn.hash(testContainer.title).str();

            // Notify reporter
            switch (livedocContext.type) {
                case "Feature":
                    reporter.featureStart(testContainer, reportWriter);
                    break;
                case "Background":
                    reporter.backgroundStart(testContainer, reportWriter);
                    break;
                case "Scenario":
                    reporter.scenarioStart(testContainer, reportWriter);
                    break;
                case "Scenario Outline":
                    // Check if this is an Example or the original    
                    if (testContainer.sequence === 1) {
                        reporter.scenarioOutlineStart(testContainer.scenarioOutline, reportWriter);
                    }

                    reporter.scenarioExampleStart(testContainer, reportWriter);
                    break;
                default:
                    reporter.suiteStart(testContainer, reportWriter);

            }

            const output = reportWriter.readOutput();
            if (output)
                console.log(output);
        });

        runner.on('suite end', function (suite) {
            const livedocContext: LiveDocContext = suite.livedoc;

            const reportWriter = new ReportWriter();

            const testContainer = _this.getTestContainer(suite);
            if (!testContainer) {
                return;
            }

            switch (livedocContext.type) {
                case "Feature":
                    reporter.featureEnd(testContainer, reportWriter);
                    break;
                case "Background":
                    reporter.backgroundEnd(testContainer, reportWriter);
                    break;
                case "Scenario":
                    reporter.scenarioEnd(testContainer, reportWriter);
                    break;
                case "Scenario Outline":
                    reporter.scenarioExampleEnd(testContainer, reportWriter);

                    if (testContainer.sequence === testContainer.scenarioOutline.examples.length) {
                        reporter.scenarioOutlineEnd(testContainer, reportWriter);
                    }
                    break;
                default:
                    reporter.suiteEnd(testContainer, reportWriter);
            }

            const output = reportWriter.readOutput();
            if (output)
                console.log(output);
        });

        runner.on('test', function (test: any) {
            const reportWriter = new ReportWriter();
            const step: model.LiveDocTest<any> = test.step;

            if (step.constructor.name === "StepDefinition") {
                const stepDefinition = step as model.StepDefinition;
                if (stepDefinition.parent.constructor.name === "ScenarioExample") {
                    reporter.stepExampleStart(test.step, reportWriter);
                } else {
                    reporter.stepStart(test.step, reportWriter);
                }
            } else {
                reporter.testStart(step, reportWriter);
            }
            const output = reportWriter.readOutput();
            if (output)
                console.log(output);
        });

        runner.on('test end', function (test: any) {
            const step: model.LiveDocTest<any> = test.step;
            step.code = test.fn ? test.fn.toString() : "";
            step.executionTime = test.duration || 0;
            if (step) {
                step.setStatus(step.status);
            }

            const reportWriter = new ReportWriter();
            if (step.constructor.name === "StepDefinition") {
                const stepDefinition = step as model.StepDefinition;
                if (stepDefinition.parent.constructor.name === "ScenarioExample") {
                    reporter.stepExampleEnd(test.step, reportWriter);
                } else {
                    reporter.stepEnd(test.step, reportWriter);
                }
            } else {
                reporter.testEnd(step, reportWriter);
            }
            const output = reportWriter.readOutput();

            if (output) {
                console.log(output);
            }

            // locate the executionResults
            if (!executionResults) {
                executionResults = _this.getExecutionResults(test);
            }
        });

        runner.on('pass', function (test: Mocha.ITest) {
            (test as any).step.status = SpecStatus.pass;
        });

        runner.on('fail', function (test: any) {
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
        });

        runner.on('pending', function (test: Mocha.ITest) {
            (test as any).step.status = SpecStatus.pending;
        });

        runner.on('end', function (test) {
            const reportWriter = new ReportWriter();
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
            reporter.executionEnd(actualResults, reportWriter);
            const output = reportWriter.readOutput();
            if (output)
                console.log(output);
        });

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
        let livedocDescribe: model.LiveDocSuite;
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

}
