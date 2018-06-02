
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
