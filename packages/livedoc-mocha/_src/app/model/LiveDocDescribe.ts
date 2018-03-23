import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";

export class LiveDocDescribe {
    public id: number;
    public title: string;
    public rawDescription: string;

    public displayTitle: string;
    public tags: string[];
    public description: string;

    public ruleViolations: LiveDocRuleViolation[] = [];

    public addViolation(rule: RuleViolations, message: string, title: string): void {
        this.addViolationInstance(new LiveDocRuleViolation(rule, message, title));
    }

    public addViolationInstance(violation: LiveDocRuleViolation): void {
        this.ruleViolations.push(violation);
    }
}