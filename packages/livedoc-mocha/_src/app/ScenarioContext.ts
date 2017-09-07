
import { StepContext } from "./index";

export class ScenarioContext {
    title: string;
    description: string;
    given: StepContext;
    and: StepContext[] = [];
    tags: string[];
}