/*
    Typescript definitions
*/

// LiveDoc model
class Feature {
    public id: number;
    public filename: string;
    public background: Background;
    public title: string;
    public description: string;
    public scenarios: Scenario[] = [];
    public tags: string[];

    public executionTime: number;

    public parse(type: string, description: string) {

        // Parse the description for all the possible parts
        const parser = new Parser();
        parser.parseDescription(description);

        switch (type) {
            case "Feature":
                // This is the top level feature 
                this.title = parser.title;
                this.description = parser.description;
                this.tags = parser.tags;
                break;
            case "Scenario":
                const scenario = new Scenario();
                scenario.title = parser.title;
                scenario.description = parser.description;
                scenario.tags = parser.tags;
                this.scenarios.push(scenario);
                break;
            case "ScenarioOutline":
                const scenarioOutline = new ScenarioOutline();
                scenarioOutline.title = parser.title;
                scenarioOutline.description = parser.description;
                scenarioOutline.tags = parser.tags;
                scenarioOutline.parseTables(parser.tables);
                this.scenarios.push(scenarioOutline);
                break;
            case "Background":
                const background = new Background();
                background.title = parser.title;
                background.description = parser.description;
                background.tags = parser.tags;
                this.background = background;
                break;
            default:
                throw TypeError("unknown type: " + type);
        }
    }
}

class TextBlockReader {
    private arrayOfLines: string[];
    private currentIndex: number = -1;

    constructor (text: string) {
        // Split text into lines for processing
        this.arrayOfLines = text.split(/\r?\n/);
    }

    public get count() {
        return this.arrayOfLines.length;
    }

    public get line(): string {
        if (this.currentIndex < this.count) {
            return this.arrayOfLines[this.currentIndex];
        } else {
            return null;
        }
    }

    public next(): boolean {
        this.currentIndex++;
        return this.currentIndex >= this.count;
    }

    public reset(): void {
        this.currentIndex = -1;
    }
}


class Parser {
    public title: string = "";
    public description: string = "";
    public tags: string[] = [];
    public tables: Table[] = [];
    public dataTable: DataTableRow[];
    public docString: string = "";
    public quotedValues: string[];

    public parseDescription(text: string) {
        const textReader = new TextBlockReader(text);

        if (textReader.next()) {
            this.title = textReader.line.trim();

            // quoted values are only found in the title
            this.quotedValues = this.parseQuotedValues(textReader);
        }
        let descriptionIndex = 0;
        while (textReader.next()) {
            const line = textReader.line.trim();
            if (line.startsWith("@")) {
                this.tags.push(...textReader.line.substr(1).split(' '));
            } else if (line.toLocaleLowerCase().startsWith("examples")) {
                // scenario outline table
                this.tables.push(this.parseTable(textReader));
            } else if (line.startsWith("|") && line.endsWith("|")) {
                // given/when/then data table
                this.dataTable = this.parseDataTable(textReader)
            } else if (line.startsWith('"""')) {
                this.docString = this.parseDocString(textReader);
            } else {
                // Add the rest to the description
                if (descriptionIndex === 0) {
                    // find the first non-whitespace character and use that as the split line
                    descriptionIndex = textReader.line.indexOf(' ');
                }
                // TODO: may want to optimize later
                this.description += this.trimStart(textReader.line, descriptionIndex) + "\n";
            }
        }
    }

    private parseTable(textReader: TextBlockReader): Table {
        var table = new Table();
        table.name = textReader.line.trim().substr("Examples".length);
        while (textReader.next()) {

            if (!textReader.line.trim().startsWith("|")) {
                // Add this line to the description
                table.description += textReader.line + "\n";
            }
        }

        // Check we didn't exhaust the text block
        if (textReader.line != null) {
            // Ok must have found the data table
            const dataTable = this.parseDataTable(textReader);
            table.dataTable = dataTable;
        }
        return table;
    }

    private parseDataTable(textReader: TextBlockReader): DataTableRow[] {
        // Looks like part of a table
        const line = textReader.line.trim();
        const dataTable: DataTableRow[] = [];

        while (line.startsWith("|")) {
            const rowData = line.split("|");
            let row: any[] = [];
            for (let i = 1; i < rowData.length - 1; i++) {
                // Convert the values to the best primitive type
                const valueString = rowData[i].trim();
                row.push(valueString);
            }
            dataTable.push(row);
        }
        return dataTable;
    }

    private parseDocString(textReader: TextBlockReader): string {
        let docLines = [];
        const docStringStartIndex = textReader.line.indexOf('"');
        while (textReader.next()) {
            const trimmedLine = textReader.line.trim();
            if (trimmedLine.startsWith('"""')) {
                // end of the docString so can stop processing
                break;
            }
            docLines.push(this.trimStart(textReader.line, docStringStartIndex));
        }
        return docLines.join('\n');
    }

