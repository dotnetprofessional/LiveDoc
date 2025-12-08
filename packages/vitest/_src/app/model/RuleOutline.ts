import { Rule } from "./Rule";
import { Table } from "./Table";
import { RuleExample } from "./RuleExample";
import { Specification } from "./Specification";

/**
 * RuleOutline is a data-driven rule with Examples table.
 * Similar to ScenarioOutline but for the Specification pattern.
 */
export class RuleOutline extends Rule {
    public tables: Table[] = [];
    public examples: RuleExample[] = [];

    constructor(parent: Specification) {
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
