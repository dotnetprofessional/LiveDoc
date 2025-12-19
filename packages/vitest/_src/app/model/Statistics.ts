import { SpecStatus } from "./SpecStatus";

export class Statistics<T = any> {
    public parent?: T;
    public totalCount: number = 0;
    public passCount: number = 0;
    public failedCount: number = 0;
    public pendingCount: number = 0;
    public totalRuleViolations: number = 0;
    public duration: number = 0;
    public passPercent: number = 0;
    public failedPercent: number = 0;
    public pendingPercent: number = 0;

    constructor(parent?: T) {
        this.parent = parent;
    }

    public updateStats(status: SpecStatus, duration: number): void {
        this.totalCount++;
        
        switch (status) {
            case SpecStatus.pass:
                this.passCount++;
                break;
            case SpecStatus.fail:
                this.failedCount++;
                break;
            case SpecStatus.pending:
                this.pendingCount++;
                break;
        }

        // Update elapsed time
        this.duration += duration;

        // Update the percentages
        this.failedPercent = this.totalCount > 0 ? this.failedCount / this.totalCount : 0;
        this.passPercent = this.totalCount > 0 ? this.passCount / this.totalCount : 0;
        this.pendingPercent = this.totalCount > 0 ? this.pendingCount / this.totalCount : 0;

        // Propagate stats to parent
        if (this.parent) {
            const parent = this.parent as any;

            // Scenario Examples have a different parent structure
            if (parent.constructor.name === "ScenarioExample") {
                parent.scenarioOutline.statistics.updateStats(status, duration);
            } else if (parent.constructor.name === "RuleExample") {
                parent.ruleOutline.statistics.updateStats(status, duration);
            } else if (parent.parent && parent.parent.statistics) {
                parent.parent.statistics.updateStats(status, duration);
            }
        }
    }

    toJSON(): object {
        return {
            totalCount: this.totalCount,
            passCount: this.passCount,
            failedCount: this.failedCount,
            pendingCount: this.pendingCount,
            totalRuleViolations: this.totalRuleViolations,
            duration: this.duration,
            passPercent: this.passPercent,
            failedPercent: this.failedPercent,
            pendingPercent: this.pendingPercent
        };
    }
}
