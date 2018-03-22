import * as mocha from "mocha";
import * as mochaCommon from "mocha/lib/interfaces/common";
import * as mochaSuite from "mocha/lib/suite";
import * as mochaTest from "mocha/lib/test";

import * as model from "./model";
import { LiveDoc } from "./livedoc";
import { LiveDocContext } from "./LiveDocContext";
import { BddContext } from "./BddContext";
import { ScenarioOutlineContext } from "./ScenarioOutlineContext";
import { LiveDocGrammarParser } from "./parser/Parser";
import { LiveDocDescribe } from "./model/LiveDocDescribe";
import { RuleViolations } from "./model/RuleViolations";
import { LiveDocRuleViolation } from "./model/LiveDocRuleViolation";
import { LiveDocRuleOption } from "./LiveDocRuleOption";

const colors = require("colors");

const liveDocGrammarParser = new LiveDocGrammarParser();

function resetGlobalVariables(context) {
    // initialize context variables
    context.featureContext = undefined;
    context.scenarioContext = undefined;
    context.stepContext = undefined;
    context.backgroundContext = undefined;
    context.scenarioOutlineContext = undefined;
}

// Polyfils
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}

if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (searchString, position) {
        var subjectString = this.toString();
        if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.lastIndexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}


(mocha as any).interfaces['livedoc-mocha'] = module.exports = liveDocMocha;

/**
 * Used to initialize the livedoc context for a new Feature
 * 
 * @param {Mocha.ISuite} suite 
 * @param {Feature} feature 
 * @param {string} type 
 * @returns {LiveDocContext} 
 */
function addLiveDocContext(suite: Mocha.ISuite, feature: model.Feature, type: string): LiveDocContext {
    const livedoc = new LiveDocContext();
    livedoc.type = type;
    livedoc.parent = (suite.parent as any).livedoc;
    livedoc.feature = feature;
    (suite as any).livedoc = livedoc;
    return livedoc;
}

/**
 * Used to initialize the livedoc bdd context for a new Describe
 * 
 * @param {mocha.ISuite} suite 
 * @param {Describe} describe 
 * @param {string} type 
 * @returns {BddContext} 
 */
function addBddContext(suite: mocha.ISuite, describe: model.Describe, type: string): BddContext {
    const bdd = new BddContext();
    bdd.type = type;
    bdd.parent = (suite as any).livedoc;
    bdd.describe = describe;
    bdd.child = describe;
    (suite as any).livedoc = bdd;
    return bdd;
}

/** @internal */
function liveDocMocha(suite) {
    var suites = [suite];

    suite.on('pre-require', function (context, file, mocha) {
        const commonInterfaces = require('mocha/lib/interfaces/common')(suites, context, mocha);
        context.run = mocha.options.delay && mochaCommon.runWithSuite(suite);

        var describeAliasBuilder = createDescribeAlias(file, suites, context, mocha, mochaCommon);
        var stepAliasBuilder = createStepAlias(file, suites, mocha, mochaCommon);

        context.after = commonInterfaces.after;
        context.afterEach = commonInterfaces.afterEach;
        context.before = commonInterfaces.before;
        context.beforeEach = commonInterfaces.beforeEach;

        context.afterBackground = function (fn: any) {
            // Assign the background to the parent ie Feature so it can be accessed by 
            // the Features scenarios.
            suites[0].parent.livedoc.afterBackground = fn;
        };

        context.feature = describeAliasBuilder('Feature');
        context.scenario = describeAliasBuilder('Scenario');
        context.describe = describeAliasBuilder('bdd');
        context.context = describeAliasBuilder('bdd');
        context.background = describeAliasBuilder('Background');
        context.scenarioOutline = describeAliasBuilder('Scenario Outline');

        context.given = stepAliasBuilder('Given');
        context.when = stepAliasBuilder('When');
        context.then = stepAliasBuilder('Then');
        context.and = stepAliasBuilder('and');
        context.but = stepAliasBuilder('but');
        context.it = stepAliasBuilder('bdd');

        // livedoc globals
        context.featureContext;
        context.scenarioContext;
        context.stepContext;
        context.backgroundContext;
        context.scenarioOutlineContext;
    });

    (global as any).liveDocRuleOption = LiveDocRuleOption;
    // Extract command line parameters
    const livedoc = new LiveDoc();
    livedoc.options.include = getCommandLineOptions("--ld-include");
    livedoc.options.exclude = getCommandLineOptions("--ld-exclude");
    livedoc.options.showFilterConflicts = getCommandLineOption("--showFilterConflicts");
    (global as any).livedoc = livedoc;
}

