
export class Feature {
    id: number;
    filename: string;
    background: Background;
    title: string;
    description: string;
    scenarios: Scenario[] = [];
    status: Status;
    tags: string[];

    executionTime: number;
    statistics: Statistics;

}

export class Scenario {
    id: number;
    title: string;
    description: string;
    steps: StepDefinition[] = [];
    status: Status;
    tags: string[];

    associatedFeatureId: number;
    executionTime: number;
    statistics: Statistics;
}

export class Background extends Scenario {

}

export class ScenarioOutline extends Scenario {
    examples: example[] = [];
}

export class example {
    name: string;
    rows: Row[];
}

export class StepDefinition {
    id: number;
    title: string;
    type: string;
    docString: string;
    table: Row[]
    status: Status;
    code: string;
    error: Exception = new Exception();

    associatedScenarioId: number;
    executionTime: number;
}

export class Exception {
    actual: string;
    expected: string;
    message: string;
    stackTrace: string;
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