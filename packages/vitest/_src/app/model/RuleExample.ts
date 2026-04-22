import { Rule } from "./Rule";
import { RuleOutline } from "./RuleOutline";
import { Specification } from "./Specification";
import { RuleContext } from "./RuleContext";
import type { DataTableRow } from "../types";

/**
 * Extended context for rule outlines including example data
 */
export interface RuleOutlineContext extends RuleContext {
    example: DataTableRow;
    exampleRaw: DataTableRow;
}

/**
 * RuleExample represents a single data row execution of a RuleOutline.
 * Similar to ScenarioExample but for the Specification pattern.
 */
export class RuleExample extends Rule {
    public example!: DataTableRow;
    public exampleRaw!: DataTableRow;
    public ruleOutline!: RuleOutline;

    constructor(parent: Specification, ruleOutline: RuleOutline) {
        super(parent);
        this.ruleOutline = ruleOutline;
    }

    public getRuleContext(): RuleOutlineContext {
        const baseContext = super.getRuleContext();
        return {
            ...baseContext,
            // Pull values/params from the parent ruleOutline (where parsing populates them)
            values: this.ruleOutline.values,
            valuesRaw: this.ruleOutline.valuesRaw,
            params: this.ruleOutline.params,
            paramsRaw: this.ruleOutline.paramsRaw,
            example: this.example,
            exampleRaw: this.exampleRaw
        };
    }

    public bind(content: string, model: DataTableRow): string {
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
