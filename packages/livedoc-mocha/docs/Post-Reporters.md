# Post Reporters
`livedoc` introduces a new type of reporter that allows the easy creation of any type of output without having to track metrics etc.

Each post-reporter is run after the main [ui-reporter](UI-Reporters.md) has completed. That is after all the tests have been executed. The rich meta-data of the test run is then passed to each of the registered post-reporters.

If you have a need to produce custom output after the tests have run, then a post-reporter is what you need.

Implementing a post-reporter is very easy and only requires implementing one interface:

```ts
interface IPostReporter {
    execute(results: ExecutionResults, options: any);
}
```

The `ExecutionResults` object contains all the results including all the details of the scenario. There is enough detail to reproduce the original output.

The object has too much detailed to reproduce here. However, this is a brief summary of the structure, which should give a good idea of what's available:

```
root
|__features*
|   |__feature
|       |__background
|       |__scenarios*
|       |   |__steps*
|       |       |_step
|       |__scenarioOutlines*
|           |__scenarioOutline:scenario
|               |__tables*
|               |__examples*
|                   |__example:scenario
|__suites
|   |__children*:suite
|   |__tests*

* = collection
: = inheritance
```

Most of the object also have a `Statistics` object which records a summary of the results at that level. Where an object has children the statistics will be a summation of all the child statistics. This can be used to determine the number of pass/fail test for a feature/scenario etc.

The `options` parameter has the following structure:
``` ts
class ReporterOptions {
    public colors: ColorTheme;
    public options: Object;
}
```

The options here refer to the mocha reporter options passed.

## Sample reporter
The following is the full source for the included [JSON Reporter](JSON-Reporter.md). It demonstrates how easy it is to create a custom reporter.

```ts
export class JsonReporter implements IPostReporter {
    public execute(results: ExecutionResults, options: any) {
        if (!options || !options["json-output"]) {
            throw Error("json reporter: you must specify an output file");
        }
        const file = options["json-output"];
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }

        // write out the results as a json file
        fs.writeFileSync(file, JSON.stringify(results));
        console.log("Json file: " + fs.realpathSync(file));
    }
}
```
## Included Post Reporters
[JSON Reporter](JSON-Reporter.md) - outputs model as a JSON file.
