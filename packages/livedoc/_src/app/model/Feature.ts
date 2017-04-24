
export interface Row {
    [prop: string]: any;
}

export class Feature {
    private _statistics: Statistics;

    public id: number;
    public filename: string;
    public background: Background;
    public title: string;
    public description: string;
    public scenarios: Scenario[] = [];
    public status: Status;
    public tags: string[];

    public executionTime: number;

    public get statistics(): Statistics {
        console.log("Getting statistics");
        if (!this._statistics) {
            var stats = new Statistics();
            this.scenarios.forEach(scenario => {
                stats.passed += scenario.statistics.passed;
                stats.failed += scenario.statistics.failed;
                stats.pending += scenario.statistics.pending;
            });
            this._statistics = stats;
            console.log("calulated stats", stats);
        }
        console.log("returning stats");
        return this._statistics;
    };

}

export class Scenario {
    private _statistics: Statistics;

    public id: number;
    public title: string;
    public description: string;
    public steps: StepDefinition[] = [];
    public status: Status;
    public tags: string[];

    public associatedFeatureId: number;
    public executionTime: number;

    public get statistics(): Statistics {
        if (!this._statistics) {
            var stats = new Statistics();
            this.steps.forEach(step => {
                switch (step.status) {
                    case Status.Pass:
                        stats.passed++;
                        break;
                    case Status.Failed:
                        stats.failed++;
                        break;
                    case Status.Pending:
                        stats.pending++;
                }
            });
            this._statistics = stats;
        }

        return this._statistics;
    };
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