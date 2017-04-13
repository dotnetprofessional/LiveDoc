
export class Feature {
    id: string;
    filename: string;
    background: Background;
    title: string;
    description: string;
    scenarios: Scenario[] = [];
    status: Status;

    executionTime: number;
    statistics: Statistics;

}

export class Scenario {
    id: string;
    title: string;
    description: string;
    steps: StepDefinition[];
    status: Status;

    associatedFeatureId: string;
    executionTime: number;
    statistics: Statistics;
}

export class Background extends Scenario {

}

export class StepDefinition {
    id: string;
    title: string;
    type: string;
    description: string;
    status: Status;
    code: string;
    error: string;

    associatedScenarioId: string;
    executionTime: number;
}

export class Statistics {
    public passed: number = 0;
    public failed: number = 0;
    public pending: number = 0;

    public get total(): number {
        return this.passed + this.failed + this.pending
    }

    public get passedPercent() {
        return this.calcPercent(this.passed);
    }

    public get failedPercent() {
        return this.calcPercent(this.failed);
    }

    public get pendingPercent() {
        return this.calcPercent(this.pending);
    }

    private calcPercent(value: number): number {
        if (this.total === 0) {
            return 0;
        }

        return value / this.total;
    }

    public updateStatics(steps: StepDefinition[]) {

    }
}

export enum Status {
    Unknown,
    Pass,
    Pending,
    Failed,
}