import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";
import { Statistics } from "./Statistics";
import { SuiteBase } from "./SuiteBase";

export class LiveDocSuite extends SuiteBase<LiveDocSuite> {
    public rawDescription: string = "";
    public ruleViolations: LiveDocRuleViolation[] = [];
    public displayTitle: string = "";
    public description: string = "";

    constructor() {
        super();
        this.statistics = new Statistics(this);
    }

    public addViolation(rule: RuleViolations, message: string, title: string): void {
        this.addViolationInstance(new LiveDocRuleViolation(rule, message, title));
    }

    public addViolationInstance(violation: LiveDocRuleViolation): void {
        // Don't add duplicate violations
        if (this.ruleViolations.some(v => v.rule === violation.rule)) {
            return;
        }
        this.ruleViolations.push(violation);
        this.registerRuleViolation();
    }

    public registerRuleViolation(): void {
        this.statistics.totalRuleViolations++;
        // Propagate to parent if not a Feature
        if (this.constructor.name !== "Feature") {
            const parent = (this as any).parent;
            if (parent && parent.statistics) {
                parent.statistics.totalRuleViolations++;
            }
        }
    }

    toJSON(): object {
        return {
            type: this.type,
            id: this.id,
            sequence: this.sequence,
            title: this.title,
            description: this.description,
            tags: this.tags,
            ruleViolations: this.ruleViolations.map(v => v.toJSON()),
            statistics: this.statistics.toJSON()
        };
    }
}
