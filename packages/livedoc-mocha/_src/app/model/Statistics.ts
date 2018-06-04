import { SpecStatus } from "./SpecStatus";

export class Statistics<T> {
    public parent: T;
    public passCount: number = 0;
    public failedCount: number = 0;
    public pendingCount: number = 0;
    public totalCount: number = 0;
    public totalRuleViolations: number = 0;
    public duration: number = 0;

    public passPercent: number = 0;
    public failedPercent: number = 0;
    public pendingPercent: number = 0;

    constructor (parent: T) {
        this.parent = parent;
        Object.defineProperty(this, 'parent', {
            enumerable: false
        });
    }

    public updateStats(status: SpecStatus, duration: number) {
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
        this.failedPercent = this.failedCount / this.totalCount;
        this.passPercent = this.passCount / this.totalCount;
        this.pendingPercent = this.pendingCount / this.totalCount;

        if (this.parent) {
            const parent = this.parent;

            // Scenario Examples have a different parent so need to be treated differently
            if (parent.constructor.name === "ScenarioExample") {
                (parent as any).scenarioOutline.statistics.updateStats(status, duration);
            } else if ((parent as any).parent && (parent as any).parent.statistics) {
                (parent as any).parent.statistics.updateStats(status, duration);
            }
        }
    }
}