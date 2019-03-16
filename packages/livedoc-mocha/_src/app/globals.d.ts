
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

// declarations copied from existing .d.ts files
declare class FeatureContext {
    filename: string;
    title: string;
    description: string;
    tags: string[];
}
declare class ScenarioContext {
    title: string;
    description: string;
    given: StepContext;
    and: StepContext[];
    tags: string[];
}
declare class ScenarioOutlineContext extends ScenarioContext {
    example: DataTableRow;
    exampleRaw: DataTableRow;
}

declare class StepContext {
    private _table;
    private _parser;
    title: string;
    displayTitle: string;
    dataTable: DataTableRow[];
    docString: string;
    readonly docStringAsEntity: any;
    type: string;
    values: any[];
    valuesRaw: string[];
    readonly table: DataTableRow[];
    readonly tableAsEntity: DataTableRow;
    private convertDataTableRowToEntity(dataTable);
    tableAsList(): DataTableRow[];
    readonly tableAsSingleList: any[];
}

declare class BackgroundContext extends ScenarioContext {
}

declare class LiveDoc {
    options: LiveDocOptions;
}

interface LiveDocOptions {
    rules: LiveDocRules;
    filters: FilterOptions;
    reporterOptions: ReporterOptions;
    postReporters: string[];
    isolatedMode: boolean;
}

declare enum LiveDocRuleOption {
    enabled = "enabled",
    disabled = "disabled",
    warning = "warning",
}

declare class FilterOptions {
    include: string[];
    exclude: string[];
    showFilterConflicts: boolean;
}
declare class LiveDocRules {
    singleGivenWhenThen: LiveDocRuleOption;
    mustIncludeGiven: LiveDocRuleOption;
    mustIncludeWhen: LiveDocRuleOption;
    mustIncludeThen: LiveDocRuleOption;
    backgroundMustOnlyIncludeGiven: LiveDocRuleOption;
    enforceUsingGivenOverBefore: LiveDocRuleOption;
    enforceTitle: LiveDocRuleOption;
}

declare class ReporterOptions {
    colors: ColorTheme;
    options: Object;
}

interface ColorTheme {
    featureTitle: Object;
    featureDescription: Object;
    backgroundTitle: Object;
    backgroundDescription: Object;
    scenarioTitle: Object;
    scenarioDescription: Object;
    stepTitle: Object;
    stepDescription: Object;
    stepKeyword: Object;
    statusPass: Object;
    statusFail: Object;
    statusPending: Object;
    statusUnknown: Object;
    tags: Object;
    comments: Object;
    keyword: Object;
    dataTableHeader: Object;
    dataTable: Object;
    docString: Object;
    valuePlaceholders: Object;
}

interface ILiveDocTestDefinition {
    (expectation: string, callback?: (this: ITestCallbackContext, done: MochaDone) => PromiseLike<any> | void, passedParam?): ITest;
    only(expectation: string, callback?: (this: ITestCallbackContext, done: MochaDone) => PromiseLike<any> | void): ITest;
    skip(expectation: string, callback?: (this: ITestCallbackContext, done: MochaDone) => PromiseLike<any> | void): void;
    timeout(ms: number | string): void;
    state: "failed" | "passed";
}

//region Globals
declare var feature: Mocha.IContextDefinition;
declare var background: Mocha.IContextDefinition;
declare var scenario: Mocha.IContextDefinition;
declare var scenarioOutline: Mocha.IContextDefinition;
declare var given: ILiveDocTestDefinition;
declare var when: ILiveDocTestDefinition;
declare var then: ILiveDocTestDefinition;
declare var and: ILiveDocTestDefinition;
declare var but: ILiveDocTestDefinition;

declare var afterBackground: (fn) => void;

declare var featureContext: FeatureContext;
declare var scenarioContext: ScenarioContext;
declare var stepContext: StepContext;
declare var backgroundContext: BackgroundContext;
declare var scenarioOutlineContext: ScenarioOutlineContext;

declare var livedoc: LiveDoc
declare var liveDocRuleOption;
