import { ExecutionResults } from "..";

export interface IPostReporter {
    execute(results: ExecutionResults, options: any);
}
