var moment = require("moment");
var colors = require('colors');

//region rules
enum LiveDocRuleOption {
    enabled,
    disabled,
    warning
}

class LiveDocRules {
    /**
     * Is triggered when a scenario, scenarioOutline or background is used without a feature
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public missingFeature: LiveDocRuleOption; //done

    /**
     * Is triggered if a given, when or then is not a child of a sceanrio, scenarioOutline or background 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public givenWhenThenMustBeWithinScenario: LiveDocRuleOption; //done

    /**
     * Is triggered when more than 1 given, when or then is used within a single sceanrio, scenarioOutline or background
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public singleGivenWhenThen: LiveDocRuleOption; //done

    /**
     * Is triggered if no given is part of the test 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustIncludeGiven: LiveDocRuleOption; //done

    /**
     * Is triggered if no when is part of the test 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustIncludeWhen: LiveDocRuleOption; //done

    /**
     * Is triggered if no then is part of the test 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustIncludeThen: LiveDocRuleOption; // not sure how to implement

    /**
     * Is triggered when an and or but doesn't also include a given, when or then
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public andButMustHaveGivenWhenThen: LiveDocRuleOption; //done

    /**
     * Is triggered when the Gherkin language is mixed withe mocha's BDD language
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustNotMixLanguages: LiveDocRuleOption; //done

    /**
     * Is triggered if a background uses when or then
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public backgroundMustOnlyIncludeGiven: LiveDocRuleOption;

    /**
     * Using the before hook has the same affect as the given step definition but with the ability to convey meaning.
     * It is therefore encouraged to use a given over the before hook.
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public enforceUsingGivenOverBefore: LiveDocRuleOption;

    /**
     * Ensures that a title is specified for keywords that require it
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public enforceTitle: LiveDocRuleOption;

}

class CommandLineOptions {
    public include: string[] = [];
    public exclude: string[] = [];
    public showFilterConflicts: boolean = false;
}

class LiveDoc {
    constructor() {
        this.defaultRecommendations();
    }

    public rules: LiveDocRules = new LiveDocRules();
    public options: CommandLineOptions = new CommandLineOptions();

    public shouldMarkAsPending(tags: string[]): boolean {
        return this.markedAsExcluded(tags) && (!this.markedAsIncluded(tags) || this.options.showFilterConflicts);
    }

    public shouldInclude(tags: string[]): boolean {
        return this.markedAsIncluded(tags) && (!this.markedAsExcluded(tags) || this.options.showFilterConflicts);
    }

    public markedAsExcluded(tags: string[]): boolean {
        // exclusions
        for (let i = 0; i < this.options.exclude.length; i++) {
            if (tags.indexOf(this.options.exclude[i]) > -1) {
                // found a match so return true
                return true;
            }
        }

        return false;
    }

    public markedAsIncluded(tags: string[]): boolean {
        // exclusions
        for (let i = 0; i < this.options.include.length; i++) {
            if (tags.indexOf(this.options.include[i]) > -1) {
                // found a match so return true
                return true;
            }
        }

        return false;
    }
    /**
     * Sets the minimal set of rules to ensure tests are structured correctly
     * 
     * @memberof LiveDoc
     */
    public enforceMinimalRulesOnly() {
        this.setAllRulesTo(LiveDocRuleOption.disabled);
        const option = LiveDocRuleOption.enabled;

        this.rules.missingFeature = option;
        this.rules.givenWhenThenMustBeWithinScenario = option;
        this.rules.mustNotMixLanguages = option;
        this.rules.backgroundMustOnlyIncludeGiven = option;
        this.rules.enforceUsingGivenOverBefore = option;
        this.rules.enforceTitle = option;
    }

    /**
     * Sets the recommended set of rules to ensure best practices
     * 
     * @memberof LiveDoc
     */
    public defaultRecommendations() {
        this.enforceMinimalRulesOnly();

        const option = LiveDocRuleOption.enabled;

        this.rules.singleGivenWhenThen = option;
        this.rules.mustIncludeGiven = LiveDocRuleOption.warning;
        this.rules.mustIncludeWhen = LiveDocRuleOption.warning;
        this.rules.mustIncludeThen = LiveDocRuleOption.warning;
        this.rules.andButMustHaveGivenWhenThen = option;
    }

