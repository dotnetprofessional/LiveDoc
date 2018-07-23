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
}
