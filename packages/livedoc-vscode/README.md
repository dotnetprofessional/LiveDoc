# livedoc VS Code Extension

livedoc is a BBD/Gherkin implementation for Javascript. This extension provides formatting and snippets
that make creating Gherkin tests easier.

* [Features](#features)

* [Using](#using)

* [Configuration](#configuration)

< INSERT GIF HERE >

# Features
* Formatting of Scenario Outline tables and Data Tables
* Code snippets

## Code Snippets
snippet              | purpose
---                  |---
ld-feature           | Adds a basic feature definition.
ld-background        | Adds a basic background definition.
ld-scenario          | Adds a basic scenario definition
ld-scenario-outline  | Adds a basic scenario outline definition.
ld-given             | Adds a basic given step definition.
ld-when              | Adds a basic when step definition.
ld-then              | Adds a basic then step definition.
ld-and               | Adds a basic and step definition.
ld-but               | Adds a basic but step definition.
ld-step              | Adds a step definition where you can choose the type from given, when, then, and, but
ld-step-datatable    | Extends ```ld-step``` including a 2x1 data table in the description
ld-step-datatable-4x | Extends ```ld-step``` including a 4x1 data table in the description  
ld-step-docString    | Extends ```ld-step``` including a docString in the description

# Using
This extension assumes the livedoc-mocha javascript library is installed. This can be done with the following command

``` ps
> npm install livedoc-mocha
```

For full details on this powerful library see the [project site](https://github.com/dotnetprofessional/LiveDoc/tree/master/packages/livedoc-mocha#livedoc-mocha)
