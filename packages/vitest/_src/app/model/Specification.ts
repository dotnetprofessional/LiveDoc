import { LiveDocSuite } from "./LiveDocSuite";
import { Rule } from "./Rule";
import { RuleViolations } from "./RuleViolations";
import { SpecificationContext } from "./SpecificationContext";

/**
 * Specification is the top-level container for the Specification pattern.
 * It contains Rules (simple) and RuleOutlines (data-driven).
 * Unlike Feature/Scenario, specifications don't use step functions.
 */
export class Specification extends LiveDocSuite {
    public filename: string = "";
    public rules: Rule[] = [];
    public executionTime: number = 0;

    constructor() {
        super();
    }

    public addRule(rule: Rule): void {
        // Validate we have a description
        if (!rule.title) {
            rule.addViolation(
                RuleViolations.enforceTitle,
                `${rule.type} seems to be missing a title. Titles are important to convey the meaning of the Spec.`,
                rule.title
            );
        }

        rule.sequence = this.rules.length;

        // Assign unique ids
        this.generateId(rule);
        this.validateIdUniqueness(rule.id, this.rules);

        this.rules.push(rule);
    }

    public getSpecificationContext(): SpecificationContext {
        const context = new SpecificationContext();
        context.filename = this.filename;
        context.title = this.title;
        context.description = this.description;
        context.tags = this.tags;
        return context;
    }

    toJSON(): object {
        return {
            ...super.toJSON(),
            filename: this.filename,
            rules: this.rules.map(r => r.toJSON()),
            executionTime: this.executionTime
        };
    }
}
