/*
    Typescript definitions
*/
declare var feature: Mocha.IContextDefinition;
declare var background: Mocha.IContextDefinition;
declare var scenario: Mocha.IContextDefinition;
declare var scenarioOutline: Mocha.IContextDefinition;

declare var given: Mocha.ITestDefinition;
declare var when: Mocha.ITestDefinition;
declare var then: Mocha.ITestDefinition;
declare var and: Mocha.ITestDefinition;
declare var but: Mocha.ITestDefinition;

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

interface Row {
    [prop: string]: any;
}

class FeatureContext {
    filename: string;
    title: string;
    description: string;
}

class ScenarioContext {
    title: string;
    description: string;
    given: StepContext;
    and: StepContext[] = [];
}

class StepContext {
    title: string;
    table: Row[];

    docString: string;
    type: string;
    values: any[];

    tableAsEntity: Row;

    tableAsList: any[][];

    tableAsSingleList: any[];
}

class BackgroundContext extends ScenarioContext {

}

class ScenarioOutlineContext extends ScenarioContext {
    example: Row;
}

declare var featureContext: FeatureContext;
declare var scenarioContext: ScenarioContext;
declare var stepContext: StepContext;
declare var backgroundContext: BackgroundContext;
declare var scenarioOutlineContext: ScenarioOutlineContext;

// initialize context variables
featureContext = undefined;
scenarioContext = undefined;
stepContext = undefined;
backgroundContext = undefined;
scenarioOutlineContext = undefined;

/** @internal */
var _mocha = require('mocha'),
    _suite = require('mocha/lib/suite'),
    _test = require('mocha/lib/test');

_mocha.interfaces['livedoc-mocha'] = module.exports = liveDocMocha;

/** @internal */
function liveDocMocha(suite) {
    var suites = [suite];

    suite.on('pre-require', function (context, file, mocha) {

        var common = require('mocha/lib/interfaces/common')(suites, context, mocha);

        context.run = mocha.options.delay && common.runWithSuite(suite);

        var describeAliasBuilder = createDescribeAlias(file, suites, context, mocha);
        var stepAliasBuilder = createStepAlias(file, suites, mocha);

        context.after = common.after;
        context.afterEach = common.afterEach;
        context.before = common.before;
        context.beforeEach = common.beforeEach;

        context.feature = describeAliasBuilder('Feature');
        context.scenario = describeAliasBuilder('Scenario');
        context.describe = describeAliasBuilder('');
        context.context = describeAliasBuilder('');
        context.background = describeAliasBuilder('Background');
        context.scenarioOutline = describeAliasBuilder('Scenario Outline');

        context.given = stepAliasBuilder('Given');
        context.when = stepAliasBuilder('When');
        context.then = stepAliasBuilder('Then');
        context.and = stepAliasBuilder('  and');
        context.but = stepAliasBuilder('  but');
        context.it = stepAliasBuilder('');
    });
}

