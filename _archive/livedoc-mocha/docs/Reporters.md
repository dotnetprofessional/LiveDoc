# Reporters
Livedoc supports two types of reporters:
* [UI Reporter](UI-Reporters.md): Used to output results as the tests are being executed.
* [Post Reporter](Post-Reporters.md): These run after the tests have been executed. A post-reporter receives a JSON object with the results of the test execution.

In mocha a UI Reporter is known simply as a reporter. Livedoc defines these as UI Reporters to clearly identify them as the reporters that will output text as a test is being executed. In Mocha all reporters are executed as the tests are being executed. This causes issues with running multiple reporters. Refer to this discussion on the [mochajs site](https://github.com/mochajs/mocha/pull/2184). To avoid these issues livedoc advocates a single UI Reporter. 

The question then arises, but we need additional reporters to output to a file, or to output as a trx file format. The approach livedoc takes to to refer to these as Post-Reporters, that is they run after the tests have finished executing. These reporters are then provided a rich execution results object that can be easily navigated to produce any output required. There can be any number of these reporters added as they don't run at the same time as the UI Reporters. It also means you can add a Post-Reporter that can output to the screen without interfering with the UI Reporter.

Livedoc ships with one Post-Reporter for outputting the results as a JSON file.

[JSON Reporter](JSON-Reporter.md)

