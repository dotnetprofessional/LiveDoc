# livedoc reporter
livedoc comes with its own reporter which is better tailored for the Gherkin language. While the default `spec` reporter can be used, its recommended that the livedoc reporter be used instead.

The livedoc reporter provides the following features:
* Colorized (optional) output highlighting values and example data when output.
* Better context for failing Specs, by providing the full scenario detail as part of the error output.
* Better support for Scenario Outlines, by outputting the Scenario Outline first then the examples.
* Support for 3 levels of detail
* Output to a file

Add the following command line switch to use the livedoc reporter

```ps
--reporter livedoc-mocha/livedoc-spec
```

## Reporter Options
The livedoc reporter supports the following switches:

### --output \<filename>
Will write the output of the test run to a file, stripping any ANSI color codes.

### --reporter-options | -O
Supported options are:
* detailLevel: This controls the level of information reported.
    * spec - displays the spec details and is the most verbose
    * summary - displays a table of the features with statistics
    * list - provides additional level to summary including scenarios
    * silent - produces no output

The detailLevel options can be combined using a '+' to achieve the desired outcome. To include the spec and summary options you would write:
```
--reporter-options detailLevel=spec+summary
``` 
Regardless of the level selected, when a failure occurs the failure detail will be displayed a the end of the output. For large projects, its recommended to use the `summary` option when running all Specs and the `spec` option when debugging a single Spec.

If not specified the default option will be 
```
spec+summary
```

### Output result as JSON
The test run can also be output as a JSON file. This for example can be used to generate custom reporting such as Living Documentation. The output includes a lot of detail of the test run and the results.

```

```



