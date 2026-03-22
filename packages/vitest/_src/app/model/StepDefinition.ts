import { StepContext } from "./StepContext";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";
import { RuleViolations } from "./RuleViolations";
import { LiveDocTest } from "./LiveDocTest";
import { Scenario } from "./Scenario";
import type { DataTableRow } from "../types";
import type { Attachment } from "@swedevtools/livedoc-schema";

export class StepDefinition extends LiveDocTest<Scenario> {
    private _displayTitle: string = "";
    private _docString: string = "";
    private _passedParam?: object | (() => object);

    public rawTitle: string = "";
    public type: string = "";
    public description: string = "";
    public docStringRaw: string = "";
    public dataTable: DataTableRow[] = [];
    public values: any[] = [];
    public valuesRaw: string[] = [];
    public params: Record<string, any> = {};
    public paramsRaw: Record<string, string> = {};
    public ruleViolations: LiveDocRuleViolation[] = [];
    public attachments: Attachment[] = [];
    public associatedScenarioId: number = 0;

    public get passedParam(): object | undefined {
        if (typeof this._passedParam === "function") {
            return this._passedParam();
        } else {
            return this._passedParam;
        }
    }

    public set passedParam(value: object | (() => object) | undefined) {
        this._passedParam = value;
    }

    public get displayTitle(): string {
        return this._displayTitle;
    }

    public set displayTitle(value: string) {
        this._displayTitle = value;
    }

    public get docString(): string {
        return this._docString;
    }

    public set docString(value: string) {
        this._docString = value;
    }

    public getStepContext(): StepContext {
        // Pass our attachments array so ctx.attach() writes directly here
        const context = new StepContext(this.attachments);
        context.title = this.title;
        context.displayTitle = this.displayTitle;
        context.dataTable = this.dataTable;
        context.docString = this.docString;
        context.values = this.values;
        context.valuesRaw = this.valuesRaw;
        context.params = this.params;
        context.paramsRaw = this.paramsRaw;
        context.type = this.type;
        return context;
    }

    public addViolation(rule: RuleViolations, message: string, title: string): void {
        this.ruleViolations.push(new LiveDocRuleViolation(rule, message, title));
        this.parent.registerRuleViolation();
    }

    toJSON(): object {
        return {
            ...super.toJSON(),
            rawTitle: this.rawTitle,
            docStringRaw: this.docStringRaw,
            docString: this.docString,
            type: this.type,
            description: this.description,
            dataTable: this.dataTable,
            values: this.values,
            valuesRaw: this.valuesRaw,
            params: this.params,
            paramsRaw: this.paramsRaw,
            ruleViolations: this.ruleViolations.map(r => r.toJSON()),
            attachments: this.attachments.length > 0 ? this.attachments : undefined,
            associatedScenarioId: this.associatedScenarioId
        };
    }
}
