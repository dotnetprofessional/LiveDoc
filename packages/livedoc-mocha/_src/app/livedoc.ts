var moment = require("moment");
/*
    Typescript definitions
*/

// LiveDoc model
class Feature {
    public id: number;
    public filename: string;
    public background: Background;
    public title: string;
    public displayTitle: string;
    public description: string;
    public scenarios: Scenario[] = [];
    public tags: string[];

    public executionTime: number;

    public parse(type: string, description: string): Feature | Scenario | ScenarioOutline | Background {

        // Parse the description for all the possible parts
        const parser = new Parser();
        parser.parseDescription(description);

        switch (type) {
            case "Feature":
                // This is the top level feature 
                this.title = parser.title;
                this.displayTitle = type ? type + ' ' + this.title : this.title;
                this.description = parser.description;
                this.tags = parser.tags;
                return this;
            case "Scenario":
                const scenario = new Scenario();
                scenario.title = parser.title;
                scenario.displayTitle = type ? type + ' ' + this.title : this.title;
                scenario.description = parser.description;
                scenario.tags = parser.tags;
                this.scenarios.push(scenario);
                return scenario;
            case "Scenario Outline":
                const scenarioOutline = new ScenarioOutline();
                scenarioOutline.title = parser.title;
                scenarioOutline.displayTitle = type ? type + ' ' + this.title : this.title;
                scenarioOutline.description = parser.description;
                scenarioOutline.tags = parser.tags;
                scenarioOutline.parseTables(parser.tables);
                this.scenarios.push(scenarioOutline);
                return scenarioOutline;
            case "Background":
                const background = new Background();
                background.title = parser.title;
                background.displayTitle = type ? type + ' ' + this.title : this.title;
                background.description = parser.description;
                background.tags = parser.tags;
                this.background = background;
                return background;
            default:
                throw TypeError("unknown type: " + type);
        }

    }

    public getFeatureContext(): FeatureContext {
        return ({
            filename: this.filename,
            title: this.title,
            description: this.description,
            tags: this.tags
        });
    }

