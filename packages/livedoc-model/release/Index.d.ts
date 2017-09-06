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
    tags: string[];
    executionTime: number;
}
export declare class Scenario {
    id: number;
    title: string;
    description: string;
    steps: StepDefinition[];
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
    status: string;
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
    readonly status: string;
    readonly total: number;
    readonly passedPercent: number;
    readonly failedPercent: number;
    readonly pendingPercent: number;
    private calcPercent(value);
}
export declare const Status: {
    "Unknown": string;
    "Pass": string;
    "Pending": string;
    "Failed": string;
};
