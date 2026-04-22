import { RuleViolations } from "./RuleViolations";

export class LiveDocRuleViolation extends Error {
    private static errorCount: number = 0;
    private _errorId: number = 0;

    constructor(public rule: RuleViolations, message: string, public title: string) {
        super(message);

        LiveDocRuleViolation.errorCount++;
        this._errorId = LiveDocRuleViolation.errorCount;
    }

    public get errorId(): number {
        return this._errorId;
    }

    toJSON(): object {
        return {
            rule: RuleViolations[this.rule],
            message: this.message,
            title: this.title,
            errorId: this._errorId
        };
    }
}
