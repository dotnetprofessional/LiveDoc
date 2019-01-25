import { StepContext } from "./StepContext";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";
import { LiveDocTest } from "./LiveDocTest";
import { jsonIgnore } from "../decorators";
import { Scenario } from "./Scenario";

export class StepDefinition extends LiveDocTest<Scenario> {
    @jsonIgnore
    public displayTitle: string = "";
    public rawTitle: string = "";

    public type: string;
    public description: string = "";
    // public descriptionRaw: string = "";
    public docString: string = "";
    @jsonIgnore
    public docStringRaw: string = "";
    public dataTable: DataTableRow[] = [];
    public values: any[] = [];
    @jsonIgnore
    public valuesRaw: string[] = [];
    public ruleViolations: LiveDocRuleViolation[] = [];

    public associatedScenarioId: number;
    public duration: number;

    public getStepContext(): StepContext {
        const context = new StepContext();
        context.title = this.title;
        context.displayTitle = this.displayTitle;
        context.dataTable = this.dataTable;
        context.docString = this.docString;
        context.values = this.values;
        context.valuesRaw = this.valuesRaw;

        return context;
    }

    public addViolation(rule: RuleViolations, message: string, title: string): void {
        this.ruleViolations.push(new LiveDocRuleViolation(rule, message, title));
        this.parent.registerRuleViolation();
    }
}