function getCommandLineOptions(key: string): string[] {
    const args = process.argv;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === key) {
            return args[i + 1].split(" ");
        }
    }
    return [];
}

// Used to determine if a command option is present
function getCommandLineOption(key: string): boolean {
    const args = process.argv;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === key) {
            return true
        }
    }
    return false;
}

/** @internal */
function createStepAlias(file, suites, mocha, common) {
    return function testTypeCreator(type) {
        function testType(title, stepDefinitionFunction?) {
            var suite, test;
            let testName: string;

            // Refactor so that only place adds the test see describe
            // skipped tests are not working because the test is not being added
            let stepDefinition: model.StepDefinition;
            suite = suites[0];

            const livedocContext = suite.livedoc as LiveDocContext;
            const suiteType = livedocContext && livedocContext.type;
            let stepDefinitionContextWrapper = stepDefinitionFunction;
            try {
                if (type === "invalid" || !suiteType) {
                    testName = title;
                    if (stepDefinitionFunction) {
                        stepDefinitionContextWrapper = function (...args) {
                            displayWarningsInlineIfPossible(livedocContext, null);
                            return stepDefinitionFunction(args);
                        }
                    }
                } else if (suiteType === "bdd") {
                    const bddContext = (livedocContext as any) as BddContext;
                    const bddTest = new model.Test(title)
                    testName = bddTest.title;
                    bddContext.child.tests.push(bddTest);
                    if (stepDefinitionFunction) {
                        stepDefinitionContextWrapper = function (...args) {
                            displayWarningsInlineIfPossible(livedocContext, null);
                            return stepDefinitionFunction(args);
                        }
                    }
                } else {
                    // Check if the type is a bdd type
                    if (type === "bdd") {
                        livedocContext.feature.addViolation(RuleViolations.mustNotMixLanguages, `This feature is using bdd syntax, did you mean to use given instead?`, title);
                    }

                    if (suite._beforeAll.length > 0) {
                        livedocContext.scenario.addViolation(RuleViolations.enforceUsingGivenOverBefore, `Using before does not help with readability, consider using a given instead.`, title);
                        throw new Error("Ignore");
                    }

                    stepDefinition = liveDocGrammarParser.createStep(type, title);
                    if (suiteType === "Background") {
                        livedocContext.feature.background.addStep(stepDefinition);
                    } else if (suiteType === "Scenario" || suiteType === "Scenario Outline") {
                        livedocContext.scenario.addStep(stepDefinition);
                    } else {
                        livedocContext.feature.addViolation(RuleViolations.givenWhenThenMustBeWithinScenario, `Invalid Gherkin, ${type} can only appear within a Background, Scenario or Scenario Outline`, title);
                        throw new Error("Ignore");
                    }

                    testName = stepDefinition.displayTitle;

                    if (stepDefinitionFunction) {
                        stepDefinitionContextWrapper = async function (...args) {
                            displayWarningsInlineIfPossible(livedocContext, stepDefinition);
                            (global as any).featureContext = livedocContext.feature.getFeatureContext();
                            switch (livedocContext.type) {
                                case "Background":
                                    (global as any).backgroundContext = livedocContext.feature.getBackgroundContext();
                                    break;
                                case "Scenario":
                                    (global as any).scenarioContext = livedocContext.scenario.getScenarioContext();
                                    break;
                                case "Scenario Outline":
                                    (global as any).scenarioOutlineContext = livedocContext.scenario.getScenarioContext() as ScenarioOutlineContext;
                                    break;
                            }

                            // If the type is a background then bundle up the steps but don't execute them
                            // they will be executed prior to each scenario.
                            if (livedocContext.type == "Background") {
                                // Record the details necessary to execute the steps later on
                                const stepDetail = { func: stepDefinitionFunction, stepDefinition: stepDefinition };
                                // Have to put on the parent suite as scenarios and backgrounds are at the same level
                                suite.parent.livedoc.backgroundSteps.push(stepDetail);
                            } else {
                                if (livedocContext.scenarioId != 1 &&
                                    suite.parent.livedoc.backgroundSteps && !livedocContext.backgroundStepsComplete) {
                                    // Mark the background as complete for this scenario. This must be done first incase a step throws an exception
                                    livedocContext.backgroundStepsComplete = true;
                                    // set the background context
                                    (global as any).backgroundContext = livedocContext.feature.getBackgroundContext();
                                    for (let i = 0; i < suite.parent.livedoc.backgroundSteps.length; i++) {
                                        const stepDetails = suite.parent.livedoc.backgroundSteps[i];
                                        // reset the stepContext for this step
                                        (global as any).stepContext = stepDetails.stepDefinition.getStepContext();
                                        const result = stepDetails.func();
                                        if (result && result["then"]) {
                                            await result;
                                        }
                                    }
                                }
                            }
                            // Must reset stepContext as execution of the background may have changed it
                            (global as any).stepContext = stepDefinition.getStepContext();

                            return stepDefinitionFunction(args);
                        }
                    }
                }
            }
            catch (e) {
                if (e.constructor.name === "LiveDocRuleViolation") {
                    if (livedocContext.feature) {
                        livedocContext.feature.addViolationInstance(e);
                    }
                    displayRuleViolation(livedocContext.feature, e);
                    return testTypeCreator("invalid")(title, stepDefinitionFunction);
                } else if (e.constructor.name === "Error" && e.message === "Ignore") {
                    // Ignore this error - it will be reported later.
                    return testTypeCreator("invalid")(title, stepDefinitionFunction);
                } else {
                    throw e;
                }
            }

            if (suite.isPending()) {
                // Skip processing test function if the suite is marked to skip
                stepDefinitionContextWrapper = null;
            }
            test = new mochaTest(testName, stepDefinitionContextWrapper);
            test.file = file;
            suite.addTest(test);

            return test;
        }

        (testType as any).skip = function skip(title) {
            testType(title);
        };

        (testType as any).only = function only(title, fn) {
            return common.test.only(mocha, testType(title, fn));
        };

        return testType;
    };

}