    private parseQuotedValues(textReader: TextBlockReader): string[] {
        let arrayOfValues = textReader.line.match(/(["'](.*?)["'])+/g);
        let results = [];
        if (arrayOfValues) {
            arrayOfValues.forEach(element => {
                const valueString = element.substr(1, element.length - 2).trim();
                results.push(valueString);
            });
        }
        return results;
    }


    private trimStart(text: string, index: number) {
        if (index < text.length) {
            return text.substr(index);
        }
        else {
            return text;
        }
    }
    public applyIndenting(text: string, spacing: number) {
        // This code needs to handle already indented lines

        // Split text into lines for processing
        let arrayOfLines = text.split(/\r?\n/);
        if (arrayOfLines.length > 1) {
            for (let i = 1; i < arrayOfLines.length; i++) {
                let line = arrayOfLines[i].trim();
                // Apply indentation
                arrayOfLines[i] = " ".repeat(spacing) + line;
            }
            return arrayOfLines.join("\n");
        }
    }

}

class Scenario {

    public id: number;
    public title: string;
    public description: string;
    public steps: StepDefinition[] = [];
    public tags: string[];

    public associatedFeatureId: number;
    public executionTime: number;

}

class Background extends Scenario {
}

/**
 * The computed scenario from a ScenarioOutline definition
 * This differs from a standard scenario as it includes an example
 * 
 * @class ScenarioOutlineScenario
 * @extends {Scenario}
 */
class ScenarioOutlineScenario extends Scenario {
    public example: DataTableRow;
}

class ScenarioOutline extends Scenario {
    public tables: Table[] = [];
    public scenarios: Scenario[];

    public parseTables(tables: Table[]) {
        // merge all tables into a single array for processing
        const mergedTables: Table[] = [].concat(tables);
        mergedTables.forEach(table => {
            table.dataTable.forEach(dataRow => {
                const scenario = new ScenarioOutlineScenario();
                scenario.example = dataRow;
                scenario.title = this.bind(this.title, dataRow);
            });
        });
    }

    private bind(content, model) {
        var regex = new RegExp("<[\\w\\d]+>", "g");
        return content.replace(regex, (item, pos, originalText) => {
            return this.applyBinding(item, model);
        });
    }

    private applyBinding(item, model) {
        var key = item.replace("<", "").replace(">", "");
        if (model.hasOwnProperty(key))
            return model[key];
        else {
            return item;
        }
    }
}

class example {
    name: string;
    rows: DataTableRow[];
}

class StepDefinition {
    id: number;
    title: string;
    type: string;
    docString: string;
    table: DataTableRow[];
    status: string;
    code: string;
    //error: Exception = new Exception();

    associatedScenarioId: number;
    executionTime: number;
}

class Table {
    public name: string = "";
    public description: string = "";
    public dataTable: DataTableRow[] = [];
}

declare interface DataTableRow {
    [prop: string]: any;
}

declare interface String {
    startsWith(searchString: string, position?: number);
    endsWith(searchString: string, position?: number);
    repeat(times: number);
}
class FeatureContext {
    filename: string;
    title: string;
    description: string;
    tags: string[];
}

class ScenarioContext {
    title: string;
    description: string;
    given: StepContext;
    and: StepContext[] = [];
    tags: string[];
}


class ScenarioOutlineContext extends ScenarioContext {
    example: DataTableRow;
}

class BackgroundContext extends ScenarioContext {
}

class StepContext {
    title: string;
    table: DataTableRow[];

    docString: string;

    get docStringAsEntity() {
        return JSON.parse(this.docString);
    }

    type: string;
    values: any[];

    tableAsEntity: DataTableRow;

    tableAsList: any[][];

    tableAsSingleList: any[];
}

declare var feature: Mocha.IContextDefinition;
declare var background: Mocha.IContextDefinition;
declare var scenario: Mocha.IContextDefinition;
declare var scenarioOutline: Mocha.IContextDefinition;
declare var given: Mocha.ITestDefinition;
declare var when: Mocha.ITestDefinition;
declare var then: Mocha.ITestDefinition;
declare var and: Mocha.ITestDefinition;
declare var but: Mocha.ITestDefinition;

declare var featureContext: FeatureContext;
declare var scenarioContext: ScenarioContext;
declare var stepContext: StepContext;
declare var backgroundContext: BackgroundContext;
declare var scenarioOutlineContext: ScenarioOutlineContext;

declare var afterBackground: (fn) => void;

declare interface String {
    startsWith(searchString: string, position?: number);
    endsWith(searchString: string, position?: number);
    repeat(times: number);
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
        context.afterBackground = function (fn) {
            suites[0].afterBackground = fn;
        };

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
        async function testType(title, stepDefinitionFunction?) {
            var suite, test;
            var testName = type ? type + ' ' + title : title;
            suite = suites[0];

            let context = getStepContext(title);

            // Format the original title for better display output
            testName = formatBlock(testName, 10);

            if (suite.pending) stepDefinitionFunction = null;

            let stepDefinitionContextWrapper = stepDefinitionFunction
            if (stepDefinitionFunction) {
                stepDefinitionContextWrapper = async function (...args) {
                    featureContext = suite.ctx.featureContext;
                    scenarioContext = suite.ctx.scenarioContext;
                    scenarioOutlineContext = suite.ctx.scenarioOutlineContext;

                    if (suite.parent.ctx.backgroundSuite) {
                        backgroundContext = suite.parent.ctx.backgroundSuite.ctx.backgroundContext;
                    }

                    if (suite.ctx.type == "Background") {
                        // Record the details necessary to execute the steps later on
                        const stepDetail = { func: stepDefinitionFunction, context: context };
                        suite.ctx.backgroundFunc.push(stepDetail);
                    } else {
                        // Check if a background has been defined, and if so only execute it once per scenario
                        if (suite.parent.ctx.backgroundSuite && !suite.ctx.backgroundFunExec) {
                            // Skip the first scenario as its already been executed
                            if (suite.parent.ctx.backgroundSuite.ctx.backgroundFunExecCount !== 1) {
                                backgroundContext = suite.parent.ctx.backgroundSuite.ctx.backgroundContext;
                                // execute all functions of the background
                                suite.parent.ctx.backgroundSuite.ctx.backgroundFunc.forEach(stepDetails => {
                                    // reset the stepContext for this step
                                    stepContext = stepDetails.context;
                                    stepDetails.func();
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
                        scenarioOutlineContext.example = this.test.example;
                        if (type === "Given") {
                            suite.ctx.processingGiven = true;
                            scenarioOutlineContext.given = context;
                        } else if (["When", "Then"].indexOf(type) >= 0) {
                            suite.ctx.processingGiven = false;
                        } else if (suite.ctx.processingGiven) {
                            scenarioOutlineContext.and.push(context);
                        }
                    }

                    stepContext = context;
                    const funcResult = stepDefinitionFunction(args);
                    if (funcResult && funcResult["then"]) {
                        await funcResult;
                    }
                }
            }
            if (suite.ctx.scenarioOutlineContext && suite.ctx.type === "Scenario Outline") {
                // Scenario Outlines also require that their titles be data bound
                testName = bind(testName, suite.ctx.scenarioOutlineContext.example);
                context.title = testName;
            }

            test = new _test(testName, stepDefinitionContextWrapper);
            test.file = file;
            if (suite.ctx.scenarioOutlineContext && suite.ctx.type === "Scenario Outline") {
                // Scenario Outlines also require that their titles be data bound
                test.example = suite.ctx.scenarioOutlineContext.example;
            }
            suite.addTest(test);

            return test;
        }

        (testType as any).skip = function skip(title) {
            testType(title);
        };

        (testType as any).only = function only(title, fn) {
            var test = testType(title, fn);
            if (test && test["then"]) {
                test.then((test) => {
                    mocha.grep(test.fullTitle());
                });
            }
        };

        return testType;
    };

}

/** @internal */
function createDescribeAlias(file, suites, context, mocha) {
    return function wrapperCreator(type) {
        function createLabel(title) {
            debugger;
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
        async function wrapper(title, fn) {
            var suite = _suite.create(suites[0], createLabel(title));

            suite.file = file;
            const parts = getDescribeParts(title);
            if (type === "Feature") {
                const context = new FeatureContext();
                context.title = parts.title;
                context.description = parts.description;
                context.tags = parts.tags;
                context.filename = file.replace(/^.*[\\\/]/, '');
                suite.ctx.featureContext = context;
                featureContext = context;
            } else if (type === "Background") {
                const context = new BackgroundContext();
                context.title = parts.title;
                context.description = parts.description;
                suite.ctx.backgroundContext = context;
                context.tags = parts.tags;
                backgroundContext = context;
                // Need to put the context on the parent or it won't be available
                // to the scenarios
                suite.ctx.backgroundContext = backgroundContext;
                suite.ctx.backgroundFunc = [];
                suite.ctx.backgroundFunExecCount = 1;

                // Make this suite available via the parent
                suite.parent.ctx.backgroundSuite = suite;
            } else if (type === "Scenario Outline") {
                // Setup the basic context for the scenarioOutline
                const context = new ScenarioOutlineContext();
                context.title = parts.title;
                context.description = parts.description;
                context.tags = parts.tags;

                // Extract the Examples:
                const table = getTableAsList(title);

                for (let i = 1; i < table.length; i++) {
                    var outlineSuite = _suite.create(suites[0], createLabel(context.title));
                    context.example = getTableRowAsEntity(table, i);
                    outlineSuite.ctx.scenarioOutlineContext = context;
                    suite.ctx.type = type;
                    outlineSuite.ctx.type = type;
                    suites.unshift(outlineSuite);
                    if (suite.parent.ctx.backgroundSuite && suite.parent.ctx.backgroundSuite.afterBackground) {
                        outlineSuite.afterAll(async () => {
                            const funcResult = outlineSuite.parent.ctx.backgroundSuite.afterBackground();
                            if (funcResult && funcResult["then"]) {
                                await funcResult;
                            }
                        });
                    }


                    const funcResult = fn.call(outlineSuite);
                    if (funcResult && funcResult["then"]) {
                        await funcResult;
                    }
                    suites.shift();
                }

                return outlineSuite;

            } else {
                // Scenario
                const context = new ScenarioContext();
                context.title = parts.title;
                context.description = parts.description;
                context.tags = parts.tags;
                suite.ctx.scenarioContext = context;
                scenarioContext = context;
            }
            suite.ctx.type = type;
            suites.unshift(suite);

            if (type === "Scenario" &&
                suite.parent.ctx.backgroundSuite && suite.parent.ctx.backgroundSuite.afterBackground) {
                // Add the afterBackground function to each scenario's afterAll function
                suite.afterAll(async () => {
                    const funcResult = suite.parent.ctx.backgroundSuite.afterBackground();
                    if (funcResult && funcResult["then"]) {
                        await funcResult;
                    }
                });
            }

            const funcResult = fn.call(suite);
            if (funcResult && funcResult["then"]) {
                await funcResult;
            }

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
            if (suite && suite["then"]) {
                suite.then((suite) => {
                    mocha.grep(suite.fullTitle());
                });
            }
        };

        return wrapper;
    };

    function getDescribeParts(text: string) {
        let arrayOfLines = text.match(/[^\r\n]+/g);
        let description = "";
        let title = "";
        let tags: string[] = [];

        if (arrayOfLines.length > 0) {
            for (let i = 0; i < arrayOfLines.length; i++) {
                let line = arrayOfLines[i];
                if (line.startsWith(" ")) {
                    arrayOfLines[i] = line.trim();
                }

                // Look for tags
                if (arrayOfLines[i].startsWith("@")) {
                    tags.push(...arrayOfLines[i].substr(1).split(' '));
                    // remove tags from description
                    arrayOfLines.splice(i, 1);
                    // As the array lost an element need to reprocess this index
                    i--;
                }
            }

            title = arrayOfLines[0];
            arrayOfLines.shift();
            description = arrayOfLines.join("\n");
        }

        let result = {
            title,
            description,
            tags
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
            let line = arrayOfLines[i].trim();
            // Skip tags
            if (line.startsWith("@")) {
                arrayOfLines.splice(i, 1);
                i--;
            } else {
                // Apply indentation
                arrayOfLines[i] = " ".repeat(indent) + line;
            }

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
                    row.push(coerceValue(valueString));
                }
                tableArray.push(row);
            }
        }
    }
    return tableArray;
}

function coerceValue(valueString: string): any {
    const value = +valueString;
    if (value) {
        return value;
    } else {
        // check if its a boolean
        const literals = ["true", true, "false", false];
        const index = literals.indexOf(valueString);
        if (index >= 0) {
            return literals[index + 1];
        } else {
            // Check if its an array
            if (valueString.startsWith("[") && valueString.endsWith("]")) {
                const array = JSON.parse(valueString);
                return array;
            } else {
                return valueString;
            }
        }
    }
}

/** @internal */
function getTable(tableArray: any[][]): DataTableRow[] {
    let table: DataTableRow[] = [];

    if (tableArray.length === 0) {
        return table;
    }

    let header = tableArray[0];
    for (let i = 1; i < tableArray.length; i++) {
        let rowData = tableArray[i];
        let row: DataTableRow = {};
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
                for (i = i + 1; i < arrayOfLines.length; i++) {
                    if (arrayOfLines[i].startsWith('"""')) {
                        // end of docString
                        break;
                    }
                    docLines.push(arrayOfLines[i]);
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
            results.push(coerceValue(valueString));
        });
    }
    return results;
}
