import { LiveDocRuleOption } from "./LiveDocRuleOption";
var colors = require("colors");

export class LiveDocRuleViolation extends Error {
    public errorId: number;
    static errorCount: number = 0;
    private dontShowAgain: boolean;

    constructor (message: string, public option: LiveDocRuleOption, public title: string, public file: string) {
        super(message);
        this.file = file.replace(/^.*[\\\/]/, '');
    }

    public report(dontShowAgain: boolean = false) {
        if (this.dontShowAgain) {
            return;
        }

        this.dontShowAgain = dontShowAgain;

        if (this.option === LiveDocRuleOption.disabled) {
            return;
        }
        if (!this.errorId) {
            LiveDocRuleViolation.errorCount++;
            this.errorId = LiveDocRuleViolation.errorCount;
        }
        const outputMessage = `${this.message} [title: ${this.title}, file: ${this.file}]`;
        if (this.option === LiveDocRuleOption.warning) {
            console.error(colors.bgYellow(colors.red(`WARNING[${this.errorId}]: ${outputMessage}`)));
        } else {
            throw new LiveDocRuleViolation(outputMessage, LiveDocRuleOption.enabled, "", "");
        }
    }
}
