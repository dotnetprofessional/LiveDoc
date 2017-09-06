
export interface Row {
    [prop: string]: {};
}

export class CalcStatistics {

    public static feature(feature: Feature): Statistics {
        var stats = new Statistics();
        feature.scenarios.forEach(scenario => {
            const scenarioStats = this.scenario(scenario);
            stats.passed += scenarioStats.passed;
            stats.failed += scenarioStats.failed;
            stats.pending += scenarioStats.pending;
        });
        return stats;
    }

    public static scenario(scenario: Scenario): Statistics {
        var stats = new Statistics();
        scenario.steps.forEach(step => {
            switch (step.status) {
                case Status.Pass:
                    stats.passed++;
                    break;
                case Status.Failed:
                    stats.failed++;
                    break;
                case Status.Pending:
                    stats.pending++;
                    break;
                default:
                    break;
            }
        });
        return stats;
    }
}

export class Feature {

    public id: number;
    public filename: string;
    public background: Background;
    public title: string;
    public description: string;
    public scenarios: Scenario[] = [];
    public tags: string[];

    public executionTime: number;
}

export class Scenario {

    public id: number;
    public title: string;
    public description: string;
    public steps: StepDefinition[] = [];
    public tags: string[];

    public associatedFeatureId: number;
    public executionTime: number;
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
    table: Row[];
    status: string;
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

    public get status() {
        if (this.failed !== 0) {
            return Status.Failed;
        } else if (this.passed === 0 && this.pending > 0) {
            return Status.Pending;
        } else if (this.passed > 0) {
            return Status.Pass;
        } else {
            return Status.Unknown;
        }
    }

    public get total(): number {
        return this.passed + this.failed + this.pending;
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

        return value / this.total * 100;
    }
}

export const Status = {
    "Unknown": "Unknown",
    "Pass": "Pass",
    "Pending": "Pending",
    "Failed": "Failed"
}