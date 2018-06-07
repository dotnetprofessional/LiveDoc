import { RuleViolations } from "./RuleViolations";
import { jsonIgnore } from "../decorators";

export class LiveDocRuleViolation extends Error {
    private static errorCount: number = 0;

    @jsonIgnore
    private _errorId: number = 0;

    constructor(public rule: RuleViolations, message: string, public title: string) {
        super(message);

        LiveDocRuleViolation.errorCount++;
        this._errorId = LiveDocRuleViolation.errorCount;
        debugger;
    }

    public get errorId() {
        return this._errorId;
    }
}
