import { Scenario } from "./Scenario";
import { Table } from "./Table";
import { ScenarioExample } from "./ScenarioExample";
import { Feature } from "./Feature";

/**
 * The computed scenario from a ScenarioOutline definition
 * Differs from a standard scenario as it includes examples
 */
export class ScenarioOutline extends Scenario {
    public tables: Table[] = [];
    public examples: ScenarioExample[] = [];

    constructor(parent: Feature) {
        super(parent);
    }

    toJSON(): object {
        return {
            ...super.toJSON(),
            tables: this.tables,
            examples: this.examples.map(e => e.toJSON())
        };
    }
}
