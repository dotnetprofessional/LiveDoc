export interface Row {
    [prop: string]: {};
}
export declare class CalcStatistics {
    static feature(feature: Feature): Statistics;
    static scenario(scenario: Scenario): Statistics;
}
export declare class Feature {
    id: number;
    filename: string;
    background: Background;
    title: string;
    description: string;
    scenarios: Scenario[];
    status: Status;
    tags: string[];
    executionTime: number;
}
export declare class Scenario {
    id: number;
    title: string;
    description: string;
    steps: StepDefinition[];
    status: Status;
    tags: string[];
    associatedFeatureId: number;
    executionTime: number;
}
export declare class Background extends Scenario {
}
export declare class ScenarioOutline extends Scenario {
    examples: example[];
}
export declare class example {
    name: string;
    rows: Row[];
}
export declare class StepDefinition {
    id: number;
    title: string;
    type: string;
    docString: string;
    table: Row[];
    status: Status;
    code: string;
    error: Exception;
    associatedScenarioId: number;
    executionTime: number;
}
export declare class Exception {
    actual: string;
    expected: string;
    message: string;
    stackTrace: string;
}
export declare class Statistics {
    passed: number;
    failed: number;
    pending: number;
    readonly total: number;
    readonly passedPercent: number;
    readonly failedPercent: number;
    readonly pendingPercent: number;
    private calcPercent(value);
    updateStatics(steps: StepDefinition[]): void;
}
export declare enum Status {
    Unknown = 0,
    Pass = 1,
    Pending = 2,
    Failed = 3,
}