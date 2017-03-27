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
}

class StepContext {
    title: string;
    table: Row[];
    docString: string;
    type: string;
    values: string[];
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
            const table = getTable(title);
            context.title = parts.title;
            context.docString = parts.docString;
            context.values = parts.values;
            context.table = table;

            // Format the original title for better display output
            testName = formatBlock(testName, 10);

            if (suite.pending) fn = null;
            let fn1 = fn
            if (fn) {
                fn1 = function (...args) {
                    featureContext = suite.ctx.featureContext;
                    stepContext = context;
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

    function getTable(text: string): Row[] {
        let arrayOfLines = text.match(/[^\r\n]+/g);
        let table: Row[] = [];

        if (arrayOfLines.length > 1) {
            let header = [];
            for (let i = 1; i < arrayOfLines.length; i++) {
                let line = arrayOfLines[i];
                if (line.startsWith(" ")) {
                    line = line.trim();
                }
                if (line.startsWith("|") && line.endsWith("|")) {
                    // Looks like part of a table
                    // Check if this is the first line of the table
                    if (header.length === 0) {
                        // First line is the header
                        header = line.split("|");
                    } else {
                        const rowData = line.split("|");
                        let row: Row = {};
                        for (let column = 1; column < rowData.length - 1; column++) {
                            // Copy column to header key
                            row[header[column].trim()] = rowData[column].trim();
                        }
                        table.push(row);
                    }
                }
            }
        }
        return table;
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
                    docLines
                    docString = docLines.join('\n');
                    docString
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
            const context = new FeatureContext();
            const parts = getDescribeParts(title);
            context.title = parts.title;
            context.description = parts.description;
            context.filename = file.replace(/^.*[\\\/]/, '');
            suite.ctx.featureContext = context;
            featureContext = context;
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
        arrayOfLines.push("");
        return arrayOfLines.join("\n");
    } else {
        return text;
    }
}
