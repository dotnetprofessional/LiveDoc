![logo](artwork/logo-small.png)
# LiveDoc

A Living Documentation platform for BDD projects using a javascript/typescript testing library. The project is made up of two parts:

* __Part I:__ A Gherkin language extension for [mochajs](mochajs.org). The mocha extension can be found here: [livedoc-mocha](packages/livedoc-mocha#readme).

![Mocha Test Result](packages/livedoc-mocha/docs/images/livedoc-spec-default.PNG)

* __Part II:__ provide a reporting tools for displaying the output of the specifications. This phase is where we take the test output in Gherkin and make it usable as Living Documentation. The idea is to make navigation and discovery of the specifications easy and insightful. Today [livedoc-mocha](packages/livedoc-mocha/docs/JSON-Reporter.md) provides the ability to export a rich `json` file to build custom reports.
