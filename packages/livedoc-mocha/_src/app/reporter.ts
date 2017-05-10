import * as model from "livedoc-model"
import * as fs from "fs-extra";

/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base;

/**
 * Expose `JSON`.
 */

exports = module.exports = JSONReporter;

/**
 * Initialize a new `JSON` reporter.
 *
 * @api public
 * @param {Runner} runner
 */
function JSONReporter(runner) {
    Base.call(this, runner);

    //var self = this;
    var tests = [];
    var pending = [];
    var failures = [];
    var passes = [];
    var uniqueId = 0;
    var features: model.Feature[] = [];

    // Add a unique identifier to each test
    function getUniqueId() {
        uniqueId++;
        return uniqueId;
    }

    // Done function will be called before mocha exits

    // This is where we will save JSON and generate the report

    this.done = (failures, exit) => done(features, failures, exit);

    runner.on('test', test => (test.id = getUniqueId()));

    runner.on('test end', function (test) {
        tests.push(test);
    });

    runner.on('pass', function (test) {
        passes.push(test);
    });

    runner.on('fail', function (test) {
        failures.push(test);
    });

    runner.on('pending', function (test) {
        test.id = getUniqueId();
        pending.push(test);
    });

    runner.on('end', function () {

        // Iterate the top level suites - these are features
        runner.suite.suites.forEach(feature => {
            features.push(processFeature(feature));
        });

        process.stdout.write(JSON.stringify(features, null, 2));
    });
}
async function done(output, failures, exit) {
    try {
        // Save the JSON to disk
        const filename = './livedoc.json';
        await saveFile(filename, output);
        console.log(`Report JSON saved to ${filename}`);

    } catch (err) {
        console.log(err, 'error');
    }
    exit && exit(failures);
}

// The typescript definition isn't complete enough
function processFeature(suiteFeature: any): model.Feature {
    const feature = new model.Feature();
    feature.id = suiteFeature.id;
    feature.filename = suiteFeature.file;
    if (suiteFeature.ctx && suiteFeature.ctx.type === "Feature") {
        // This is a livedoc-mocha feature
        const livedocFeature = suiteFeature.ctx.featureContext;
        feature.title = livedocFeature.title;
        feature.description = livedocFeature.description;
        feature.tags = livedocFeature.tags;

    }

    suiteFeature.suites.forEach(suiteScenario => {
        const scenario = processScenario(suiteScenario, feature.id);
        if (scenario instanceof model.Background) {
            feature.background = scenario;
        } else {
            feature.scenarios.push(scenario);
        }
    });
    return feature;
}

function processScenario(suiteScenario, parentId: number): model.Scenario {
    let scenario: model.Scenario;
    let scenarioContext: ScenarioContext;

    if (suiteScenario.ctx) {
        switch (suiteScenario.ctx.type) {
            case "Scenario":
                scenario = new model.Scenario();
                scenarioContext = suiteScenario.ctx.scenarioContext;
                break;
            case "Scenario Outline":
                scenario = new model.ScenarioOutline();
                scenarioContext = suiteScenario.ctx.scenarioOutlineContext;
                (scenario as model.ScenarioOutline).examples = (scenarioContext as ScenarioOutlineContext).exampleTables;
                break;
            case "Background":
                scenario = new model.Background();

                scenarioContext = suiteScenario.ctx.backgroundContext;
                break;
            default:
                break;
        }
        // This is a livedoc-mocha scenario
        scenario.title = scenarioContext.title;
        scenario.description = scenarioContext.description;
        scenario.tags = scenarioContext.tags;
    } else {
        scenario.title = suiteScenario.title;
    }

    scenario.id = suiteScenario.id;
    scenario.associatedFeatureId = parentId;

    suiteScenario.tests.forEach(test => {
        scenario.steps.push(processTest(test, scenario.id));
    });

    return scenario;
}

function processTest(test, parentId: number): model.StepDefinition {
    let stepDefinition = new model.StepDefinition();
    const statusMap = { "passed": "Pass", "failed": "Failed" }
    if (test.ctx.type && test.ctx.stepContext) {
        const context = test.ctx.stepContext as StepContext;
        stepDefinition.title = context.title;
        stepDefinition.docString = context.docString;
        stepDefinition.table = context.table;
        stepDefinition.code = test.originalFunction ? test.originalFunction.toString() : "";
    } else {
        stepDefinition.title = test.title;
    }
    stepDefinition.id = test.id;
    if (test.pending) {
        stepDefinition.status = model.Status.Pending;
    } else {
        stepDefinition.status = statusMap[test.state];
    }
    stepDefinition.associatedScenarioId = parentId;
    stepDefinition.executionTime = test.duration || 0;


    if (test.err) {
        stepDefinition.error.actual = test.err.actual || "";
        stepDefinition.error.expected = test.err.expected || "";
        stepDefinition.error.stackTrace = test.err.stack || "";
        stepDefinition.error.message = test.err.message || "";
    }

    return stepDefinition;
}

function saveFile(filename, data) {
    return new Promise((resolve, reject) => {
        fs.writeJson(filename, data, err => {
            if (err) return console.error(err)

            console.log('success!')
        });
    });
}

/**
 * Transform `error` into a JSON object.
 *
 * @api private
 * @param {Error} err
 * @return {Object}
 */
/*function errorJSON(err) {
    var res = {};
    Object.getOwnPropertyNames(err).forEach(function (key) {
        res[key] = err[key];
    }, err);
    return res;
}
*/