import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";
import { Statistics } from "./Statistics";
import { SuiteBase } from "./SuiteBase";
import { jsonIgnore } from "../decorators";

export class LiveDocSuite extends SuiteBase<LiveDocSuite> {
    @jsonIgnore
    public rawDescription: string;
    public ruleViolations: LiveDocRuleViolation[] = [];
    @jsonIgnore
    public displayTitle: string;
    public description: string;

    constructor() {
        super();
        this.statistics = new Statistics(this);
    }

    public addViolation(rule: RuleViolations, message: string, title: string): void {
        this.addViolationInstance(new LiveDocRuleViolation(rule, message, title));
    }

    public addViolationInstance(violation: LiveDocRuleViolation): void {
        this.ruleViolations.push(violation);
        this.registerRuleViolation();
    }

    public registerRuleViolation() {
        this.statistics.totalRuleViolations++;
        // Now add it to the feature
        if (this.constructor.name !== "Feature") {
            (this as any).parent.statistics.totalRuleViolations++;
        }
    }
}
