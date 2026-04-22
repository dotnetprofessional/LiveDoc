import { Statistics } from "./Statistics";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";

/**
 * Base class for all test suites (Feature, Scenario, Background, etc.)
 */
export class SuiteBase<T> {
    public type: string;
    public id: string = "";
    public sequence: number = 0;
    public statistics!: Statistics<T>;
    public title: string = "";
    public tags: string[] = [];
    public path: string = "";

    constructor() {
        this.type = this.constructor.name;
    }

    public generateId(item: any): void {
        const parent: any = item.parent;
        const hashSum = this.simpleHash(item.title);
        item.id = `${parent && parent.id ? parent.id + "-" : ""}${hashSum}`;
    }

    protected validateIdUniqueness(id: string, children: any[]): void {
        const count: number = children.filter(child => child.id === id).length;
        if (count > 0) {
            const duplicate = children.find(child => child.id === id);
            const message = `Feature titles must be unique. Scenarios must have unique titles within a Feature and Step Title must be unique within a Scenario.\n  Title: ${duplicate.title}`;
            throw new LiveDocRuleViolation(
                RuleViolations.error,
                message,
                "Duplicate Title"
            );
        }
    }

    /**
     * Simple hash function to replace hash-sum dependency
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
}
