# Release Notes
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