import { Scenario } from "./Scenario";
import { Feature } from "./Feature";
import { StepDefinition } from "./StepDefinition";
import { ScenarioOutline } from "./ScenarioOutline";
import type { DataTableRow } from "../types";

/**
 * Extended context for scenario outlines including example data
 */
export interface ScenarioOutlineContext {
    title: string;
    description: string;
    example: DataTableRow;
    exampleRaw: DataTableRow;
    given?: any;
    and: any[];
    tags: string[];
}

export class ScenarioExample extends Scenario {
    public example!: DataTableRow;
    public exampleRaw!: DataTableRow;
    public scenarioOutline!: ScenarioOutline;

    constructor(parent: Feature, scenarioOutline: ScenarioOutline) {
        super(parent);
        this.scenarioOutline = scenarioOutline;
    }

    public addStep(step: StepDefinition): void {
        super.addStep(step);
        // Bind example values to step titles and docStrings
        step.displayTitle = this.bind(step.displayTitle, this.example);
        step.title = this.bind(step.title, this.example);
        step.docString = this.bind(step.docString, this.example);
    }

    public getScenarioContext(): ScenarioOutlineContext {
        const baseContext = super.getScenarioContext();
        return {
            ...baseContext,
            example: this.example,
            exampleRaw: this.exampleRaw
        };
    }

    private bind(content: string, model: DataTableRow): string {
        if (!content || !model) return content;

        const regex = /<([^>]+)>/g;
        return content.replace(regex, (_match, key) => {
            const sanitizedKey = this.sanitizeName(key);
            if (model.hasOwnProperty(sanitizedKey)) {
                return (model as any)[sanitizedKey];
            } else {
                throw new Error(
                    `Binding error: '${sanitizedKey}' does not exist in example. Verify the spelling and that the name still exists in the example.`
                );
            }
        });
    }

    private sanitizeName(name: string): string {
        // Remove spaces and apostrophes
        return name.replace(/[ `'']/g, "");
    }

    toJSON(): object {
        return {
            ...super.toJSON(),
            example: this.example,
            sequence: this.sequence
        };
    }
}