/** @internal */
function createStepAlias(file, suites, mocha) {
    return function testTypeCreator(type) {
        function testType(title, stepDefinitionFunction?) {
            var suite, test;
            var testName = type ? type + ' ' + title : title;
            suite = suites[0];

            let context = getStepContext(title);

            // Format the original title for better display output
            testName = formatBlock(testName, 10);

            if (suite.pending) stepDefinitionFunction = null;
            let stepDefinitionContextWrapper = stepDefinitionFunction
            if (stepDefinitionFunction) {
                stepDefinitionContextWrapper = function (...args) {
                    featureContext = suite.ctx.featureContext;
                    scenarioContext = suite.ctx.scenarioContext;
                    scenarioOutlineContext = suite.ctx.scenarioOutlineContext;

                    if (suite.parent.ctx.backgroundSuite) {
                        backgroundContext = suite.parent.ctx.backgroundSuite.ctx.backgroundContext;
                    }
                    stepContext = context;

                    if (suite.ctx.type == "Background") {
                        suite.ctx.backgroundFunc.push(stepDefinitionFunction);
                    } else {
                        // Check if a background has been defined, and if so only execute it once per scenario
                        if (suite.parent.ctx.backgroundSuite && !suite.ctx.backgroundFunExec) {
                            // Skip the first scenario as its already been executed
                            if (suite.parent.ctx.backgroundSuite.ctx.backgroundFunExecCount !== 1) {
                                backgroundContext = suite.parent.ctx.backgroundSuite.ctx.backgroundContext;
                                // execute all functions of the background
                                suite.parent.ctx.backgroundSuite.ctx.backgroundFunc.forEach(fn => {
                                    fn();
                                });
                            }
                            suite.ctx.backgroundFunExec = true;
                            suite.parent.ctx.backgroundSuite.ctx.backgroundFunExecCount++;
                        }
                    }

                    // A Given step is treated differently as its the primary way to setup
                    // state for a Spec, so it gets its own property on the scenarioContext
                    if (scenarioContext) {
                        if (type === "Given") {
                            suite.ctx.processingGiven = true;
                            scenarioContext.given = context;
                        } else if (["When", "Then"].indexOf(type) >= 0) {
                            suite.ctx.processingGiven = false;
                        } else if (suite.ctx.processingGiven) {
                            scenarioContext.and.push(context);
                        }
                    }

                    // A Given step is treated differently as its the primary way to setup
                    // state for a Spec, so it gets its own property on the backgroundContext
                    if (backgroundContext && suite.ctx.type === "Background") {
                        if (type === "Given") {
                            suite.ctx.processingGiven = true;
                            backgroundContext.given = context;
                        } else if (["When", "Then"].indexOf(type) >= 0) {
                            suite.ctx.processingGiven = false;
                        } else if (suite.ctx.processingGiven) {
                            backgroundContext.and.push(context);
                        }
                    }

                    // A Given step is treated differently as its the primary way to setup
                    // state for a Spec, so it gets its own property on the scenarioOutlineContext
                    if (scenarioOutlineContext && suite.ctx.type === "Scenario Outline") {
                        // Scenario Outlines also require that their titles be data bound
                        testName = bind(testName, scenarioOutlineContext.example);

                        if (type === "Given") {
                            suite.ctx.processingGiven = true;
                            scenarioOutlineContext.given = context;
                        } else if (["When", "Then"].indexOf(type) >= 0) {
                            suite.ctx.processingGiven = false;
                        } else if (suite.ctx.processingGiven) {
                            scenarioOutlineContext.and.push(context);
                        }
                    }

                    stepDefinitionFunction(args)
                }
            }
            if (scenarioOutlineContext && suite.ctx.type === "Scenario Outline") {
                // Scenario Outlines also require that their titles be data bound
                testName = bind(testName, scenarioOutlineContext.example);
            }

            test = new _test(testName, stepDefinitionContextWrapper);
            test.file = file;
            suite.addTest(test);

            return test;
        }

        (testType as any).skip = function skip(title) {
            testType(title);
        };

        (testType as any).only = function only(title, fn) {
            var test = testType(title, fn);
            mocha.grep(test.fullTitle());
        };

        return testType;
    };

}

