import { StepContext } from "../StepContext";
import { TextBlockReader } from "../parser/TextBlockReader";
import { DescriptionParser } from "../parser/Parser";
import { LiveDocRuleViolation } from "./LiveDocRuleViolation";

export class StepDefinition {
    private _parser = new DescriptionParser();

    public id: number;
    public title: string = "";
    public get displayTitle(): string {
        let padding = "";
        if (["and", "but"].indexOf(this.type) >= 0) {
            padding = "  ";
        }
        const textReader = new TextBlockReader(this.rawDescription);
        // To preserve the binding in the title the tile is used then the rest of the raw description
        let descriptionParts = [];
        descriptionParts.push(this.title);
        textReader.next();
        while (textReader.next()) {
            descriptionParts.push(textReader.line);
        }

        return `${padding}${this.type} ${this._parser.applyIndenting(descriptionParts.join("\n"), 10)}`;
    }

    public type: string;
    public description: string = "";
    public rawDescription: string = "";
    public docString: string = "";
    public dataTable: DataTableRow[] = [];
    public values: any[] = [];
    public valuesRaw: string[] = [];
    public status: string;
    public code: string;
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


    public addViolation(violation: LiveDocRuleViolation): LiveDocRuleViolation {
        this.ruleViolations.push(violation);
        return violation;
    }
}