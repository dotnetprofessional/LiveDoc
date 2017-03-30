/*
    Typescript definitions
*/
declare var feature: Mocha.IContextDefinition;
declare var scenario: Mocha.IContextDefinition;
declare var given: Mocha.ITestDefinition;
declare var when: Mocha.ITestDefinition;
declare var then: Mocha.ITestDefinition;
declare var and: Mocha.ITestDefinition;
declare var but: Mocha.ITestDefinition;

declare var background: IBackground;

interface Row {
    [prop: string]: any;
}

interface IBackground {
    (description: string, callback: (this: Mocha.IBeforeAndAfterContext, done: MochaDone) => any): void;
}

class FeatureContext {
    filename: string;
    title: string;
    description: string;
}

class ScenarioContext extends FeatureContext {
    given: StepContext;
}

class StepContext {
    title: string;
    table: Row[];

    docString: string;
    type: string;
    values: string[];

    tableAsEntity: Row;

    tableAsList: string[][];

    tableAsSingleList: string[];

    clone(): StepContext {
        var step = new StepContext();
        step.title = this.title;
        step.table = this.table;
        step.docString = this.docString;
        step.type = this.type;
        step.values = this.values;
        step.tableAsEntity = this.tableAsEntity
        step.tableAsList = this.tableAsList;
        return step;
    }
}

class BackgroundContext extends StepContext {

}

declare var featureContext: FeatureContext;
declare var scenarioContext: ScenarioContext;
declare var stepContext: StepContext;
declare var backgroundContext: BackgroundContext;

/** @internal */
var _mocha = require('mocha'),
    _suite = require('mocha/lib/suite'),
    _test = require('mocha/lib/test');

_mocha.interfaces['livedoc-mocha'] = module.exports = liveDocMocha;

/** @internal */
function liveDocMocha(suite) {
    var suites = [suite];

    suite.on('pre-require', function (context, file, mocha) {

        function liveDocBackground(name, fn) {
            let title = `Background:
                         ${name}`;

            title
            const result = common.before(fn);
            given(title, () => {

            });
            return result;
        }

        var common = require('mocha/lib/interfaces/common')(suites, context, mocha);

        context.run = mocha.options.delay && common.runWithSuite(suite);

        var describeAliasBuilder = createDescribeAlias(file, suites, context, mocha);
        var stepAliasBuilder = createStepAlias(file, suites, mocha);
        //var beforeEachAliasBuilder = createBeforeEachAlias(file, suites, mocha);

        context.after = common.after;
        context.afterEach = common.afterEach;
        context.before = common.before;
        context.beforeEach = common.beforeEach;
        context.background = liveDocBackground;

        context.feature = describeAliasBuilder('Feature');
        context.scenario = describeAliasBuilder('Scenario');
        context.describe = describeAliasBuilder('');

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
        function testType(title, fn?) {
            var suite, test;
            var testName = type ? type + ' ' + title : title;
            suite = suites[0];
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


            // Format the original title for better display output
            testName = formatBlock(testName, 10);

            if (suite.pending) fn = null;
            let fn1 = fn
            if (fn) {
                fn1 = function (...args) {
                    featureContext = suite.ctx.featureContext;
                    stepContext = context;

                    // A Given step is treated differently as its the primary way to setup
                    // state for a Spec, so it gets its own property on the scenarioContext
                    if (scenarioContext && type === "Given") {
                        scenarioContext.given = context.clone();
                    }

                    fn(args)
                }
            }

            test = new _test(testName, fn1);
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

    function getTableAsList(text: string): string[][] {
        let arrayOfLines = text.match(/[^\r\n]+/g);
        let tableArray: string[][] = [];

        if (arrayOfLines.length > 1) {
            for (let i = 1; i < arrayOfLines.length; i++) {
                let line = arrayOfLines[i];
                line = line.trim();
                line
                if (line.startsWith("|") && line.endsWith("|")) {
                    // Looks like part of a table
                    const rowData = line.split("|");
                    let row: string[] = [];
                    for (let i = 1; i < rowData.length - 1; i++) {
                        row.push(rowData[i].trim());
                    }
                    tableArray.push(row);
                }
            }
        }
        return tableArray;
    }

    function getTable(tableArray: string[][]): Row[] {
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

    function getTableAsEntity(tableArray: string[][]): object {

        if (tableArray.length === 0 || tableArray[0].length > 2) {
            return;
        }

        let entity = {};
        for (let row = 0; row < tableArray.length; row++) {
            // Copy column to header key
            entity[tableArray[row][0]] = tableArray[row][1];
        }
        return entity;
    }

    function getTableAsSingleList(tableArray: string[][]): string[] {
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

    function getValuesFromTitle(text: string) {
        let arrayOfValues = text.match(/(["'](.*?)["'])+/g);
        arrayOfValues
        let results = [];
        if (arrayOfValues) {
            arrayOfValues.forEach(element => {
                results.push(element.substr(1, element.length - 2));
            });
        }
        return results;
    }
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
            } else {
                // Scenario
                const context = new ScenarioContext();
                context.title = parts.title;
                context.description = parts.description;
                suite.ctx.scenarioContext = context;
                scenarioContext = context;
                scenarioContext
            }
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
