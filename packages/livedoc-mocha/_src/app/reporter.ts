import * as model from "./model/Feature";
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

    var self = this;
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
    }

    suiteFeature.suites.forEach(suiteScenario => {
        const scenario = processScenario(suiteScenario);
        if (scenario instanceof model.Background) {
            feature.background = scenario;
        } else {
            feature.scenarios.push(scenario);
        }
    });
    return feature;
}

function processScenario(suiteScenario): model.Scenario {
    let scenario: model.Scenario;
    if (suiteScenario.ctx) {
        let livedocScenario: model.Scenario;
        if (suiteScenario.ctx.type === "Scenario") {
            scenario = new model.Scenario();
            livedocScenario = suiteScenario.ctx.scenarioContext;
        } else if (suiteScenario.ctx.type === "Scenario Outline") {
            scenario = new model.Scenario();
            livedocScenario = suiteScenario.ctx.scenarioOutlineContext;
        } else {
            scenario = new model.Background();
            livedocScenario = suiteScenario.ctx.backgroundContext;
        }
        // This is a livedoc-mocha feature
        scenario.title = livedocScenario.title;
        scenario.description = livedocScenario.description;
    }

    scenario.id = suiteScenario.id;
    scenario.associatedFeatureId = suiteScenario.parent.id;
    return scenario;
}

/**
 * Return a plain-object representation of `test`
 * free of cyclic properties etc.
 *
 * @api private
 * @param {Object} test
 * @return {Object}
 */
function clean(test) {
    return {
        title: test.title,
        fullTitle: test.fullTitle(),
        duration: test.duration,
        currentRetry: test.currentRetry(),
        err: errorJSON(test.err || {})
    };
}

/**
 * Transform `error` into a JSON object.
 *
 * @api private
 * @param {Error} err
 * @return {Object}
 */
function errorJSON(err) {
    var res = {};
    Object.getOwnPropertyNames(err).forEach(function (key) {
        res[key] = err[key];
    }, err);
    return res;
}