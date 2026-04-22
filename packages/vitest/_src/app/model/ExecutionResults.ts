import { Feature } from "./Feature";
import { Specification } from "./Specification";
import { VitestSuite } from "./VitestSuite";

/**
 * Aggregates execution results for all features and suites
 */
export class ExecutionResults {
    public features: Feature[] = [];
    public specifications: Specification[] = [];
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

    public addSpecification(specification: Specification): void {
        // Generate ID and validate uniqueness
        (specification as any).generateId(specification);
        (specification as any).validateIdUniqueness(specification.id, this.specifications);
        this.specifications.push(specification);
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
            specifications: this.specifications,
            suites: this.suites,
            thrownException: this.thrownException
        };
    }
}
