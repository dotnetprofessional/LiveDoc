import * as fs from "fs-extra";
import { IPostReporter } from "./IPostReporter";
import { ExecutionResults } from "../model/ExecutionResults";

export class JsonReporter implements IPostReporter {
    public execute(results: ExecutionResults, options: any) {
        if (!options || !options.output) {
            throw Error("json reporter: you must specify an output file");
        }
        const file = options.output;
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }

        // write out the results as a json file
        fs.writeFileSync(file, JSON.stringify(results));
    }
}