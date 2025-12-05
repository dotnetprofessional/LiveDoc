import { ExecutionResults } from "../model/ExecutionResults";

/**
 * Interface for post-execution reporters
 * These run after all tests complete to generate additional reports
 */
export interface IPostReporter {
    /**
     * Execute the reporter with the test results
     * @param results The execution results from all tests
     * @param options Reporter-specific options
     */
    execute(results: ExecutionResults, options?: any): void | Promise<void>;
}
