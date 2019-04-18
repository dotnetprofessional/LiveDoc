import * as mocha from "mocha";
import * as mochaCommon from "mocha/lib/interfaces/common";
import * as mochaSuite from "mocha/lib/suite";
import chalk from "chalk";

import { MochaTest } from "./MochaTest";

import * as model from "./model";
import { LiveDoc } from "./livedoc";
import { LiveDocContext } from "./LiveDocContext";
import { ScenarioOutlineContext } from "./model/ScenarioOutlineContext";
import { LiveDocGrammarParser } from "./parser/Parser";
import { LiveDocSuite } from "./model/LiveDocSuite";
import { RuleViolations } from "./model/RuleViolations";
import { LiveDocRuleViolation } from "./model/LiveDocRuleViolation";
import { LiveDocRuleOption } from "./LiveDocRuleOption";
import { ExecutionResults } from "./model/ExecutionResults";
import { StepContext } from "./model/StepContext";
import { LiveDocOptions } from "./LiveDocOptions";

const liveDocGrammarParser = new LiveDocGrammarParser();
(global as any).livedoc = new LiveDoc();

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

    // Record the Feature with the root level Execution Results
    if (type === "Feature") {
        // add the feature to the Execution results or create one if not done so
        const parent = (suite.parent as any);
        if (parent.title === "") {
            // the suites parent is the root suite
            if (!parent.livedocResults) {
                parent.livedocResults = new ExecutionResults();
            }

            // Add feature to the results
            parent.livedocResults.addFeature(feature);
        } else {
            throw new model.ParserException("Feature not a child of the root suite.", feature.title, feature.filename)
        }
    }
    return livedoc;
}

/**
 * Used to initialize the livedoc bdd context for a new Describe
 * 
 * @param {mocha.ISuite} suite 
 * @param {model.MochaSuite} mochaSuite 
 * @param {string} type 
 * @returns {BddContext} 
 */
function addBddContext(suite: mocha.ISuite, mochaSuite: model.MochaSuite): model.MochaSuite {
    (suite as any).livedoc = mochaSuite;

    // add the describe to the Execution results or create one if not done so
    const parent = (suite.parent as any);
    if (parent.root) {
        // Add feature to the results
        parent.livedocResults.addSuite(mochaSuite);
    } else {
        // this is a child describe so add to the parents children instead
        parent.livedoc.children.push(mochaSuite);
    }

    return mochaSuite;
}

/** @internal */


