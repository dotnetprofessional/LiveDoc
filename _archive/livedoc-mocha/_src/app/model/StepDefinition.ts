import { StepContext } from "./StepContext";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";
import { LiveDocTest } from "./LiveDocTest";
import { jsonIgnore } from "../decorators";
import { Scenario } from "./Scenario";

export class StepDefinition extends LiveDocTest<Scenario> {
    @jsonIgnore
    private _displayTitle: string = "";
    @jsonIgnore
    private _docString: string = "";
    @jsonIgnore
    private _passedParam: object | Function;

    public rawTitle: string = "";

    public get passedParam(): object | Function {
        if (typeof this._passedParam === "function") {
            return this._passedParam();
        } else {
            return this._passedParam;
        }
    };

    public set passedParam(value: object | Function) {
        this._passedParam = value;
    }

    public type: string;
    public description: string = "";
    // public descriptionRaw: string = "";
    // public docString: string = "";
    @jsonIgnore
    public docStringRaw: string = "";
    public dataTable: DataTableRow[] = [];
    public values: any[] = [];
    @jsonIgnore
    public valuesRaw: string[] = [];
    public ruleViolations: LiveDocRuleViolation[] = [];

    public associatedScenarioId: number;
    public duration: number;

    public get displayTitle(): string {
        return this._displayTitle;
    };

    public set displayTitle(value: string) {
        this._displayTitle = value;
    }

    public get docString(): string {
        return this._docString;
    };

    public set docString(value: string) {
        this._docString = value;
    }

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

    public toJSON(): object {
        return {
            rawTitle: this.rawTitle,
            docString: this.docString,
            title: this.title,
            type: this.type,
            description: this.description,
            dataTable: this.dataTable,
            values: this.values,
            ruleViolations: this.ruleViolations,
            associatedScenarioId: this.associatedScenarioId,
            duration: this.duration
        };
    }
}