/** @internal */
function createDescribeAlias(file, suites, context, mocha) {
    return function wrapperCreator(type) {
        function createLabel(title) {
            if (!type) return title;
            let testName = type + ': ' + title;

            // Format the original title for better display output
            switch (type) {
                case "Feature":
                    testName = formatBlock(testName, 4);
                    break;
                case "Scenario":
                    testName = formatBlock(testName, 6);
                    break;
            }
            return testName;
        }
        function wrapper(title, fn) {
            var suite = _suite.create(suites[0], createLabel(title));

            suite.file = file;
            const parts = getDescribeParts(title);
            if (type === "Feature") {
                const context = new FeatureContext();
                context.title = parts.title;
                context.description = parts.description;
                context.filename = file.replace(/^.*[\\\/]/, '');
                suite.ctx.featureContext = context;
                featureContext = context;
            } else if (type === "Background") {
                const context = new BackgroundContext();
                context.title = parts.title;
                context.description = parts.description;
                suite.ctx.backgroundContext = context;
                backgroundContext = context;
                // Need to put the context on the parent or it won't be available
                // to the scenarios
                suite.ctx.backgroundContext = backgroundContext;
                suite.ctx.backgroundFunc = [];
                suite.ctx.backgroundFunc.push(fn);
                suite.ctx.backgroundFunExecCount = 1;

                // Make this suite available via the parent
                suite.parent.ctx.backgroundSuite = suite;
            } else if (type === "Scenario Outline") {
                // Setup the basic context for the scenarioOutline
                const context = new ScenarioOutlineContext();
                context.title = parts.title;
                context.description = parts.description;

                // Extract the Examples:
                const table = getTableAsList(title);
                for (let i = 1; i < table.length; i++) {
                    scenarioOutlineContext = context;
                    scenarioOutlineContext.example = getTableRowAsEntity(table, i);
                    var outlineSuite = _suite.create(suites[0], createLabel(scenarioOutlineContext.title));
                    outlineSuite.ctx.scenarioOutlineContext = context;
                    suite.ctx.type = type;
                    outlineSuite.ctx.type = type;
                    suites.unshift(outlineSuite);
                    fn.call(outlineSuite);
                    suites.shift();
                }

                return outlineSuite;

            } else {
                // Scenario
                const context = new ScenarioContext();
                context.title = parts.title;
                context.description = parts.description;
                suite.ctx.scenarioContext = context;
                scenarioContext = context;
            }
            suite.ctx.type = type;
            suites.unshift(suite);
            fn.call(suite);

            suites.shift();

            return suite;
        }

        (wrapper as any).skip = function skip(title, fn) {
            var suite = _suite.create(suites[0], createLabel(title));

            suite.pending = true;
            suites.unshift(suite);
            fn.call(suite);
            suites.shift();
        };

        (wrapper as any).only = function only(title, fn) {
            var suite = wrapper(title, fn);
            mocha.grep(suite.fullTitle());
        };

        return wrapper;
    };

    function getDescribeParts(text: string) {
        let arrayOfLines = text.match(/[^\r\n]+/g);
        let description = "";
        let title = "";
        if (arrayOfLines.length > 0) {
            for (let i = 0; i < arrayOfLines.length; i++) {
                let line = arrayOfLines[i];
                if (line.startsWith(" ")) {
                    arrayOfLines[i] = line.trim();
                }
            }

            title = arrayOfLines[0];
            arrayOfLines.shift();
            description = arrayOfLines.join("\n");
        }
        let result = {
            title,
            description
        };
        return result;
    };


}

// Used to bind the model to the values.
/** @internal */
function bind(content, model) {
    var regex = new RegExp("<[\\w\\d]+>", "g");
    return content.replace(regex, (item, pos, originalText) => {
        return applyBinding(item, model);
    });
}

function applyBinding(item, model) {
    var key = item.replace("<", "").replace(">", "");
    if (model.hasOwnProperty(key))
        return model[key];
    else {
        return item;
    }
}
/** @internal */
function formatBlock(text: string, indent: number): string {
    let arrayOfLines = text.split(/\r?\n/);
    if (arrayOfLines.length > 1) {
        for (let i = 1; i < arrayOfLines.length; i++) {
            let line = arrayOfLines[i];
            // Apply indentation
            arrayOfLines[i] = " ".repeat(indent) + line.trim();

        }
        return arrayOfLines.join("\n");
    } else {
        return text;
    }
}

/** @internal */
function getStepContext(title: string): StepContext {
    let context = new StepContext();
    const parts = getStepParts(title);
    const tableAsList = getTableAsList(title);

    const table = getTable(tableAsList)
    const tableAsEntity = getTableAsEntity(tableAsList);
    const tableAsSingleList = getTableAsSingleList(tableAsList);
    context.title = parts.title;
    context.docString = parts.docString;
    context.values = parts.values;
    context.table = table;
    context.tableAsEntity = tableAsEntity;
    context.tableAsList = tableAsList;
    context.tableAsSingleList = tableAsSingleList;

    return context;
}

