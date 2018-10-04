# JSON Reporter

The JSON reporter outputs the results of the test execution as a JSON file. This output then then be used for post processing or reporting such as creating custom documentation.

## Configuration
To configure the reporter add the following to the commandline:

```
--ld-reporters livedoc/livedoc-json -reporter-options json-output=results.json
```

If you're also using the livedoc spec reporter or another UI reporter then you need to configure like the following:

```
--reporter livedoc/livedoc-spec --ld-reporters livedoc/livedoc-json --reporter-options \"detailLevel=summary,json-output=results.json\"
```
The main thing to notice is that Post Reporters share the same `--reporter-options` parameter, with multiple parameters being seperated by a `,`. The json reporter uses the `json-output` key.