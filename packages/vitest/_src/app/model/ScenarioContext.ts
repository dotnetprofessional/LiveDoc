import { StepContext } from "./StepContext";

/**
 * Framework metadata about the scenario
 * READ-ONLY - contains title/description/tags/step references
 * NOT for user test data! Use local variables instead.
 */
export class ScenarioContext {
    title: string = "";
    description: string = "";
    given?: StepContext;
    and: StepContext[] = [];
    tags: string[] = [];
    /** All steps in this scenario */
    steps: StepContext[] = [];
}
