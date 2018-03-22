import { RuleViolations } from "./RuleViolations";

export class LiveDocRuleViolation extends Error {
    private static errorCount: number = 0;
    private _errorId: number = 0;

    constructor (public rule: RuleViolations, message: string, public title: string) {
        super(message);

        LiveDocRuleViolation.errorCount++;
        this._errorId = LiveDocRuleViolation.errorCount;
    }

    public get errorId() {
        return this._errorId;
    }

    // public reportX(dontShowAgain: boolean = false) {
    //     if (this.dontShowAgain) {
    //         return;
    //     }

    //     this.dontShowAgain = dontShowAgain;

    //     if (this.option === LiveDocRuleOption.disabled) {
    //         return;
    //     }
    //     if (!this.errorId) {
    //         LiveDocRuleViolation.errorCount++;
    //         this.errorId = LiveDocRuleViolation.errorCount;
    //     }
    //     const outputMessage = `${this.message} [title: ${this.title}, file: ${this.file}]`;
    //     if (this.option === LiveDocRuleOption.warning) {
    //         console.error(colors.bgYellow(colors.red(`WARNING[${this.errorId}]: ${outputMessage}`)));
    //     } else {
    //         throw new LiveDocRuleViolation(outputMessage, LiveDocRuleOption.enabled, "", "");
    //     }
    // }
}