function displayWarningsInlineIfPossible(livedocContext: LiveDocContext, stepDefinition: model.StepDefinition) {
    // if the parent has a rule violation report it here to make it more visible to the dev they made a mistake
    if (livedocContext && livedocContext.scenario) {
        livedocContext.scenario.ruleViolations.forEach(violation => {
            displayRuleViolation(livedocContext.feature, violation);
        });
    }
    if (livedocContext && livedocContext.feature) {
        livedocContext.feature.ruleViolations.forEach(violation => {
            displayRuleViolation(livedocContext.feature, violation);
        });
    }

    if (stepDefinition) {
        stepDefinition.ruleViolations.forEach(violation => {
            displayRuleViolation(livedocContext.feature, violation);
        });
    }
}

const displayedViolations = [];
function displayRuleViolation(feature: model.Feature, e: LiveDocRuleViolation) {
    let option: LiveDocRuleOption;
    if (displayedViolations[e.errorId]) {
        // Already displayed this error, so no need to do it again
        return;
    }

    const outputMessage = `${e.message} [title: ${e.title}, file: ${feature && feature.filename || ""}]`;
    option = livedoc.rules[RuleViolations[e.rule]];
    if (option === LiveDocRuleOption.warning) {
        displayedViolations.push(e.errorId);
        console.error(colors.bgYellow(colors.red(`WARNING[${e.errorId}]: ${outputMessage}`)));
    } else {
        throw e;
    }
}
/** @internal */
function createDescribeAlias(file, suites, context, mocha, common) {
    return function wrapperCreator(type) {
        function wrapper(title: string, fn: Function, opts: { pending?: boolean, isOnly?: boolean } = {}) {
            let suite: mocha.ISuite;
            try {

                if (type === "invalid") {
                    resetGlobalVariables(context);
                    suite = mochaSuite.create(suites[0], title);
                } else if (type === "bdd") {
                    resetGlobalVariables(context);
                    suite = processBddDescribe(suites, type, title, file);
                } else {
                    let livedocContext: LiveDocContext;
                    let feature: model.Feature;
                    let suiteDefinition: LiveDocDescribe;

                    switch (type) {
                        case "Feature":
                            resetGlobalVariables(context);
                            feature = liveDocGrammarParser.createFeature(title, file.replace(/^.*[\\\/]/, ''));
                            suiteDefinition = feature;
                            break;
                        default:
                            // get the current feature from context 
                            // Validate that we have a feature
                            if (!suites[0].livedoc || !suites[0].livedoc.feature) {
                                // No feature!!
                                throw new model.LiveDocRuleViolation(livedoc.rules.missingFeature, `${type} must be within a feature.`, title);
                            }
                            feature = suites[0].livedoc.feature;
                            break;
                    }

                    switch (type) {
                        case "Scenario":
                            suiteDefinition = liveDocGrammarParser.addScenario(feature, title);
                            break;
                        case "Scenario Outline":
                            suiteDefinition = liveDocGrammarParser.addScenarioOutline(feature, title);
                            break;
                        case "Background":
                            suiteDefinition = liveDocGrammarParser.addBackground(feature, title);
                            break;
                    }

                    suite = mochaSuite.create(suites[0], suiteDefinition.displayTitle);
                    (suite as any).pending = opts.pending || livedoc.shouldMarkAsPending(suiteDefinition.tags);
                    if (livedoc.shouldInclude(suiteDefinition.tags)) {
                        const suiteParent = suite.parent as any;
                        suiteParent._onlySuites = suiteParent._onlySuites.concat(suite);
                        mocha.options.hasOnly = true;

                        // Ensure that any associated background is also marked as only
                        if (feature.background) {
                            const scenarioBackground = suiteParent.suites.filter(s => s.title.startsWith('Background:'));
                            if (scenarioBackground) {
                                suiteParent._onlySuites = suiteParent._onlySuites.concat(scenarioBackground);
                            }
                        }
                    }
                    // initialize the livedoc context
                    livedocContext = addLiveDocContext(suite, feature, type);

                    switch (type) {
                        case "Feature":
                            (global as any).featureContext = feature.getFeatureContext();
                            // Backgrounds need to be executed for each scenario except the first one
                            // this value tags the scenario number
                            livedocContext.scenarioCount = 0;
                            break;
                        case "Background":
                            livedocContext.parent.backgroundSteps = [];
                            break;
                        case "Scenario":
                            if (livedocContext.parent.afterBackground) {
                                // Add the afterBackground function to each scenario's afterAll function
                                (suite as any).afterAll(() => {
                                    return livedocContext.parent.afterBackground();
                                });
                            }
                            livedocContext.parent.scenarioCount += 1;
                            livedocContext.scenarioId = livedocContext.parent.scenarioCount;
                        // Fall through on purpose
                        case "Scenario Outline":
                            livedocContext.scenario = suiteDefinition as model.Scenario;
                            break;
                    }

                    // Specific logic for Scenario Outlines
                    if (type === "Scenario Outline") {
                        // Setup the basic context for the scenarioOutline

                        const scenarioOutline = suiteDefinition as model.ScenarioOutline;
                        for (let i = 0; i < scenarioOutline.scenarios.length; i++) {
                            const currentScenario = scenarioOutline.scenarios[i];
                            context = currentScenario.getScenarioContext();
                            var outlineSuite = mochaSuite.create(suites[0], currentScenario.displayTitle);

                            livedocContext = addLiveDocContext(outlineSuite, feature, type);
                            livedocContext.scenario = currentScenario;
                            livedocContext.parent.scenarioCount += 1;
                            livedocContext.scenarioId = outlineSuite.parent.livedoc.scenarioCount;
                            suites.unshift(outlineSuite);

                            if (livedocContext.parent.afterBackground) {
                                outlineSuite.afterAll(() => {
                                    return livedocContext.parent.afterBackground();
                                });
                            };

                            if (opts.pending || suites[0].isPending() || livedoc.shouldMarkAsPending(suiteDefinition.tags)) {
                                (outlineSuite as any).pending = true;
                            }
                            if (opts.isOnly || livedoc.shouldInclude(suiteDefinition.tags)) {
                                (outlineSuite.parent as any)._onlySuites = (outlineSuite.parent as any)._onlySuites.concat(outlineSuite);
                                mocha.options.hasOnly = true;
                            }

                            const result = fn.call(outlineSuite);
                            if (result && result["then"]) {
                                throwAsyncNotSupported(type);
                            }
                            suites.shift();
                        }
                        return outlineSuite;
                    }
                }
            } catch (e) {
                if (e.constructor.name === "LiveDocRuleViolation") {
                    if (suites[0].livedoc && suites[0].livedoc.feature) {
                        suites[0].livedoc.feature.addViolationInstance(e);
                    }
                    displayRuleViolation(null, e);
                    // A validation exception has occurred mark as invalid
                    return wrapperCreator("invalid")(title, fn, opts);
                } else {
                    // Not a rule violation so rethrow
                    throw e;
                }
            }

            if (opts.pending || suites[0].isPending()) {
                (suite as any).pending = opts.pending;
            }
            if (opts.isOnly) {
                (suite.parent as any)._onlySuites = (suite.parent as any)._onlySuites.concat(suite);
                mocha.options.hasOnly = true;
            }

            suites.unshift(suite);
            const result = fn.call(suite);
            if (result && result["then"]) {
                throwAsyncNotSupported(type);
            }

            suites.shift();
            return suite;
        }

        (wrapper as any).skip = function skip(title, fn) {
            wrapper(title, fn, { pending: true });
        };

        (wrapper as any).only = function only(title, fn) {
            wrapper(title, fn, { isOnly: true });
        };

        return wrapper;
    };

    function throwAsyncNotSupported(type: string) {
        throw new model.LiveDocRuleViolation(RuleViolations.error, `The async keyword is not supported for ${type}`, "Unsupported keyword");
    }

    function processBddDescribe(suites: mocha.ISuite, type: string, title: string, file: string): mocha.ISuite {
        // This is a legacy describe/context test which doesn't support
        // the features of livedoc
        let livedocContext: BddContext;
        const childDescribe = new model.Describe(title);
        if (suites[0].livedoc && suites[0].livedoc.type !== "bdd") {
            const violation = new model.LiveDocRuleViolation(RuleViolations.mustNotMixLanguages, `This feature is using bdd syntax, did you mean to use scenario instead?`, title);
            throw violation;
        }

        if (!suites[0].livedoc) {
            livedocContext = addBddContext(suites[0], childDescribe, type);
        }
        else {
            livedocContext = suites[0].livedoc;
            livedocContext.child = childDescribe;
        }
        const suite = mochaSuite.create(suites[0], childDescribe.title);
        suite.livedoc = livedocContext;

        return suite;
    }
}