    /**
     * Sets all rules to warnings
     * 
     * @memberof LiveDoc
     */
    public setAllRulesAsWarnings() {
        this.setAllRulesTo(LiveDocRuleOption.warning);
    }

    private setAllRulesTo(option: LiveDocRuleOption) {
        this.rules.missingFeature = option;
        this.rules.givenWhenThenMustBeWithinScenario = option;
        this.rules.singleGivenWhenThen = option;
        this.rules.mustIncludeGiven = option;
        this.rules.mustIncludeWhen = option;
        this.rules.mustIncludeThen = option;
        this.rules.andButMustHaveGivenWhenThen = option;
        this.rules.mustNotMixLanguages = option;
        this.rules.backgroundMustOnlyIncludeGiven = option;
        this.rules.enforceUsingGivenOverBefore = option;
        this.rules.enforceTitle = option;
    }
}

class LiveDocRuleViolation extends Error {
    public errorId: number;
    static errorCount: number = 0;
    private dontShowAgain: boolean;

    constructor(message: string, public option: LiveDocRuleOption, public title: string, public file: string) {
        super(message);
        this.file = file.replace(/^.*[\\\/]/, '');
    }

    public report(dontShowAgain: boolean = false) {
        if (this.dontShowAgain) {
            return;
        }

        this.dontShowAgain = dontShowAgain;

        if (this.option === LiveDocRuleOption.disabled) {
            return;
        }
        if (!this.errorId) {
            LiveDocRuleViolation.errorCount++;
            this.errorId = LiveDocRuleViolation.errorCount;
        }
        const outputMessage = `${this.message} [title: ${this.title}, file: ${this.file}]`;
        if (this.option === LiveDocRuleOption.warning) {
            console.error(colors.bgYellow(colors.red(`WARNING[${this.errorId}]: ${outputMessage}`)));
        } else {
            throw new LiveDocRuleViolation(outputMessage, LiveDocRuleOption.enabled, "", "");
        }
    }
}

//endregion 

//region Globals
declare var feature: Mocha.IContextDefinition;
declare var background: Mocha.IContextDefinition;
declare var scenario: Mocha.IContextDefinition;
declare var scenarioOutline: Mocha.IContextDefinition;
declare var given: Mocha.ITestDefinition;
declare var when: Mocha.ITestDefinition;
declare var then: Mocha.ITestDefinition;
declare var and: Mocha.ITestDefinition;
declare var but: Mocha.ITestDefinition;

declare var afterBackground: (fn) => void;

declare var featureContext: FeatureContext;
declare var scenarioContext: ScenarioContext;
declare var stepContext: StepContext;
declare var backgroundContext: BackgroundContext;
declare var scenarioOutlineContext: ScenarioOutlineContext;

declare var livedoc: LiveDoc
declare var liveDocRuleOption;

function resetGlobalVariables() {
    // initialize context variables
    featureContext = undefined;
    scenarioContext = undefined;
    stepContext = undefined;
    backgroundContext = undefined;
    scenarioOutlineContext = undefined;
}

livedoc = new LiveDoc();
liveDocRuleOption = LiveDocRuleOption;

// rest variables
resetGlobalVariables();

/**
 * Represents a row in a data table as a keyed object
 * 
 * @interface DataTableRow
 */
declare interface DataTableRow {
    [prop: string]: any;
}

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

//endregion

//region model
class LiveDocDescribe {
    protected _parser = new Parser();
    public id: number;
    public title: string;
    public rawDescription: string;
    public get displayTitle(): string {
        return `${this.displayPrefix}: ${this._parser.applyIndenting(this.rawDescription, this.displayIndentLength)}`;
    }
    public tags: string[];
    public description: string;

    public displayPrefix: string = "";
    public displayIndentLength: number = 0;

    public ruleViolations: LiveDocRuleViolation[] = [];

    public addViolation(violation: LiveDocRuleViolation): LiveDocRuleViolation {
        this.ruleViolations.push(violation);
        return violation;
    }
}

// LiveDoc model
class Feature extends LiveDocDescribe {
    public filename: string;
    public background: Background;
    public scenarios: Scenario[] = [];

    public executionTime: number;

    constructor() {
        super()
        this.displayPrefix = "Feature";
        this.displayIndentLength = 4;
    }

