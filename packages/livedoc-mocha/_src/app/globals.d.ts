
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
declare interface String {
    startsWith(searchString: string, position?: number);
    endsWith(searchString: string, position?: number);
    repeat(times: number);
}
// declarations copied from existing .d.ts files
// export declare class FeatureContext {
//     filename: string;
//     title: string;
//     description: string;
//     tags: string[];
// }
// export declare class ScenarioContext {
//     title: string;
//     description: string;
//     given: StepContext;
//     and: StepContext[];
//     tags: string[];
// }
// export declare class StepContext {
//     private _table;
//     private _parser;
//     title: string;
//     displayTitle: string;
//     dataTable: DataTableRow[];
//     docString: string;
//     readonly docStringAsEntity: any;
//     type: string;
//     values: any[];
//     valuesRaw: string[];
//     readonly table: DataTableRow[];
//     readonly tableAsEntity: DataTableRow;
//     private convertDataTableRowToEntity(dataTable);
//     tableAsList(): DataTableRow[];
//     readonly tableAsSingleList: any[];
// }
// export declare class BackgroundContext extends ScenarioContext {
// }
/**
 * Represents a row in a data table as a keyed object
 * 
 * @interface DataTableRow
 */
declare interface DataTableRow {
    [prop: string]: any;
}