    public getBackgroundContext(): BackgroundContext {
        const context = this.background.getScenarioContext();
        return ({
            title: context.title,
            description: context.description,
            given: context.given,
            and: context.and,
            tags: context.tags
        });
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
        return this.currentIndex >= 0 && this.currentIndex < this.count;
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

    constructor () {
        this.jsonDateParser = this.jsonDateParser.bind(this);
    }

    public parseDescription(text: string) {
        const textReader = new TextBlockReader(text);
        if (textReader.next()) {
            this.title = textReader.line.trim();

            // quoted values are only found in the title
            this.quotedValues = this.parseQuotedValues(textReader);
        }
        let descriptionIndex = 0;
        const descriptionLines: string[] = [];

        while (textReader.next()) {
            const line = textReader.line.trim();
            if (line.startsWith("@")) {
                this.tags.push(...line.substr(1).split(' '));
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
                if (descriptionIndex < 1) {
                    // find the first non-whitespace character and use that as the split line
                    descriptionIndex = this.getFirstNonBlankIndex(textReader.line);
                }
                // TODO: may want to optimize later
                descriptionLines.push(this.trimStart(textReader.line, descriptionIndex));
            }
        }
        this.description = descriptionLines.join("\n");
    }

    public getTableRowAsEntity(headerRow: DataTableRow, dataRow: DataTableRow): object {
        let entity = {};
        for (let p = 0; p < headerRow.length; p++) {
            // Copy column to header key
            entity[headerRow[p].toString()] = this.coerceValue(dataRow[p]);
        }
        return entity;
    }

    public getTable(tableArray: DataTableRow[]): DataTableRow[] {
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
                row[header[column]] = this.coerceValue(rowData[column]);
            }
            table.push(row);
        }
        return table;
    }


    public coerceValues(values: string[]): any[] {
        const coercedArray = [];
        values.forEach(value => {
            coercedArray.push(this.coerceValue(value));
        });

        return coercedArray;
    }

    public coerceValue(valueString: string): any {
        // Use JSON.parse to do type conversion, if that fails return the original string
        try {
            return JSON.parse(valueString, this.jsonDateParser);
        } catch {
            // Ok so its a string, but it could still be a special one!
            // Try checking if its a date
            const maybeDate = this.getMomentDate(valueString);
            if (maybeDate.isValid()) {
                return maybeDate.toDate();
            }

            return valueString;
        }
    }

    private getMomentDate(value: string) {
        var formats = [
            moment.ISO_8601,
            "MM/DD/YYYY"
        ];
        return moment(value, formats, true);
    }

    private jsonDateParser(key, value) {
        const maybeDate = this.getMomentDate(value);
        if (maybeDate.isValid()) {
            return maybeDate.toDate();
        }
        return value;
    }

    private parseTable(textReader: TextBlockReader): Table {
        var table = new Table();
        table.name = textReader.line.trim().substr("Examples".length);
        while (textReader.next()) {

            if (!textReader.line.trim().startsWith("|")) {
                // Add this line to the description
                table.description += textReader.line + "\n";
            } else {
                break;
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
        let line = textReader.line.trim();
        const dataTable: DataTableRow[] = [];

        while (line && line.startsWith("|")) {
            const rowData = line.split("|");
            let row: any[] = [];
            for (let i = 1; i < rowData.length - 1; i++) {
                const valueString = rowData[i].trim();
                row.push(valueString);
            }
            dataTable.push(row);
            if (textReader.next()) {
                line = textReader.line.trim();
            } else {
                line = null;
            }
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


    private getFirstNonBlankIndex(text: string): number {
        for (let i = 0; i < text.length; i++) {
            if (text.charAt(i) != " ") {
                return i;
            }
        }
        return 0;
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


    public bind(content, model) {
        var regex = new RegExp("<[^>]+>", "g");
        return content.replace(regex, (item, pos, originalText) => {
            return this.applyBinding(item, model);
        });
    }

    private applyBinding(item, model) {
        var key = this.sanitizeName(item.substr(1, item.length - 2));
        if (model.hasOwnProperty(key)) {
            return model[key];
        } else {
            return item;
        }
    }

    public sanitizeName(name: string): string {
        // removing spaces and apostrophes
        return name.replace(/[ `’']/g, "");
    }

}

class Scenario {

    public id: number;
    public title: string;
    public displayTitle: string;
    public description: string;
    public givens: StepDefinition[] = [];
    public whens: StepDefinition[] = [];
    public steps: StepDefinition[] = [];
    public tags: string[];

    public associatedFeatureId: number;
    public executionTime: number;

    private processingGiven: boolean = false;

    public addStep(type: string, description: string): StepDefinition {
        const parser = new Parser();
        parser.parseDescription(description);

        const step = new StepDefinition();

        // This is the top level feature 
        step.title = parser.title;
        step.description = parser.description;
        step.docString = parser.docString;
        step.dataTable = parser.dataTable;
        step.valuesRaw = parser.quotedValues;
        step.values = parser.coerceValues(step.valuesRaw);
        step.type = type;

        this.steps.push(step);

        if (type === "Given") {
            if (this.givens.length != 0) {
                throw TypeError(`The scenario ${this.title} already has a given defined. Scenarios should only have a single given. To extend an existing given, use and or but`);
            }

            this.processingGiven = true;
            this.givens.push(step);
        } else if (["When", "Then"].indexOf(type) >= 0) {
            this.processingGiven = false;
        } else if (this.processingGiven) {
            this.givens.push(step);
        }

        return step;
    }

    public getScenarioContext(): ScenarioContext {
        const givens: StepContext[] = [];
        const and: StepContext[] = [];

        for (let i = 0; i < this.givens.length; i++) {
            const stepContext = this.givens[i].getStepContext();
            givens.push(stepContext);
            if (i > 0) {
                and.push(stepContext);
            }
        }

        const context = new ScenarioContext();
        context.title = this.title;
        context.description = this.description;
        context.given = givens.length != 0 ? givens[0] : undefined;
        context.and = and;
        context.tags = this.tags;
        return context;
    }
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

    public addStep(type: string, description: string): StepDefinition {
        const step = super.addStep(type, description);
        step.title = new Parser().bind(step.title, this.example);

        return step;
    }

    public getScenarioContext(): ScenarioOutlineContext {
        return ({
            title: this.title,
            description: this.description,
            example: this.example,
            given: undefined,
            and: [],
            tags: this.tags
        });
    }
}

class ScenarioOutline extends Scenario {
    public tables: Table[] = [];
    public scenarios: ScenarioOutlineScenario[] = [];

    private _parser = new Parser();

    public parseTables(tables: Table[]) {
        // merge all tables into a single array for processing
        tables.forEach(table => {
            this.parseTable(table);
        });
    }

    public parseTable(table: Table) {
        // merge all tables into a single array for processing
        if (!table.dataTable || table.dataTable.length <= 1) {
            throw TypeError("Data tables must have at least a header row plus a data row.");
        }
        const parser = new Parser();
        const headerRow: string[] = [];
        table.dataTable[0].forEach(item => {
            // copy the header names removing spaces and apostrophes
            headerRow.push(parser.sanitizeName(item));
        });
        for (let i = 1; i < table.dataTable.length; i++) {
            const dataRow = table.dataTable[i];
            const scenario = new ScenarioOutlineScenario();
            scenario.example = this._parser.getTableRowAsEntity(headerRow, dataRow);
            scenario.title = parser.bind(this.title, scenario.example);
            this.scenarios.push(scenario);
        }
    }
}

class StepDefinition {
    id: number;
    title: string = "";
    get displayTitle() {
        return this.type ? this.type + ' ' + this.title : this.title;
    }
    type: string;
    description: string = "";
    docString: string = "";
    dataTable: DataTableRow[] = [];
    values: any[] = [];
    valuesRaw: string[] = [];
    status: string;
    code: string;
    //error: Exception = new Exception();

    associatedScenarioId: number;
    executionTime: number;

    public getStepContext(): StepContext {
        const context = new StepContext();
        context.title = this.title;
        context.dataTable = this.dataTable;
        context.docString = this.docString;
        context.values = this.values;
        context.valuesRaw = this.valuesRaw;

        return context;
    }
}

class Table {
    public name: string = "";
    public description: string = "";
    public dataTable: DataTableRow[] = [];
}

/**
 * Represents a row in a data table as a keyed object
 * 
 * @interface DataTableRow
 */
declare interface DataTableRow {
    [prop: string]: any;
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
    //givens: StepContext[] = [];
    //when: StepContext;
    //whens: StepContext[] = [];
    and: StepContext[] = [];
    tags: string[];
}

class ScenarioOutlineContext extends ScenarioContext {
    public example: DataTableRow;
}

class BackgroundContext extends ScenarioContext {
}

class StepContext {
    private _table: DataTableRow[];
    private _parser = new Parser();

    public title: string;
    public dataTable: DataTableRow[];

    public docString: string;

    public get docStringAsEntity() {
        return JSON.parse(this.docString);
    }

    public type: string;
    public values: any[];
    public valuesRaw: string[];

    public get table() {
        if (!this._table) {
            // crate a table representation of the dataTable
            this._table = this._parser.getTable(this.tableAsList());
        }
        return this._table;
    }

    public get tableAsEntity(): DataTableRow {
        if (this.dataTable.length === 0 || this.dataTable[0].length > 2) {
            return;
        }

        return this.convertDataTableRowToEntity(this.dataTable);
    }

    private convertDataTableRowToEntity(dataTable: DataTableRow): DataTableRow {
        let entity = {};
        for (let row = 0; row < dataTable.length; row++) {
            // Copy column to header key
            entity[dataTable[row][0].toString()] = this._parser.coerceValue(dataTable[row][1]);
        }
        return entity;
    }

    public tableAsList(): DataTableRow[] {
        return this.dataTable;
    }

    public get tableAsSingleList(): any[] {
        if (this.dataTable.length === 0) {
            return;
        }


        let list = [];
        for (let row = 0; row < this.dataTable.length; row++) {
            // Copy column to header key
            list.push(this._parser.coerceValue(this.dataTable[row][0]));
        }
        return list;
    }
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
            // Assign the background to the parent ie Feature so it can be accessed by 
            // the Features scenarios.
            suites[0].parent.livedoc.afterBackground = fn;
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
        function testType(title, stepDefinitionFunction?) {
            var suite, test;

            let stepDefinition: StepDefinition;
            suite = suites[0];
            const livedoc = suite.livedoc;;
            const suiteType = livedoc.type;
            if (suiteType === "Background") {
                stepDefinition = livedoc.feature.background.addStep(type, title);
            } else if (suiteType === "Scenario" || suiteType === "Scenario Outline") {
                stepDefinition = livedoc.scenario.addStep(type, title);
            } else {
                throw new TypeError(`Invalid Gherkin, ${type} can only appear within a Background, Scenario or Scenario Outline.\nFilename: ${livedoc.feature.filename}\nStep Definition: ${type}: ${title}`);
            }

            if (suite.pending) stepDefinitionFunction = null;

            let stepDefinitionContextWrapper = stepDefinitionFunction
            if (stepDefinitionFunction) {
                stepDefinitionContextWrapper = function (...args) {
                    featureContext = suite.livedoc.feature.getFeatureContext();
                    switch (livedoc.type) {
                        case "Background":
                            backgroundContext = livedoc.feature.getBackgroundContext();
                            break;
                        case "Scenario":
                            scenarioContext = livedoc.scenario.getScenarioContext();
                            break;
                        case "Scenario Outline":
                            scenarioOutlineContext = livedoc.scenario.getScenarioContext();
                            break;
                    }

                    // If the type is a background then bundle up the steps but don't execute them
                    // they will be executed prior to each scenario.
                    if (livedoc.type == "Background") {
                        // Record the details necessary to execute the steps later on
                        const stepDetail = { func: stepDefinitionFunction, stepDefinition: stepDefinition };
                        // Have to put on the parent suite as scenarios and backgrounds are at the same level
                        suite.parent.livedoc.backgroundSteps.push(stepDetail);
                    } else {
                        if (suite.livedoc.scenarioId != 1 &&
                            suite.parent.livedoc.backgroundSteps && !suite.livedoc.backgroundStepsComplete) {
                            // set the background context
                            backgroundContext = livedoc.feature.getBackgroundContext();

                            suite.parent.livedoc.backgroundSteps.forEach(stepDetails => {
                                // reset the stepContext for this step
                                stepContext = stepDetails.stepDefinition.getStepContext();
                                stepDetails.func();
                            });
                            // Mark the background as complete for this scenario
                            suite.livedoc.backgroundStepsComplete = true;
                        }
                    }
                    // Must reset stepContext as execution of the background may have changed it
                    stepContext = stepDefinition.getStepContext();

                    return stepDefinitionFunction(args);
                }

                test = new _test(stepDefinition.displayTitle, stepDefinitionContextWrapper);
                test.file = file;
                suite.addTest(test);

                return test;
            }
        }

        (testType as any).skip = function skip(title) {
            testType(title);
        };

        (testType as any).only = function only(title, fn) {
            debugger;
            var test = testType(title, fn);
            mocha.grep(test.fullTitle());
        };

        return testType;
    };

}
var features: Feature[] = [];

/** @internal */
function createDescribeAlias(file, suites, context, mocha) {
    return function wrapperCreator(type) {
        function wrapper(title, fn) {
            let feature: Feature;
            if (type != '') {
                if (type === "Feature") {
                    feature = new Feature();
                    feature.filename = file.replace(/^.*[\\\/]/, '');
                } else {
                    feature = suites[0].livedoc.feature;
                }

                const suiteDefinition = feature.parse(type, title);
                var suite = _suite.create(suites[0], suiteDefinition.displayTitle);
                // initialize the livedoc context
                suite.livedoc = {};
                suite.livedoc.feature = feature
                suite.livedoc.type = type;

                switch (type) {
                    case "Feature":
                        featureContext = feature.getFeatureContext();
                        // Backgrounds need to be executed for each scenario except the first one
                        // this value tags the scenario number
                        suite.livedoc.scenarioCount = 0;

                        break;
                    case "Background":
                        //suite.parent.livedoc.backgroundSuite = { fn, suite };
                        suite.parent.livedoc.backgroundSteps = [];
                        break;
                    case "Scenario":
                        if (suite.parent.livedoc.afterBackground) {
                            // Add the afterBackground function to each scenario's afterAll function
                            suite.afterAll(() => {
                                return suite.parent.livedoc.afterBackground();
                            });
                        }
                        suite.parent.livedoc.scenarioCount += 1;
                        suite.livedoc.scenarioId = suite.parent.livedoc.scenarioCount;
                    case "Scenario Outline":
                        suite.livedoc.scenario = suiteDefinition;
                        break;
                }

                // LEGACY
                if (type === "Scenario Outline") {
                    // Setup the basic context for the scenarioOutline

                    const scenarioOutline = suiteDefinition as ScenarioOutline;
                    //var suite = _suite.create(suites[0], suite.livedoc.scenario.title);
                    for (let i = 0; i < scenarioOutline.scenarios.length; i++) {
                        const currentScenario = scenarioOutline.scenarios[i];
                        context = currentScenario.getScenarioContext();
                        var outlineSuite = _suite.create(suites[0], scenarioOutline.title);
                        outlineSuite.livedoc = {};
                        outlineSuite.livedoc.feature = feature
                        outlineSuite.livedoc.type = type;
                        outlineSuite.livedoc.scenario = currentScenario;
                        outlineSuite.parent.livedoc.scenarioCount += 1;
                        outlineSuite.livedoc.scenarioId = outlineSuite.parent.livedoc.scenarioCount;
                        suites.unshift(outlineSuite);

                        if (suite.parent.livedoc.afterBackground) {
                            outlineSuite.afterAll(() => {
                                return suite.parent.livedoc.afterBackground();
                            });
                        };
                        fn.call(outlineSuite);
                        suites.shift();
                    }

                    return outlineSuite;

                }

                if (type === "Scenario" &&
                    suite.parent.ctx.backgroundSuite && suite.parent.ctx.backgroundSuite.afterBackground) {
                    // Add the afterBackground function to each scenario's afterAll function
                    suite.afterAll(() => {
                        return suite.parent.ctx.backgroundSuite.afterBackground();
                    });
                }

            }

            suites.unshift(suite);
            const funcResult = fn.call(suite);
            if (funcResult && funcResult["then"]) {
                debugger;
                throw new TypeError(`${suite.livedoc.type} does not support Async operations. You can only use async operations with step definitions`);
            }

            suites.shift();
            return suite;
        }

        (wrapper as any).skip = function skip(title, fn) {
            const contextDefinition = new Feature().parse(type, title);

            var suite = _suite.create(suites[0], contextDefinition.title);

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
}