    public parse(type: string, description: string): LiveDocDescribe {

        // Parse the description for all the possible parts
        const parser = new Parser();
        parser.parseDescription(description);

        // validate we have a description!
        if (!parser.title && type !== "Background") {
            this.addViolation(new LiveDocRuleViolation(`${type} seems to be missing a title. Titles are important to convey the meaning of the test.`, livedoc.rules.enforceTitle, parser.title, this.filename))
                .report();
        }
        switch (type) {
            case "Feature":
                // This is the top level feature 
                this.title = parser.title;
                this.description = parser.description;
                this.tags = parser.tags;
                this.rawDescription = description;
                return this;
            case "Scenario":
                const scenario = new Scenario(this);
                scenario.title = parser.title;
                scenario.description = parser.description;
                scenario.tags = parser.tags;
                scenario.rawDescription = description;
                this.scenarios.push(scenario);
                return scenario;
            case "Scenario Outline":
                const scenarioOutline = new ScenarioOutline(this);
                scenarioOutline.title = parser.title;
                scenarioOutline.description = parser.description;
                scenarioOutline.tags = parser.tags;
                scenarioOutline.parseTables(parser.tables);
                scenarioOutline.rawDescription = description;

                this.scenarios.push(scenarioOutline);
                return scenarioOutline;
            case "Background":
                const background = new Background(this);
                background.title = parser.title;
                background.description = parser.description;
                background.tags = parser.tags;
                background.rawDescription = description;
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

    constructor(text: string) {
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

    constructor() {
        this.jsonDateParser = this.jsonDateParser.bind(this);
    }

    public parseDescription(text: string) {
        const textReader = new TextBlockReader(text);
        if (textReader.next()) {
            this.title = textReader.line.trim();

            // quoted values are only found in the title
            this.quotedValues = this.parseQuotedValues(textReader);
        }
        let descriptionIndex = -1;
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
                if (descriptionIndex < 0) {
                    // find the first non-whitespace character and use that as the split line
                    descriptionIndex = this.getFirstNonBlankIndex(textReader.line);
                }
                // TODO: may want to optimize later
                descriptionLines.push(this.trimStart(textReader.line, descriptionIndex));
            }
        }
        this.description = descriptionLines.join("\n");
    }

    public getTableRowAsEntity(headerRow: DataTableRow, dataRow: DataTableRow, shouldCoerce: boolean = true): object {
        let entity = {};
        for (let p = 0; p < headerRow.length; p++) {
            // Copy column to header key
            entity[headerRow[p].toString()] = shouldCoerce ? this.coerceValue(dataRow[p]) : dataRow[p];
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
        } catch (e) {
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

    private isCommentedLine(line: string) {
        return line.startsWith("#") || line.startsWith("//");
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

        while (line && line.startsWith("|") || this.isCommentedLine(line)) {
            // check if this is a line that has been commented
            if (!this.isCommentedLine(line)) {
                const rowData = line.split("|");
                let row: any[] = [];
                for (let i = 1; i < rowData.length - 1; i++) {
                    const valueString = rowData[i].trim();
                    row.push(valueString);
                }
                dataTable.push(row);
            }

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
        return -1;
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
        const textReader = new TextBlockReader(text);

        // The first line is the title so ignore indenting for that
        let title = "";
        if (textReader.next()) {
            title = textReader.line;
        }
        // Now attempt to read the rest of the body if there is one and formatted based on the
        // indenting of the first line
        let textLines = [];
        textLines.push(title);
        let textIndentingStartIndex = -1;
        while (textReader.next()) {
            if (textIndentingStartIndex < 0) {
                textIndentingStartIndex = this.getFirstNonBlankIndex(textReader.line);
            }
            textLines.push(" ".repeat(spacing) + this.trimStart(textReader.line, textIndentingStartIndex));
        }

        return textLines.join('\n');
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

class Scenario extends LiveDocDescribe {

    public givens: StepDefinition[] = [];
    public whens: StepDefinition[] = [];
    public steps: StepDefinition[] = [];

    public associatedFeatureId: number;
    public executionTime: number;

    // Used for validations and grouping
    private hasGiven: boolean = false;
    private hasWhen: boolean = false;
    private hasThen: boolean = false;
    private processingStepType: string;

    constructor(public parent: Feature) {
        super()
        this.displayPrefix = "Scenario";
        this.displayIndentLength = 6;
    }

    public addStep(type: string, description: string): StepDefinition {
        const parser = new Parser();
        parser.parseDescription(description);

        const step = new StepDefinition();

        // validate we have a description!
        if (!parser.title && type !== "Background") {
            step.addViolation(new LiveDocRuleViolation(`${type} seems to be missing a title. Titles are important to convey the meaning of the test.`, livedoc.rules.enforceTitle, parser.title, this.parent.filename))
                .report();
        }

        // This is the top level feature
        step.title = parser.title;
        step.rawDescription = description;
        step.description = parser.description;
        step.docString = parser.docString;
        step.dataTable = parser.dataTable;
        step.valuesRaw = parser.quotedValues;
        step.values = parser.coerceValues(step.valuesRaw);
        step.type = type;

        this.steps.push(step);

        const oneGivenWhenThenViolation = new LiveDocRuleViolation(`there should be only one ${type} in a Scenario, Scenario Outline or Background. Try using and or but instead.`, livedoc.rules.singleGivenWhenThen, this.title, this.parent.filename);

        switch (type) {
            case "Given":
                // Check rules
                if (this.hasGiven) {
                    // Too many givens
                    step.addViolation(oneGivenWhenThenViolation)
                        .report();
                }
                this.processingStepType = type;
                this.hasGiven = true;
                this.givens.push(step);
                break;
            case "When":
                // Validate that we have a given here or from a Background
                if (!this.hasGiven || (this.parent.background && !this.parent.background.hasGiven)) {
                    step.addViolation(new LiveDocRuleViolation(`scenario does not have a Given or a Background with a given.`, livedoc.rules.mustIncludeGiven, this.title, this.parent.filename))
                        .report();
                }
                if (this.hasWhen) {
                    // Too many givens
                    step.addViolation(oneGivenWhenThenViolation)
                        .report();
                }
                this.processingStepType = type;
                this.hasWhen = true;
                this.whens.push(step);
                break;
            case "Then":
                if (!this.hasWhen) {
                    step.addViolation(new LiveDocRuleViolation(`scenario does not have a When, use When to describe the test action.`, livedoc.rules.mustIncludeWhen, this.title, this.parent.filename))
                        .report();
                }
                if (this.hasThen) {
                    // Too many givens
                    step.addViolation(oneGivenWhenThenViolation)
                        .report();
                }
                this.processingStepType = type;
                this.hasThen = true;
                break;
            case "and":
            case "but":
                // add the continuation of the main step to their collections    
                switch (this.processingStepType) {
                    case "Given":
                        this.givens.push(step);
                        break;
                    case "When":
                        this.whens.push(step);
                        break;
                    case "Then":
                        break;
                    default:
                        // Seems we're not processing a GTW!?
                        step.addViolation(new LiveDocRuleViolation(`a ${type} step definition must be preceded by a Given, When or Then.`, livedoc.rules.andButMustHaveGivenWhenThen, this.title, this.parent.filename))
                            .report();
                }
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
    constructor(parent: Feature) {
        super(parent)
        this.displayPrefix = "Background";
    }

    public addStep(type: string, description: string): StepDefinition {
        const step = super.addStep(type, description);
        if (type === "Then" || type == "When") {
            step.addViolation(new LiveDocRuleViolation(`Backgrounds only support using the given step definition. Consider moving the ${type} to a scenario.`, livedoc.rules.backgroundMustOnlyIncludeGiven, step.title, this.parent.filename))
                .report();
        }
        return step;
    }
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
    public exampleRaw: DataTableRow;

    constructor(parent: Feature) {
        super(parent)
        this.displayPrefix = "Scenario";
    }

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
            exampleRaw: this.exampleRaw,
            given: undefined,
            and: [],
            tags: this.tags
        });
    }
}

class ScenarioOutline extends Scenario {
    public tables: Table[] = [];
    public scenarios: ScenarioOutlineScenario[] = [];

    constructor(parent: Feature) {
        super(parent)
        this.displayPrefix = "Scenario Outline";
    }

    public parseTables(tables: Table[]) {
        // merge all tables into a single array for processing
        tables.forEach(table => {
            this.parseTable(table);
        });

        if (this.scenarios.length === 0) {
            // Oh dear seems they either forgot the table or its not structured correctly.
            throw new LiveDocRuleViolation("A scenarioOutline was defined but does not contain any Examples. Did you mean to use a scenario or forget the Examples keyword?", LiveDocRuleOption.enabled, this.title, this.parent.filename);
        }
    }

    public parseTable(table: Table) {
        // merge all tables into a single array for processing
        if (!table.dataTable || table.dataTable.length <= 1) {
            throw TypeError("Data tables must have at least a header row plus a data row.");
        }
        const headerRow: string[] = [];
        table.dataTable[0].forEach(item => {
            // copy the header names removing spaces and apostrophes
            headerRow.push(this._parser.sanitizeName(item));
        });
        for (let i = 1; i < table.dataTable.length; i++) {
            const dataRow = table.dataTable[i];
            const scenario = new ScenarioOutlineScenario(this.parent);
            // Don't want to repeat the table etc for every scenario iteration
            scenario.rawDescription = this.title;
            scenario.example = this._parser.getTableRowAsEntity(headerRow, dataRow);
            scenario.exampleRaw = this._parser.getTableRowAsEntity(headerRow, dataRow, false);
            scenario.title = this._parser.bind(this.title, scenario.example);
            this.scenarios.push(scenario);
        }
    }
}

class StepDefinition {
    private _parser = new Parser();

    public id: number;
    public title: string = "";
    public get displayTitle(): string {
        let padding = "";
        if (["and", "but"].indexOf(this.type) >= 0) {
            padding = "  ";
        }
        const textReader = new TextBlockReader(this.rawDescription);
        // To preserve the binding in the title the tile is used then the rest of the raw description
        let descriptionParts = [];
        descriptionParts.push(this.title);
        textReader.next();
        while (textReader.next()) {
            descriptionParts.push(textReader.line);
        }

        return `${padding}${this.type} ${this._parser.applyIndenting(descriptionParts.join("\n"), 10)}`;
    }

    public type: string;
    public description: string = "";
    public rawDescription: string = "";
    public docString: string = "";
    public dataTable: DataTableRow[] = [];
    public values: any[] = [];
    public valuesRaw: string[] = [];
    public status: string;
    public code: string;
    public ruleViolations: LiveDocRuleViolation[] = [];
    //error: Exception = new Exception();

    public associatedScenarioId: number;
    public executionTime: number;

    public getStepContext(): StepContext {
        const context = new StepContext();
        context.title = this.title;
        context.dataTable = this.dataTable;
        context.docString = this.docString;
        context.values = this.values;
        context.valuesRaw = this.valuesRaw;

        return context;
    }


    public addViolation(violation: LiveDocRuleViolation): LiveDocRuleViolation {
        this.ruleViolations.push(violation);
        return violation;
    }
}

class Table {
    public name: string = "";
    public description: string = "";
    public dataTable: DataTableRow[] = [];
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
    public exampleRaw: DataTableRow;
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

/** @internal */
var _mocha = require('mocha'),
    _suite = require('mocha/lib/suite'),
    _test = require('mocha/lib/test');

_mocha.interfaces['livedoc-mocha'] = module.exports = liveDocMocha;

/**
 * This is used to store the current state of the executing test
 * 
 * @class LiveDocContext
 */
class LiveDocContext {
    parent: LiveDocContext;
    feature: Feature;
    scenario: Scenario;
    type: string;
    scenarioCount: number;
    scenarioId: number;
    backgroundSteps: StepDefinition[];
    afterBackground: Function;
    backgroundStepsComplete: boolean;
}

/**
 * This is used to store the current state of the executing test for bdd style tests
 * 
 * @class BddContext
 */
class BddContext {
    parent: BddContext;
    type: string;
    describe: Describe;
    child: Describe;
}

// Legacy BDD model
class Describe {
    constructor(public title: string) {

    }
    public children: Describe[] = [];
    public tests: Test[] = [];
}

class Test {
    constructor(public title: string) {

    }
}

//endregion

//region mocha integration
/**
 * Used to initialize the livedoc context for a new Feature
 * 
 * @param {Mocha.ISuite} suite 
 * @param {Feature} feature 
 * @param {string} type 
 * @returns {LiveDocContext} 
 */
function addLiveDocContext(suite: Mocha.ISuite, feature: Feature, type: string): LiveDocContext {
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
 * @param {Mocha.ISuite} suite 
 * @param {Describe} describe 
 * @param {string} type 
 * @returns {BddContext} 
 */
function addBddContext(suite: Mocha.ISuite, describe: Describe, type: string): BddContext {
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
    // Extract command line parameters
    livedoc.options.include = getCommandLineOptions("--ld-include");
    livedoc.options.exclude = getCommandLineOptions("--ld-exclude");
    livedoc.options.showFilterConflicts = getCommandLineOption("--showFilterConflicts");

    console.log(JSON.stringify(livedoc.options));
    suite.on('pre-require', function (context, file, mocha) {

        var common = require('mocha/lib/interfaces/common')(suites, context, mocha);
        context.run = mocha.options.delay && common.runWithSuite(suite);

        var describeAliasBuilder = createDescribeAlias(file, suites, context, mocha, common);
        var stepAliasBuilder = createStepAlias(file, suites, mocha, common);

        context.after = common.after;
        context.afterEach = common.afterEach;
        context.before = common.before;
        context.beforeEach = common.beforeEach;
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
            let stepDefinition: StepDefinition;
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
                    const bddTest = new Test(title)
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
                        throw new LiveDocRuleViolation(`This feature is using bdd syntax, did you mean to use given instead?`, livedoc.rules.mustNotMixLanguages, title, livedocContext.feature.filename);
                    }

                    if (suite._beforeAll.length > 0) {
                        livedocContext.scenario.addViolation(new LiveDocRuleViolation(`Using before does not help with readability, consider using a given instead.`, livedoc.rules.enforceUsingGivenOverBefore, title, livedocContext.feature.filename))
                            .report()
                    }

                    if (suiteType === "Background") {
                        stepDefinition = livedocContext.feature.background.addStep(type, title);
                    } else if (suiteType === "Scenario" || suiteType === "Scenario Outline") {
                        stepDefinition = livedocContext.scenario.addStep(type, title);
                    } else {
                        throw new LiveDocRuleViolation(`Invalid Gherkin, ${type} can only appear within a Background, Scenario or Scenario Outline`, livedoc.rules.givenWhenThenMustBeWithinScenario, title, file);
                    }

                    testName = stepDefinition.displayTitle;

                    if (stepDefinitionFunction) {
                        stepDefinitionContextWrapper = async function (...args) {
                            displayWarningsInlineIfPossible(livedocContext, stepDefinition);
                            featureContext = livedocContext.feature.getFeatureContext();
                            switch (livedocContext.type) {
                                case "Background":
                                    backgroundContext = livedocContext.feature.getBackgroundContext();
                                    break;
                                case "Scenario":
                                    scenarioContext = livedocContext.scenario.getScenarioContext();
                                    break;
                                case "Scenario Outline":
                                    scenarioOutlineContext = livedocContext.scenario.getScenarioContext() as ScenarioOutlineContext;
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
                                    backgroundContext = livedocContext.feature.getBackgroundContext();
                                    for (let i = 0; i < suite.parent.livedoc.backgroundSteps.length; i++) {
                                        const stepDetails = suite.parent.livedoc.backgroundSteps[i];
                                        // reset the stepContext for this step
                                        stepContext = stepDetails.stepDefinition.getStepContext();
                                        const result = stepDetails.func();
                                        if (result && result["then"]) {
                                            await result;
                                        }
                                    }
                                }
                            }
                            // Must reset stepContext as execution of the background may have changed it
                            stepContext = stepDefinition.getStepContext();

                            return stepDefinitionFunction(args);
                        }
                    }
                }
            }
            catch (e) {
                if (e.constructor.name === "LiveDocRuleViolation") {
                    if (livedocContext.feature) {
                        livedocContext.feature.addViolation(e);
                    }
                    e.report();
                    return testTypeCreator("invalid")(title, stepDefinitionFunction);
                } else {
                    throw e;
                }
            }

            if (suite.isPending()) {
                // Skip processing test function if the suite is marked to skip
                stepDefinitionContextWrapper = null;
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
            return common.test.only(mocha, testType(title, fn));
        };

        return testType;
    };

}

function displayWarningsInlineIfPossible(livedocContext: LiveDocContext, stepDefinition: StepDefinition) {
    // if the parent has a rule violation report it here to make it more visible to the dev they made a mistake
    if (livedocContext && livedocContext.scenario) {
        livedocContext.scenario.ruleViolations.forEach(violation => {
            violation.report(true);
        });
    }
    if (livedocContext && livedocContext.feature) {
        livedocContext.feature.ruleViolations.forEach(violation => {
            violation.report(true);
        });
    }

    if (stepDefinition) {
        stepDefinition.ruleViolations.forEach(violation => {
            violation.report(true);
        });
    }
}
/** @internal */
function createDescribeAlias(file, suites, context, mocha, common) {
    return function wrapperCreator(type) {
        function wrapper(title: string, fn: Function, opts: { pending?: boolean, isOnly?: boolean } = {}) {
            let suite: Mocha.ISuite;

            try {

                if (type === "invalid") {
                    resetGlobalVariables();
                    suite = _suite.create(suites[0], title);
                } else if (type === "bdd") {
                    resetGlobalVariables();
                    suite = processBddDescribe(suites, type, title, file);
                } else {
                    let livedocContext: LiveDocContext;
                    let feature: Feature;
                    if (type === "Feature") {
                        resetGlobalVariables();
                        feature = new Feature();
                        feature.filename = file.replace(/^.*[\\\/]/, '');
                    } else {
                        // Validate that we have a feature
                        if (!suites[0].livedoc || !suites[0].livedoc.feature) {
                            // No feature!!
                            throw new LiveDocRuleViolation(`${type} must be within a feature.`, livedoc.rules.missingFeature, title, file);
                        }
                        feature = suites[0].livedoc.feature;
                    }

                    const suiteDefinition = feature.parse(type, title);
                    suite = _suite.create(suites[0], suiteDefinition.displayTitle);
                    (suite as any).pending = opts.pending || livedoc.shouldMarkAsPending(suiteDefinition.tags);
                    if (livedoc.shouldInclude(suiteDefinition.tags)) {
                        (suite.parent as any)._onlySuites = (suite.parent as any)._onlySuites.concat(suite);
                        mocha.options.hasOnly = true;
                    }
                    // initialize the livedoc context
                    livedocContext = addLiveDocContext(suite, feature, type);

                    switch (type) {
                        case "Feature":
                            featureContext = feature.getFeatureContext();
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
                            livedocContext.scenario = suiteDefinition as Scenario;
                            break;
                    }

                    // Specific logic for Scenario Outlines
                    if (type === "Scenario Outline") {
                        // Setup the basic context for the scenarioOutline

                        const scenarioOutline = suiteDefinition as ScenarioOutline;
                        for (let i = 0; i < scenarioOutline.scenarios.length; i++) {
                            const currentScenario = scenarioOutline.scenarios[i];
                            context = currentScenario.getScenarioContext();
                            var outlineSuite = _suite.create(suites[0], currentScenario.displayTitle);

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
                        suites[0].livedoc.feature.addViolation(e);
                    }
                    e.report();
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
        throw new LiveDocRuleViolation(`The async keyword is not supported for ${type}`, LiveDocRuleOption.enabled, "Unsupported keyword", featureContext.filename);
    }

    function processBddDescribe(suites: Mocha.ISuite, type: string, title: string, file: string): Mocha.ISuite {
        // This is a legacy describe/context test which doesn't support
        // the features of livedoc
        let livedocContext: BddContext;
        const childDescribe = new Describe(title);
        if (suites[0].livedoc && suites[0].livedoc.type !== "bdd") {
            const violation = new LiveDocRuleViolation(`This feature is using bdd syntax, did you mean to use scenario instead?`, livedoc.rules.mustNotMixLanguages, title, file);
            throw violation;
        }

        if (!suites[0].livedoc) {
            livedocContext = addBddContext(suites[0], childDescribe, type);
        }
        else {
            livedocContext = suites[0].livedoc;
            livedocContext.child = childDescribe;
        }
        const suite = _suite.create(suites[0], childDescribe.title);
        suite.livedoc = livedocContext;

        return suite;
    }
}

//endregion