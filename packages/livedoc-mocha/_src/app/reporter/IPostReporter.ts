import { ExecutionResults } from "../model";

export interface IPostReporter {
    execute(results: ExecutionResults, options: any);
}
