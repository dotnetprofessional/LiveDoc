import { Scenario } from "./Scenario";
import { Feature } from "./Feature";
import { StepDefinition } from "./StepDefinition";
import { ScenarioOutlineContext } from "./ScenarioOutlineContext";
import { DescriptionParser } from "../parser/Parser";

export class ScenarioOutlineScenario extends Scenario {
    public example: DataTableRow;
    public exampleRaw: DataTableRow;

    constructor (parent: Feature) {
        super(parent)
    }

    public addStep(step: StepDefinition): void {
        super.addStep(step);
        const parser = new DescriptionParser();
        step.title = parser.bind(step.title, this.example);
        step.displayTitle = parser.bind(step.displayTitle, this.example);
        step.docString = parser.bind(step.docString, this.example);
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