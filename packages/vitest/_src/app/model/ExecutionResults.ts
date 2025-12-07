import { Feature } from "./Feature";
import { VitestSuite } from "./VitestSuite";

/**
 * Aggregates execution results for all features and suites
 */
export class ExecutionResults {
    public features: Feature[] = [];
    public suites: VitestSuite[] = [];
    /** Stores any exception that was thrown during execution and should be re-thrown to the caller */
    public thrownException?: { type: string; message: string; data?: any };

    public addFeature(feature: Feature): void {
        // Generate ID and validate uniqueness (matching Mocha behavior)
        // Note: accessing protected members via type assertion
        (feature as any).generateId(feature);
        (feature as any).validateIdUniqueness(feature.id, this.features);
        this.features.push(feature);
    }

    public addSuite(suite: VitestSuite): void {
        // Generate ID and validate uniqueness (matching Mocha behavior)
        (suite as any).generateId(suite);
        (suite as any).validateIdUniqueness(suite.id, this.suites);
        this.suites.push(suite);
    }

    toJSON(): object {
        return {
            features: this.features,
            suites: this.suites,
            thrownException: this.thrownException
        };
    }
}
