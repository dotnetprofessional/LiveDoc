import * as model from "../model"
import { LiveDocContext } from "../LiveDocContext";
import * as cliTable from "cli-table2";
import { TextBlockReader } from "../parser/TextBlockReader";
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
function livedoc(runner) {
    const reporter = new LiveDocReporter(runner);
}
exports = module.exports = livedoc;

class LiveDocReporter {
    constructor (runner) {
        Base.call(this, runner);

        var features: model.Feature[] = [];
        var describes: model.Describe[] = [];
        const _this = this;

        this.done = (failures, exit) => this.done(features, failures, exit);
        runner.on('suite', function (suite) {
            const livedoc = suite.livedoc as LiveDocContext;
            if (!livedoc) {
                console.log("Invalid Gherkin: " + suite.title);
                return;
            }
            switch (livedoc.type) {
                case "Feature":
                    features.push(livedoc.feature);
                    _this.formatFeature(livedoc.feature);
                    break;
                case "Background":
                    _this.formatBackground(livedoc.feature.background);
                    break;
                case "Scenario":
                case "Scenario Outline":
                    _this.formatScenario(livedoc.scenario);
                    break;
                case "bdd":
                    const bddContext: BddContext = (livedoc as any) as BddContext;
                    if (!bddContext.parent) {
                        describes.push(bddContext.describe);
                    }
                    console.log("  " + bddContext.describe.title);
                    break;
            }
        });

        runner.on('suite end', function () {
            console.log();
        });

        runner.on('test', function (test: Mocha.ITest) {
            // console.log("pass: " + test.title);
        });

        runner.on('test end', function (test: Mocha.ITest) {
            const livedoc = (test.parent as any).livedoc as LiveDocContext;
            if (livedoc && livedoc.step) {
                _this.formatStep(livedoc.step);
            }
        });

        runner.on('pass', function (test: Mocha.ITest) {
            // console.log("pass");
        });

        runner.on('fail', function (test: Mocha.ITest) {
            // console.log("fail");
        });

        runner.on('pending', function (test: Mocha.ITest) {
            // console.log("pending");
        });

        runner.on('end', function () {
            console.log("end");
        });

    }
    async done(output, failures, exit) {
        console.log("done");
        exit && exit(failures);
    }

    private applyLineIndent(text: string, size: number) {
        return " ".repeat(size) + text;
    }

    private applyBlockIndent(content: string, indent: number): string {
        const reader: TextBlockReader = new TextBlockReader(content);

        const indentPadding = " ".repeat(indent);
        let formattedResult = "";
        while (reader.next()) {
            formattedResult += indentPadding + reader.line.trim() + "\n";
        }

        return formattedResult;
    }

    private formatSuite(type: string, suite: model.LiveDocDescribe, indentSize: number) {
        console.log(this.applyLineIndent(`${type}: ${suite.title}`, indentSize));
        //console.log();
        console.log(this.formatDescription(suite.description || "", indentSize));
    }

    private formatFeature(feature: model.Feature) {
        this.formatSuite("Feature", feature, 2);
    }

    private formatBackground(background: model.Background) {
        this.formatSuite("Background", background, 4);
    }

    private formatScenario(scenario: model.Scenario) {
        this.formatSuite("Scenario", scenario, 4);
    }

    private formatScenarioOutline(scenarioOutline: model.ScenarioOutline) {
        console.log(this.formatSuite("Scenario Outline", scenarioOutline, 4));
    }

    private formatStep(step: model.StepDefinition) {
        let indent = 6;
        switch (step.type) {
            case "and":
            case "but":
                indent += 2;
                break;
        }
        console.log(this.applyLineIndent(`${step.type} ${step.title}`, indent));

        // format any data tables that may exist
        if (step.dataTable) {
            // instantiate 
            debugger;
            this.formatVerticalTable(step);
        }
    }

    private formatDescription(description: string, indent: number) {
        const formattedBlock = this.applyBlockIndent(description, indent);
        return chalk.whiteBright(formattedBlock);
    }

    //         let headers = [""].concat(step.dataTable[0] as Array<string>);

    private formatVerticalTable(step: model.StepDefinition) {
        // const headers = step.dataTable[0];
        // Determine the formatting based on table size etc
        let headerStyle = HeaderType.Top;
        if (step.dataTable[0].length === 2) {
            // A two column table typically means the items are key, value
            headerStyle = HeaderType.Left;
        } else if (!isNaN(Number(step.dataTable[0][0].trim()))) {
            // first value is a number so likely not a header left or top
            headerStyle = HeaderType.none;
        }
        const dataTable = new cliTable({});

        for (let i = 0; i < step.dataTable.length; i++) {
            // make a copy so we don't corrupt the original
            dataTable.push(step.dataTable[i].slice());

            // Format the cell within the row if necessary
            switch (headerStyle) {
                case HeaderType.Left:
                    dataTable[i][0] = chalk.green(dataTable[i][0]);
                    break;
                case HeaderType.Top:
                    if (i === 0) {
                        for (let c = 0; c < step.dataTable[0].length; c++) {
                            dataTable[0][c] = chalk.green(dataTable[0][c]);
                        }
                    }
                    break;
            }
        }
        // table is an Array, so you can `push`, `unshift`, `splice` and friends 
        console.log(this.applyBlockIndent(dataTable.toString(), 6));
    }
}

enum HeaderType {
    none,
    Top,
    Left
}