export function liveDocMocha(suite) {
    var suites = [suite];

    // For the root suite, we also need to add tracking objects
    // its necessary to do here as the root suite doesn't get processed by suite.on
    if (suite.root) {
        const rootSuite = new model.MochaSuite(null, "root", "describe");
        (suite as any).livedoc = rootSuite;
        // the suites parent is the root suite
        suite.livedocResults = new ExecutionResults();
        // add the root suite to the results
        (suite.livedocResults as ExecutionResults).addSuite(rootSuite);
    }

    suite.on('pre-require', function (context, file, mocha) {

        const deepMerge = function (target: Object, source: Object): Object {
            Object.keys(source).forEach(key => {
                const targetValue = target[key];
                if (targetValue) {
                    if (typeof targetValue === "object") {
                        target[key] = deepMerge(targetValue, source[key]);
                    } else {
                        target[key] = source[key];
                    }
                } else {
                    target[key] = source[key];
                }
            });
            return target;
        }


        // Apply options
        // Add the options to the mocha instance and then only process again if they've not been set
        if (!mocha.livedocInitialized) {
            mocha.livedocInitialized = true;
            let livedocOptions: LiveDocOptions;

            // Report options/filters/rules can be set using the following options
            // 1. setting in code
            // 2. setting via mocha options
            // 3. setting via command line

            if (mocha.options.livedoc && mocha.options.livedoc.isolatedMode) {
                livedocOptions = deepMerge(new LiveDocOptions, mocha.options.livedoc) as LiveDocOptions;
            } else {
                // Migrate options set in code
                livedocOptions = deepMerge(new LiveDocOptions(), (global as any).livedoc.options) as LiveDocOptions;
                // Migrate options passed via mocha.options
                if (mocha.options.livedoc) {
                    // deep merge options passed via mocha.options
                    livedocOptions = deepMerge(livedocOptions, mocha.options.livedoc) as LiveDocOptions;
                }

                // Command line filters are additive and do not replace any existing filters
                livedocOptions.filters.include.push(...getCommandLineOptions("--ld-include"));
                livedocOptions.filters.exclude.push(...getCommandLineOptions("--ld-exclude"));
                const postReporters = getCommandLineOptions("--ld-reporters");
                if (postReporters && postReporters.length > 0) {
                    postReporters.forEach(reporter => {
                        livedocOptions.postReporters.push(require(reporter));
                    });
                }
                livedocOptions.filters.showFilterConflicts = getCommandLineOption("--showFilterConflicts") || livedocOptions.filters.showFilterConflicts

            }

            if (livedocOptions.filters.include.length > 0 || livedocOptions.filters.exclude.length > 0) {
                mocha.options.hasOnly = true
            }

            // update the option values with the new options
            mocha.options.livedoc = livedocOptions;
            // Assign the global to the mocha instance, but need to make a copy so as not to
            // affect the existing global version
            mocha.livedoc = Object.assign(new LiveDoc(), (global as any).livedoc);
            mocha.livedoc.options = livedocOptions;
        }

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
        context.describe = describeAliasBuilder('describe');
        context.context = describeAliasBuilder('context');
        context.background = describeAliasBuilder('Background');
        context.scenarioOutline = describeAliasBuilder('Scenario Outline');

        context.given = stepAliasBuilder('Given');
        context.when = stepAliasBuilder('When');
        context.then = stepAliasBuilder('Then');
        context.and = stepAliasBuilder('and');
        context.but = stepAliasBuilder('but');
        context.it = stepAliasBuilder('it');

        // livedoc globals
        let sc: StepContext;
        context.featureContext;
        context.scenarioContext = sc;
        context.stepContext;
        context.backgroundContext;
        context.scenarioOutlineContext;
    });
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
    return null;
}

