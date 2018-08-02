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

    protected generateId(item: any) {
        const parent: any = item.parent;
        item.id = `${parent ? parent.id + "-" : ""}${fvn.hash(item.title).str()}`;
    }

    protected validateIdUniqueness(id: string, children: any[]) {
        const count: number = children.filter(child => child.id === id).length;
        if (count > 1) {
            // lookup one of the items with the id
            const duplicate = children.find(child => child.id === id);
            const message = `Feature titles must be unique. Scenarios must have unique titles within a Feature and Step Title must be unique within a Scenario.
  Title: ${duplicate.title}`;
            throw new LiveDocRuleViolation(RuleViolations.error,
                message,
                "Duplicate Title");
        }
    }
}