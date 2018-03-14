import * as model from "./model";


/**
 * This is used to store the current state of the executing test
 * 
 * @class LiveDocContext
 */
export class LiveDocContext {
    parent: LiveDocContext;
    feature: model.Feature;
    scenario: model.Scenario;
    type: string;
    scenarioCount: number;
    scenarioId: number;
    backgroundSteps: model.StepDefinition[];
    afterBackground: Function;
    backgroundStepsComplete: boolean;
}