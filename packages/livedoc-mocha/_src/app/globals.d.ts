/// <reference path="./globalsmodule.d.ts" />

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

//region Globals
var feature: Mocha.IContextDefinition;
var background: Mocha.IContextDefinition;
var scenario: Mocha.IContextDefinition;
var scenarioOutline: Mocha.IContextDefinition;
var given: Mocha.ITestDefinition;
var when: Mocha.ITestDefinition;
var then: Mocha.ITestDefinition;
var and: Mocha.ITestDefinition;
var but: Mocha.ITestDefinition;

var afterBackground: (fn) => void;

var featureContext: LiveDocTypes.FeatureContext;
var scenarioContext: LiveDocTypes.ScenarioContext;
var stepContext: LiveDocTypes.StepContext;
var backgroundContext: LiveDocTypes.BackgroundContext;
var scenarioOutlineContext: LiveDocTypes.ScenarioOutlineContext;

var livedoc: LiveDoc
var liveDocRuleOption;
