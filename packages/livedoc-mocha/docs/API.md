# API
The livedoc-mocha API implements the [Gherkin](https://cucumber.io/docs/reference#gherkin) language as close as practically possible. For a good description of the Gherkin language refer to the [reference section](https://cucumber.io/docs/reference) on [cucumber.io](https://cucumber.io/).

livedoc-mocha follows the Gherkin language, where each line that isn't blank has to start with a Gherkin keyword, followed by any text you like. The definition for the start of a line is one that ignores any whitespace preceeding the first character. From the reference page of the main [keywords](https://cucumber.io/docs/reference#gherkin) are:

* Feature
* Scenario
* Given, When, Then, And, But (Steps)
* Background
* Scenario Outline
* Examples

To stay in line with the general convention of using lowercase keywords in javascript, each of the above keywords use a lowercase version in livedoc-mocha. As an example the Feature keyword would be <code>feature</code>.

There are a few extra keywords as well:

* """ (Doc Strings) : Used in docStrings.
* | (Data Tables) : Used to define tables
* @ (Tags): not supported
* \# (Comments) : not supported

# Feature
Each file should contain only one feature, although there is no restriction on this. It is more of a convention, which makes finding your features easier. Features have a title and a description.

_Gherkin_
``` Gherkin
Feature: Account Holder withdraws cash

    Account Holders should be able to withdraw cash at any of the
    companies ATMs.

    Rules:
    * Account Holders should have a valid keycard
    * Have sufficient available funds
    * The ATM has the necessary funds`s ago
```

_livedoc-mocha_
```js
feature(`Account Holder withdraws cash

        Account Holders should be able to withdraw cash at any of the
        companies ATMs.

        Rules:
        * Account Holders should have a valid keycard
        * Have sufficient available funds
        * The ATM has the necessary funds`, () => {

    });
```

## Context
Each feature has a context which is defined by the global variable <code>featureContext</code>. This context object has the following properties:

* filename: This is the filename of the Spec file. It is not the fully qualified path. It is just the file name excluding the path.
* title: This is the first line of the feature
* description: This is any line after the first line. In the example above it would be 'Account Holders should be able ...'

# Scenario
Each feature should contain at least one scenario, but can have as many as required. Scenarios, like features support descriptions.

_Gherkin_
``` Gherkin
Scenario: Account has sufficient funds
```

_livedoc-mocha_
```js
scenario("Account has sufficient funds", () => {
});
```
## Context
Each scenario has a context which is defined by the global variable <code>scenarioContext</code>. This context object has the following properties:

* title: This is the first line of the feature
* description: This is any line after the first line.

# [Steps](https://cucumber.io/docs/reference#steps)
Each scenario requires at least one step keyword. The Gherkin step keywords that are supported are:

* __given:__ steps are used to describe the initial context of the system -- the _scene_ of the scenario. It is typically something that happened in the _past_.
* __when:__ steps are used to describe an event, or _an action_. This can be a person interacting with the system, or it can be an event triggered by another system.
* __then:__ steps are used to describe an expected outcome, or result.
* __and:__ add additional context to a given, when or then. During output this step has an additional indent.
* __but:__ provide a negative context to a given, when or then. During output this step has an additional indent.

Each of these keywords are aliases for mochas <code>it</code> keyword, so they are all treated the same by the system. However, using these provide a much more expressive way to describe the specification as shown in the example below.

_Gherkin_
``` Gherkin
Given the account holders account has the following:

    | balance | 100   |
    | status  | valid |
  and the machine contains 1000 dollars
When the Account Holder requests 20 dollars
Then the ATM should dispense 20 dollars
  and the account balance should be 80 dollars
```

_livedoc-mocha_
```js
given(`the account holders account has the following:
| account | 12345 |
| balance | 100   |
| status  | valid |
`, () => {
    });

and("the machine contains '1000' dollars", () => {
});

when("the Account Holder requests '20' dollars", () => {
});

then("the ATM should dispense '20' dollars", () => {
});

and("the account balance should be '80' dollars", () => {
});
```
## Context
Each step has a context which is defined by the global variable <code>stepContext</code>. This context object has the following properties:

* title: This is the first line of the feature
* docString: Used to pass a larger piece of text to a step definition. [Gherkin reference](https://cucumber.io/docs/reference#doc-strings) for more details.
* table: an array of objects where the tables first row is used as the property name.
* tableAsEntity: for tables that have 2 columns, this returns the table as a single entity where the property names are in the first column.
* tableAsList: returns the table as a multi-dimensional array of strings.
* tableAsSingleList: for tables with a single column will return the table as a single dimensional array of strings.
* values: contains an array of values that were provided by specifying a quoted string (" or ') in a step definition title. This is useful when needing to pass only one or two values.
* type: the step definition type given, when then, but, and.

The example shows a number of important values within the titles and descriptions including a table. Livedoc-mocha supports the following features for extracting data from your descriptions and titles.

## [Data Tables](https://cucumber.io/docs/reference#data-tables)
Data Tables are handy for passing a list of values to a step definition. Livedoc-mocha has fully support for Data Tables and several helper methods to make working with them easier. Refer to the context section for more details on the additional properties.

For a table to be valid it must start with a pipe (|) on a new line and end with a pipe(|) on the same line. A table can contain as many columns as necessary. Below are examples of the various table styles and the <code>stepContext</code> methods that can be used to access them.

_Multicolumn table_

```js
given(`Some title here:
  | name   | email              | twitter         |
  | Aslak  | aslak@cucumber.io  | @aslak_hellesoy |
  | Julien | julien@cucumber.io | @jbpros         |
  | Matt   | matt@cucumber.io   | @mattwynne      |
`, () => { });
```

_Methods_

<code>stepContext.table</code> returns an array of objects where the tables first row is used as the property name. This would be the recommended option to use for this style of table.

<code>stepContext.tableAsList</code> returns the table as a multi-dimensional array of strings.

_Two column table_
```js
given(`Some title here:
    | account | 12345 |
    | balance | 100   |
    | status  | valid |
`, () => { });
```

_Methods_

<code>stepContext.table</code> returns an array of objects where the tables first row is used as the property name. Which in this example wouldn't be a good choice :)

<code>stepContext.tableAsList</code> returns the table as a multi-dimensional array of strings.

<code>stepContext.tableAsEntity</code> returns the table as a single entity where the property names are in the first column. This would be the recommended choice for this example as it would allow access such as <code>stepContext.tableAsEntity.balance</code>.

_Single column table_
```js
given(`Some title here:
    | 17   |
    | 42   |
    | 4711 |
`, () => { });
```
_Methods_

<code>stepContext.tableAsList</code> returns the table as a multi-dimensional array of strings.

<code>stepContext.tableAsSingleList</code> returns the table as a simple list of strings. This would be the recommended option to use for this style of table.

# [DocStrings](https://cucumber.io/docs/reference#doc-strings)
Doc Strings are useful for passing a larger piece of text to a step definition. A Doc String must start on a new line and contain with three double-quote marks and be on their own. The subsequent lines should start under the first quote of the line above. When parsing the additional whitespace will be removed so each line begins where the first double-quote mark begins. To end a Doc String, another new line with double-quotes is used.

_Gherkin_
``` Gherkin
Given a blog post named "Random" with Markdown body
  """
  Some Title, Eh?
  ===============
  Here is the first paragraph of my blog post. Lorem ipsum dolor sit amet,
  consectetur adipiscing elit.
  """
```

_livedoc-mocha_
``` js
given(`a blog post named "Random" with Markdown body
    """
    Some Title, Eh?
    ===============
    Here is the first paragraph of my blog post. Lorem ipsum dolor sit amet,
    consectetur adipiscing elit.
    """
`, () => { });
```
A point to note about the javascript above is that it makes use of the back-tick (`) to allow for multi-line statements. This string can then be consumed using the method on the context:

```js
const docString = stepContext.docString;
```
# [Backgound](https://cucumber.io/docs/reference#background)
Backgrounds are an alias for mocha's before hook. They provide a way to define a given that is repeated for all scenarios. As the given is repeated, its an indication that its not necessary to describe the particular scenario but is required to provide context overall.

__Gherkin__
```Gherkin
Background:
  Given a $100 microwave was sold on 2015-11-03
  And today is 2015-11-18
```

__livedoc-mocha__
```js
background(`Given a $100 microwave was sold on 2015-11-03
  And today is 2015-11-18`, () => { });
```

Support for backgrounds is currently limited, as you can't mix other step definitions with them currently. However, they do support the same features of a step definition for defining data. Accessing data from a background is via the <code>backgroundContext</code> global variable.

# Scenario Outlines

__** Coming Soon! **__