/** @internal */
function createStepAlias(file, suites, mocha, common) {
    return function testTypeCreator(type) {
        function testType(title: string, stepDefinitionFunction?: Function, passedParam?: object | Function) {
            var suite, test;
            let testName: string;

            // Refactor so that only place adds the test see describe
            // skipped tests are not working because the test is not being added
            let stepDefinition: model.StepDefinition;
            suite = suites[0];

            const livedocContext = suite.livedoc as LiveDocContext;
            const suiteType = livedocContext && livedocContext.type;
            let stepDefinitionContextWrapper = stepDefinitionFunction;

            if (isLiveDocType(type)) {
                if (suite._beforeAll.length > 0) {
                    livedocContext.scenario.addViolation(RuleViolations.enforceUsingGivenOverBefore, `Using before does not help with readability, consider using a given instead.`, title);
                }

                stepDefinition = liveDocGrammarParser.createStep(type, title, passedParam);
                if (suiteType === "Background") {
                    livedocContext.feature.background.addStep(stepDefinition);
                } else if (suiteType === "Scenario" || suiteType === "Scenario Outline") {
                    livedocContext.scenario.addStep(stepDefinition);
                    // For Scenario Outlines add the steps to the outline as well as the examples
                    if (suiteType === "Scenario Outline" && (livedocContext.scenario as model.ScenarioExample).sequence === 1) {
                        (livedocContext.scenario as model.ScenarioExample).scenarioOutline.steps.push(stepDefinition);
                    }
                } else {
                    const filename = mocha.filename;
                    throw new model.ParserException(`Invalid Gherkin, ${type} can only appear within a Background, Scenario or Scenario Outline`, title, filename);
                }

                testName = stepDefinition.displayTitle;
                livedocContext.step = stepDefinition;
                displayWarningsInlineIfPossible(livedocContext, stepDefinition, mocha.options.livedoc, mocha);
                if (stepDefinitionFunction) {
                    stepDefinitionContextWrapper = async function (...args) {
                        displayWarningsInlineIfPossible(livedocContext, stepDefinition, mocha.options.livedoc, mocha);
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

                        // if the step has passed params then evaluate them now just prior to execution
                        liveDocGrammarParser.applyPassedParams(stepDefinition);

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
            } else {
                // Check if the type is a bdd type
                if (isLiveDocType(livedocContext.type)) {
                    throw new model.ParserException(`This ${livedocContext.type} is using bdd syntax, did you mean to use given instead?`, title, file);
                }

                // Some other Bdd language    
                const bddContext = (livedocContext as any) as model.MochaSuite;
                const bddTest = new model.LiveDocTest(bddContext, title);
                testName = bddTest.title;
                livedocContext.step = bddTest;
                bddContext.tests.push(bddTest);
                if (stepDefinitionFunction) {
                    stepDefinitionContextWrapper = async function (...args) {
                        displayWarningsInlineIfPossible(livedocContext, null, mocha.options.livedoc, mocha);
                        return stepDefinitionFunction(args);
                    }
                }
            }

            if (suite.isPending()) {
                // Skip processing test function if the suite is marked to skip
                stepDefinitionContextWrapper = null;
            }
            test = new MochaTest(testName, stepDefinitionContextWrapper, stepDefinitionFunction);
            test.file = file;
            test.step = livedocContext.step;
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

function displayWarningsInlineIfPossible(livedocContext: LiveDocContext, stepDefinition: model.StepDefinition, livedocOptions: LiveDocOptions, mocha: any) {
    // if the parent has a rule violation report it here to make it more visible to the dev they made a mistake
    if (livedocContext && livedocContext.scenario) {
        livedocContext.scenario.ruleViolations.forEach(violation => {
            displayRuleViolation(livedocContext.feature, violation, livedocOptions, mocha);
        });
    }
    if (livedocContext && livedocContext.feature) {
        livedocContext.feature.ruleViolations.forEach(violation => {
            displayRuleViolation(livedocContext.feature, violation, livedocOptions, mocha);
        });
    }

    if (stepDefinition) {
        stepDefinition.ruleViolations.forEach(violation => {
            displayRuleViolation(livedocContext.feature, violation, livedocOptions, mocha);
        });
    }
}

const displayedViolations = {};
function displayRuleViolation(feature: model.Feature, e: LiveDocRuleViolation, livedocOptions: LiveDocOptions, mocha: any) {
    let option: LiveDocRuleOption;
    if (displayedViolations[e.errorId]) {
        // Already displayed this error, so no need to do it again
        return;
    }

    const outputMessage = `${e.message} [title: ${e.title}, file: ${feature && feature.filename || ""}]`;
    option = livedocOptions.rules[RuleViolations[e.rule]];
    if (option === LiveDocRuleOption.warning) {
        // Only output the warning if using the default Spec reporter, livedoc reporters will handle it differently
        if (mocha._reporter.name === "Spec") {
            displayedViolations[e.errorId] = "X";
            console.error(chalk.bgYellow.red(`WARNING[${e.errorId}]: ${outputMessage}`));
        }
    } else if (option === LiveDocRuleOption.enabled) {
        throw e;
    }
}

function isLiveDocType(type: string): boolean {
    switch (type) {
        case "Feature":
        case "Scenario":
        case "Scenario Outline":
        case "Background":
        case "Given":
        case "When":
        case "Then":
        case "and":
        case "but":
            return true;
        default:
            return false;
    }
}

/** @internal */
function createDescribeAlias(file, suites, context, mocha, common) {
    return function wrapperCreator(type) {
        function wrapper(title: string, fn: Function, opts: { pending?: boolean, isOnly?: boolean } = {}) {
            let suite: mocha.ISuite;

            const filenameToRecord = file.replace(/[\\]/g, "/");
            switch (type) {
                case "Feature":
                case "Scenario":
                case "Scenario Outline":
                case "Background":
                    let livedocContext: LiveDocContext;
                    let feature: model.Feature;
                    let suiteDefinition: LiveDocSuite;

                    switch (type) {
                        case "Feature":
                            resetGlobalVariables(context);
                            feature = liveDocGrammarParser.createFeature(title, filenameToRecord);
                            suiteDefinition = feature;
                            break;
                        default:
                            // get the current feature from context 
                            // Validate that we have a feature
                            if (!suites[0].livedoc || !suites[0].livedoc.feature) {
                                // No feature!!
                                throw new model.ParserException(`${type} must be within a feature.`, title, filenameToRecord);
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
                    (suite as any).pending = opts.pending || mocha.livedoc.shouldMarkAsPending(suiteDefinition.tags);
                    if (mocha.livedoc.shouldInclude(suiteDefinition.tags) || opts.isOnly) {
                        const suiteParent = suite.parent as any;
                        suiteParent._onlySuites = suiteParent._onlySuites.concat(suite);

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
                                    const hookStep = liveDocGrammarParser.createStep("hook", "afterBackground", null);
                                    livedocContext.scenario.addStep(hookStep);
                                    livedocContext.step = hookStep;
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
                        for (let i = 0; i < scenarioOutline.examples.length; i++) {
                            const currentScenario = scenarioOutline.examples[i];
                            context = currentScenario.getScenarioContext();
                            var scenarioExampleSuite = mochaSuite.create(suites[0], currentScenario.displayTitle);

                            livedocContext = addLiveDocContext(scenarioExampleSuite, feature, type);
                            livedocContext.scenario = currentScenario;
                            livedocContext.parent.scenarioCount += 1;
                            livedocContext.scenarioId = scenarioExampleSuite.parent.livedoc.scenarioCount;
                            suites.unshift(scenarioExampleSuite);

                            if (livedocContext.parent.afterBackground) {
                                scenarioExampleSuite.afterAll(() => {
                                    return livedocContext.parent.afterBackground();
                                });
                            };

                            if (opts.pending || suites[0].isPending() || mocha.livedoc.shouldMarkAsPending(suiteDefinition.tags)) {
                                (scenarioExampleSuite as any).pending = true;
                            }
                            if (opts.isOnly || mocha.livedoc.shouldInclude(suiteDefinition.tags)) {
                                (scenarioExampleSuite.parent as any)._onlySuites = (scenarioExampleSuite.parent as any)._onlySuites.concat(scenarioExampleSuite);
                                mocha.options.hasOnly = true;
                            }

                            const result = fn.call(scenarioExampleSuite);
                            if (result && result["then"]) {
                                throwAsyncNotSupported(type, title, filenameToRecord);
                            }
                            suites.shift();
                        }
                        return scenarioExampleSuite;
                    }
                    break;
                default:
                    resetGlobalVariables(context);
                    suite = processBddDescribe(suites, type, title, filenameToRecord);
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
                throwAsyncNotSupported(type, title, filenameToRecord);
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

    function throwAsyncNotSupported(type: string, title, filename: string) {
        throw new model.ParserException(`The async keyword is not supported for ${type}`, title, filename);
    }

    function processBddDescribe(suites: mocha.ISuite, type: string, title: string, file: string): mocha.ISuite {
        // This is a legacy describe/context test which doesn't support
        // the features of livedoc
        let suiteParent: model.MochaSuite = null;
        if (suites[0].livedoc && !suites[0].root) {
            suiteParent = suites[0].livedoc;
            // Verify that this not part of a livedoc feature
            if (isLiveDocType(suites[0].livedoc.type)) {
                // seems this is using mixed languages which is not supported    
                throw new model.ParserException(`This ${suites[0].livedoc.type} is using bdd syntax, did you mean to use scenario instead?`, title, file);
            }
        }

        const suite = mochaSuite.create(suites[0], title);
        const childSuite = new model.MochaSuite(suiteParent, title, type);
        childSuite.filename = file;
        addBddContext(suite, childSuite);

        return suite;
    }
}


export default (mocha as any).interfaces['livedoc-mocha'];

