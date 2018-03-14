import { LiveDocRuleViolation } from "./LiveDocRuleViolation";

export class LiveDocDescribe {
    public id: number;
    public title: string;
    public rawDescription: string;
    public get displayTitle(): string {
        //return `${this.displayPrefix}: ${this._parser.applyIndenting(this.rawDescription, this.displayIndentLength)}`;
        return "Need to fix this as it uses the Parsers applyIndenting";
    }
    public tags: string[];
    public description: string;

    public displayPrefix: string = "";
    public displayIndentLength: number = 0;

    public ruleViolations: LiveDocRuleViolation[] = [];

    public addViolation(violation: LiveDocRuleViolation): LiveDocRuleViolation {
        this.ruleViolations.push(violation);
        return violation;
    }
}