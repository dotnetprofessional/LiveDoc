import { promises as fs } from "fs";
import { resolve } from "path";
import { IPostReporter } from "./IPostReporter";
import { ExecutionResults } from "../model/ExecutionResults";

export class JsonReporter implements IPostReporter {
    public async execute(results: ExecutionResults, options: any): Promise<void> {
        if (!options || !options["json-output"]) {
            throw Error("json reporter: you must specify an output file");
        }
        const file = options["json-output"];
        const absolutePath = resolve(file);
        
        // Write out the results as a json file
        await fs.writeFile(absolutePath, JSON.stringify(results, null, 2), 'utf-8');
        console.log("Json file: " + absolutePath);
    }
}
