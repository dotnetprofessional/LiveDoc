import * as model from "../model"
import { LiveDocContext } from "../LiveDocContext";
import { BddContext } from "../model/BddContext";
import * as cliTable from "cli-table2";

//import * as fs from "fs-extra";

/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base;

/**
 * Expose `JSON`.
 */


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

    private applyIndent(text: string, size: number) {
        return " ".repeat(size) + text;
    }

    private formatSuite(type: string, title: string, indentSize: number) {
        return this.applyIndent(`${type}: ${title}`, indentSize);
    }

    private formatFeature(feature: model.Feature) {
        console.log(this.formatSuite("Feature", feature.title, 2));
    }

    private formatBackground(background: model.Background) {
        console.log(this.formatSuite("Background", background.title, 4));
    }

    private formatScenario(scenario: model.Scenario) {
        console.log(this.formatSuite("Scenario", scenario.title, 4));

    }

    private formatScenarioOutline(scenarioOutline: model.ScenarioOutline) {
        console.log(this.formatSuite("Scenario Outline", scenarioOutline.title, 4));
    }

    private formatStep(step: model.StepDefinition) {
        let indent = 6;
        switch (step.type) {
            case "and":
            case "but":
                indent += 2;
                break;
        }
        console.log(this.applyIndent(`${step.type} ${step.title}`, indent));

        // format any data tables that may exist
        if (step.dataTable) {
            // instantiate 
            debugger;
            this.formatVerticalTable(step);
        }
    }

    private formatVerticalTable(step: model.StepDefinition) {
        let row = [];
        const headers = step.dataTable[0];
        const dataTable = new cliTable({
            head: headers,
            style: { 'padding-left': 8, 'padding-right': 0 }

        });

        for (let i = 1; i < step.dataTable.length; i++) {
            dataTable.push(step.dataTable[i]);
        }
        // table is an Array, so you can `push`, `unshift`, `splice` and friends 
        console.log(dataTable.toString());
    }
}

