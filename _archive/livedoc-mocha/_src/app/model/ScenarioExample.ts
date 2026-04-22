import { Scenario } from "./Scenario";
import { Feature } from "./Feature";
import { StepDefinition } from "./StepDefinition";
import { ScenarioOutlineContext } from "./ScenarioOutlineContext";
import { DescriptionParser } from "../parser/Parser";
import { jsonIgnore } from "../decorators";
import { ScenarioOutline } from "./ScenarioOutline";

export class ScenarioExample extends Scenario {
    public example: DataTableRow;
    @jsonIgnore
    public exampleRaw: DataTableRow;
    @jsonIgnore
    public scenarioOutline: ScenarioOutline;

    constructor(parent: Feature, scenarioOutline: ScenarioOutline) {
        super(parent);
        this.scenarioOutline = scenarioOutline;
    }

    public addStep(step: StepDefinition): void {
        super.addStep(step);
        const parser = new DescriptionParser();
        step.displayTitle = parser.bind(step.displayTitle, this.example);
        step.title = parser.bind(step.title, this.example);
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