/** @internal */
function getTableAsList(text: string): any[][] {
    let arrayOfLines = text.match(/[^\r\n]+/g);
    let tableArray: string[][] = [];

    if (arrayOfLines.length > 1) {
        for (let i = 1; i < arrayOfLines.length; i++) {
            let line = arrayOfLines[i];
            line = line.trim();
            if (line.startsWith("|") && line.endsWith("|")) {
                // Looks like part of a table
                const rowData = line.split("|");
                let row: any[] = [];
                for (let i = 1; i < rowData.length - 1; i++) {
                    // Convert the values to the best primitive type
                    const valueString = rowData[i].trim();
                    const value = +valueString;
                    if (value) {
                        row.push(value)
                    } else {
                        row.push(valueString);
                    }
                }
                tableArray.push(row);
            }
        }
    }
    return tableArray;
}


/** @internal */
function getTable(tableArray: any[][]): Row[] {
    let table: Row[] = [];

    if (tableArray.length === 0) {
        return table;
    }

    let header = tableArray[0];
    for (let i = 1; i < tableArray.length; i++) {
        let rowData = tableArray[i];
        let row: Row = {};
        for (let column = 0; column < rowData.length; column++) {
            // Copy column to header key
            row[header[column]] = rowData[column];
        }
        table.push(row);
    }
    return table;
}

/** @internal */
function getTableAsEntity(tableArray: any[][]): object {

    if (tableArray.length === 0 || tableArray[0].length > 2) {
        return;
    }

    let entity = {};
    for (let row = 0; row < tableArray.length; row++) {
        // Copy column to header key
        entity[tableArray[row][0].toString()] = tableArray[row][1];
    }
    return entity;
}

/** @internal */
function getTableRowAsEntity(tableArray: any[][], rowIndex: number): object {
    let entity = {};
    const rowHeader = tableArray[0];
    const row = tableArray[rowIndex];
    for (let p = 0; p < rowHeader.length; p++) {
        // Copy column to header key
        entity[rowHeader[p].toString()] = row[p];
    }
    return entity;
}

/** @internal */
function getTableAsSingleList(tableArray: any[][]): any[] {
    if (tableArray.length === 0) {
        return;
    }

    let list = [];
    for (let row = 0; row < tableArray.length; row++) {
        // Copy column to header key
        list.push(tableArray[row][0]);
    }
    return list;
}

/** @internal */
function getStepParts(text: string) {
    let arrayOfLines = text.match(/[^\r\n]+/g);
    let docString = "";
    let title = "";
    let values: string[];

    if (arrayOfLines.length > 0) {
        for (let i = 0; i < arrayOfLines.length; i++) {
            let line = arrayOfLines[i];
            if (line.startsWith(" ")) {
                arrayOfLines[i] = line.trim();
            }
        }

        title = arrayOfLines[0];
        values = getValuesFromTitle(title);
        arrayOfLines.shift();
        // Check if there's a docString present
        for (let i = 0; i < arrayOfLines.length; i++) {
            let line = arrayOfLines[i];
            if (line.startsWith('"""')) {
                let docLines = [];
                i++;
                for (let y = 0; y < arrayOfLines.length - i; y++) {
                    if (arrayOfLines[i].startsWith('"""')) {
                        // end of docString
                        break;
                    }
                    docLines.push(arrayOfLines[i]);
                    i++;
                }
                docString = docLines.join('\n');
            }
        }
    }
    let result = {
        title,
        docString,
        values
    };
    return result;
};

/** @internal */
function getValuesFromTitle(text: string) {
    let arrayOfValues = text.match(/(["'](.*?)["'])+/g);
    arrayOfValues
    let results = [];
    if (arrayOfValues) {
        arrayOfValues.forEach(element => {
            const valueString = element.substr(1, element.length - 2).trim();
            const value = +valueString;
            if (value) {
                results.push(value)
            } else {
                results.push(valueString);
            }
        });
    }
    return results;
}
