import { Scenario } from "./Scenario";
import { Table } from "./Table";
import { ScenarioExample } from "./ScenarioExample";
import { Feature } from "./Feature";
import { StepDefinition } from "./StepDefinition";

/**
 * The computed scenario from a ScenarioOutline definition
 * Differs from a standard scenario as it includes examples
 */
export class ScenarioOutline extends Scenario {
    public tables: Table[] = [];
    public examples: ScenarioExample[] = [];
    /**
     * Blueprint steps parsed from the Scenario Outline title block.
     * These contain the original DocStrings and Data Tables from Gherkin.
     */
    public blueprintSteps: StepDefinition[] = [];

    constructor(parent: Feature) {
        super(parent);
    }

    toJSON(): object {
        return {
            ...super.toJSON(),
            tables: this.tables,
            examples: this.examples.map(e => e.toJSON()),
            blueprintSteps: this.blueprintSteps.map(s => s.toJSON())
        };
    }
}

