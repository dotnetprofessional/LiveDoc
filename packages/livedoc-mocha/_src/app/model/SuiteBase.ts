import { Statistics } from "./Statistics";
import * as fvn from "fnv-plus";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";

export class SuiteBase<T> {
    constructor() {
        this.type = this.constructor.name;
    }
    public type: string;
    public id: string;
    public sequence: number;
    public statistics: Statistics<T>;

    public title: string;

    public tags: string[];
    public path: string;

    protected generateId() {
        const parent: any = (this as any).parent;
        this.id = `${parent ? parent.id + "-" : ""}${fvn.hash(this.title).str()}`;
    }

    protected validateIdUniqueness(id: string, children: any[]) {
        children.forEach(child => {
            if (child.id === id) {
                const message = `Feature titles must be unique. Scenarios must have unique titles within a Feature and Step Title must be unique within a Scenario.`;
                throw new LiveDocRuleViolation(RuleViolations.error,
                    message,
                    "Duplicate Title");
            }
        });
    }
}