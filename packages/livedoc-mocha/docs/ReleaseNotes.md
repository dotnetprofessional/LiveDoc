# Release Notes

## 0.4.0-beta-5
* Bug: [#81](https://github.com/dotnetprofessional/LiveDoc/issues/81) livedoc-spec doesn't report errors using process exitcode
* Bug: [#54](https://github.com/dotnetprofessional/LiveDoc/issues/54) Fixed issue with using .only and backgrounds 

### additional with no issue logged
* Added whitespace after Background and Features
* Fixed some tests
* added word wrapping to livedoc-spec reporter when data is contained within a table.
* fixed issue with filename in reported error not being mapped to source file

## 0.4.0-beta-3/4
* Fixing corrupt package

## 0.4.0-beta-2
* Refactor: [#62](https://github.com/dotnetprofessional/LiveDoc/issues/62) Convert to use ES6 modules
* Feature: [#50](https://github.com/dotnetprofessional/LiveDoc/issues/50) Add support to highlight scenarioOutline parameters
* Feature: [#66](https://github.com/dotnetprofessional/LiveDoc/issues/66) Add custom reporter

* Bug: [#56](https://github.com/dotnetprofessional/LiveDoc/issues/56) Filtering by tag runs all tests if filter doesn't exist. This now works but only for Mocha versions less than v4.0. A new strategy is required for newer versions. 
* Bug: [#70](https://github.com/dotnetprofessional/LiveDoc/issues/70) Errors occurring in Background not displaying
* Bug: [#71](https://github.com/dotnetprofessional/LiveDoc/issues/71) Reporter fails when actual/expected are not strings
* Bug: [#74](https://github.com/dotnetprofessional/LiveDoc/issues/74) Add rule to prevent duplicate sceanrio names within a Feature

### additional with no issue logged
* ** BREAKING CHANGE** Enforced properly structured Gherkin. Removed some rule violation settings allowing mixing BDD and Gherkin. This needed to be removed to properly support reporting.
* Added execution results to model
* Reorganized and improved Specs and implemented Specs for areas that previously were manual or thew expected exceptions.
* Added support to run Specs directly and receive an ExecutionResult object with the results of all Specs executed. This feature allowed verification of any scenario including failing ones. This will be useful for 3rd party integrations and for the VSCode plugin.
* Added limited livedoc support to other bdd ui's such as describe. This is to allow stock mocha to make use of future reporting. 
* Added isolation of global livedoc object for supplying options. It will now be used as the basis for options but other ways to provide options such as via mocha.options and commandline will either extend or override the settings. If possible options should be passed via mocha.options if executing via code otherwise use the command line.
* added support for post-reporters via the ld-reporters command line. This provides a new type of reporter that are executed post the standard reporter or ui-reporter. This is used for such things as trx, json or any other post reporting needs.
* added livedoc-json reporter that will output the execution results as a json file to be consumed by 3rd party reporters
* upgrade dependencies including typescript to 2.9.1

## 0.3.4
* Feature: [#52](https://github.com/dotnetprofessional/LiveDoc/issues/52) Support filtering by tags  
* Feature: [#53](https://github.com/dotnetprofessional/LiveDoc/issues/53) Support explicit and implicit tagging  
* Feature: [#54](https://github.com/dotnetprofessional/LiveDoc/issues/54) When using .only or filters ensure backgrounds are always executed 
* Docs: Updated docs and refactored them to be clearer.

## 0.3.3 
* Feature: [#38](https://github.com/dotnetprofessional/LiveDoc/issues/38) Support comments for Scenario Outlines  
* Feature: [#46](https://github.com/dotnetprofessional/LiveDoc/issues/46) Throw exception when using Async for Feature/Scenario/ScenarioOutline/Background  

* Bug: [#45](https://github.com/dotnetprofessional/LiveDoc/issues/45) Background doesn't support async on multiple scenarios  

## 0.3.2 
* Bug: [#42](https://github.com/dotnetprofessional/LiveDoc/issues/42) Exception when using it.skip() 

## 0.3.1 
* Feature: [#35](https://github.com/dotnetprofessional/LiveDoc/issues/35) Scenario outline tests not run if table is not labelled with "Examples:"
* Feature: [#37](https://github.com/dotnetprofessional/LiveDoc/issues/37) Make warnings more contextual

* Bug: [#36](https://github.com/dotnetprofessional/LiveDoc/issues/36) Context leakage

## 0.3.0 
* Feature: [#24](https://github.com/dotnetprofessional/LiveDoc/issues/24) Enforce correct Gherkin structure 
* Feature: [#25](https://github.com/dotnetprofessional/LiveDoc/issues/25) Refactor code 
* updated docs

* Bug: [#13](https://github.com/dotnetprofessional/LiveDoc/issues/13) docString incorrectly formats contents
* Bug: [#19](https://github.com/dotnetprofessional/LiveDoc/issues/19) Auto type conversion is incorrect for the number 0
* Bug: [#23](https://github.com/dotnetprofessional/LiveDoc/issues/23) Parse errors in scenarioOutline cause tests to pass with no tests run 
* Bug: [#26](https://github.com/dotnetprofessional/LiveDoc/issues/26) Exceptions are not being reported correctly  
* Bug: [#27](https://github.com/dotnetprofessional/LiveDoc/issues/27) Scenario Outline column names with headers not binding in title
* Bug: [#29](https://github.com/dotnetprofessional/LiveDoc/issues/29) Exception when using .skip
* Bug: [#31](https://github.com/dotnetprofessional/LiveDoc/issues/31) .only not supported on scenarioOutline 

## 0.2.2 - beta
* Feature: [#15](https://github.com/dotnetprofessional/LiveDoc/issues/15) - Support Background cleanup
* Feature: [#12](https://github.com/dotnetprofessional/LiveDoc/issues/12) - Add docStringAsEntity
* Added additional support for coercion of values for tables and quoted values

* Bug: [#14](https://github.com/dotnetprofessional/LiveDoc/issues/14) - stepContext incorrect while in Background steps

## 0.2.1 - beta
* Feature [#11](https://github.com/dotnetprofessional/LiveDoc/issues/11) - adding tag support

* Bug: [#10](https://github.com/dotnetprofessional/LiveDoc/issues/10) - docString on stepContext not returning full result

## 0.2.0
* Feature complete - support for all important Gherkin language features
* Added support for Scenario Outlines issue: [#6](https://github.com/dotnetprofessional/LiveDoc/issues/6)
* Fixed bug [#7](https://github.com/dotnetprofessional/LiveDoc/issues/7)
* Fixed bug [#8](https://github.com/dotnetprofessional/LiveDoc/issues/8)

## 0.1.3
* First stable release to NPM
* Support various operations on tables [#1](https://github.com/dotnetprofessional/LiveDoc/issues/1)
* ES5 support [#5](https://github.com/dotnetprofessional/LiveDoc/issues/5)

> If you discover any issues please submit a bug report [here](https://github.com/dotnetprofessional/LiveDoc/issues)