import { Feature, MochaSuite } from ".";

/**
 * Contains the results of a test run
 * 
 * @export
 * @class ExecutionResults
 */
export class ExecutionResults {
    public features: Feature[] = [];
    public suites: MochaSuite[] = [];

    public addFeature(feature: Feature) {
        // ok bad - accessing a protected members :(
        (feature as any).generateId(feature);
        (feature as any).validateIdUniqueness(feature.id, this.features);
        this.features.push(feature);
    }

    public addSuite(suite: MochaSuite) {
        // ok bad - accessing a protected members :(
        (suite as any).generateId(suite);
        (suite as any).validateIdUniqueness(suite.id, this.suites);
        this.suites.push(suite);
    }
}
