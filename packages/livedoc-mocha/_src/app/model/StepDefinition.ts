import { StepContext } from "./StepContext";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";
import { Test } from "./Test";

export class StepDefinition extends Test {
    public id: number;
    public displayTitle: string = "";

    public type: string;
    public description: string = "";
    public rawDescription: string = "";
    public docString: string = "";
    public dataTable: DataTableRow[] = [];
    public values: any[] = [];
    public valuesRaw: string[] = [];
    public ruleViolations: LiveDocRuleViolation[] = [];
    //error: Exception = new Exception();

    public associatedScenarioId: number;
    public executionTime: number;

    public getStepContext(): StepContext {
        const context = new StepContext();
        context.title = this.title;
        context.dataTable = this.dataTable;
        context.docString = this.docString;
        context.values = this.values;
        context.valuesRaw = this.valuesRaw;

        return context;
    }

    public addViolation(rule: RuleViolations, message: string, title: string): void {
        this.ruleViolations.push(new LiveDocRuleViolation(rule, message, title));
    }
}