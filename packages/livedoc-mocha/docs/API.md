# API
The livedoc-mocha API implements the [Gherkin](https://docs.cucumber.io/gherkin/reference#gherkin) language as close as practically possible. For a good description of the Gherkin language refer to the [reference section](https://docs.cucumber.io/gherkin/reference) on [cucumber.io](https://cucumber.io/).

livedoc-mocha follows the Gherkin language, livedoc-mocha uses global functions to represent each Gherkin keyword. Each keyword accepts a string that describes the Gherkin language. More background details on the language can be found on this [reference page](https://docs.cucumber.io/gherkin/reference#gherkin). The supported keywords are:

* [Feature](#feature)
* [Background](#background)
* [Scenario](#scenario)
* [Scenario Outline](#scenario-outline)
* [Steps](#steps): Given, When, Then, And, But (Steps)
* [Type Coercion Support](#type-coercion-support)
* [Async Support](#async-support)

To stay in line with the general convention of using lowercase keywords in javascript, each of the above keywords use a lowercase version in livedoc-mocha. As an example the Feature keyword would be <code>feature</code>.

There are a few extra keywords as well:

* """ ([Doc Strings](#docstrings)) : Used in docStrings.
* | ([Data Tables](#data-tables)) : Used to define tables
* @ ([Tags](#tags)): Used by reporting tools to navigate specs and to provide cross references
* \# (Comments) :

# [Feature](https://docs.cucumber.io/gherkin/reference#feature)
Each file should contain only one feature, although there is no restriction on this. It is more of a convention, which makes finding your features easier. Features have a title and a description. Each feature is made up of one or more of the following:

* [Background](#background)
* [Scenario](#scenario)
* [Scenario Outline](#scenario-outline)

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

* __filename:__ This is the filename of the Spec file. It is not the fully qualified path. It is just the file name excluding the path.
* __title:__ This is the first line of the feature
* __description:__ This is any line after the first line. In the example above it would be 'Account Holders should be able ...'


# [Background](https://docs.cucumber.io/gherkin/reference#background)
Backgrounds provide a way to define a given that is repeated for all scenarios. As the given is repeated, its an indication that its not necessary to describe the particular scenario but is required to provide context overall. Backgrounds have a <code>backgroundContext</code> that share the same properties as the <code>scenarioContext</code>, see details on scenarios for details.

_Gherkin_
```Gherkin
Background:
  Given a $100 microwave was sold on 2015-11-03
  And today is 2015-11-18
```

_livedoc-mocha_
```js
background("This will be executed before each test", () => {
    given("Given a '100' dollar microwave was sold on '2015-11-03'", () => {
    });

    and("today is '2015-11-18'", () => {
    });
});
```

There may be times when you need to reset some state tht was created by the Background after each scenario has run. Typically in mocha you might use the <code>after</code> function. However, this applies to tests or <code>it</code> statements. Backgrounds work at the scenario or <code>describe</code> level. It would therefore be necessary to repeat the same clean up code within each scenario using the default mocha approach.  Livedoc-mocha provides an additional function which will work at the scenario level.

_livedoc-mocha_
```js
background("This will be executed before each test", () => {
    given("Given a '100' dollar microwave was sold on '2015-11-03'", () => {
    });

    and("today is '2015-11-18'", () => {
    });

    afterBackground(() => {
        // Clean up code here...
    });
});
```

# [Scenario](https://docs.cucumber.io/gherkin/reference#scenario)
Each feature should contain at least one scenario, but can have as many as required. Scenarios, like features support descriptions. Scenarios support the following features:

* [Steps](#steps)
* [Data Tables](#data-tables)
* [DocStrings](#docstrings)

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

* __title:__ This is the first line of the feature
* __description:__ This is any line after the first line.

To make it easier to access any data defined using the given step definition (see Steps) the <code>scenarioContext</code> also includes the following properties:

* __given:__ the <code>stepContext</code> for the given step definition. This is very useful to get the context that was setup by the given step definition.
* __and:__ an array of additional <code>stepContext</code>s that were used to define the given step definition

Using these properties its easy to access the given definition without having to store the <code>stepContext</code> in local variables.

# [Steps](https://docs.cucumber.io/gherkin/reference#steps)
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

    | balance |   100 |
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
| balance |   100 |
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

* __title:__ This is the first line of the step definition
* __docString:__ Used to pass a larger piece of text to a step definition. See [Gherkin reference](https://docs.cucumber.io/gherkin/reference#doc-strings) for more details.
* __table:__ an array of objects where the tables first row is used as a header row to define the property names.
* __tableAsEntity:__ for tables that have 2 columns, this returns the table as a single entity where the property names are in the first column.
* __tableAsList:__ returns the table as a multi-dimensional array.
* __tableAsSingleList:__ for tables with a single column will return the table as a single dimensional array.
* __values:__ contains an array of values that were provided by specifying a quoted string (" or ') in a step definition title. This is useful when needing to pass only one or two values.
* __type:__ the step definition type given, when then, but, and.

The previous example demonstrates a number of important values within the title and descriptions including a table. Livedoc-mocha supports many ways of extracting data from your descriptions and titles. Each of the features below and the <code>values</code> property support [type coercion](#type-coercion-support) when returning values.

## [Data Tables](https://docs.cucumber.io/gherkin/reference#data-tables)
Data Tables are handy for passing a list of values to a step definition. Livedoc-mocha has full support for Data Tables and several helper methods to make working with them easier. Refer to the [context section](#context) for more details on the additional properties.

For a table to be valid it must start with a pipe (|) on a new line and end with a pipe(|) on the same line. A table can contain as many columns as necessary. While its not a requirement to format the table, the table will be output without formatting, so making the columns align will aid in the tables readability.

Below are examples of the various table styles and the <code>stepContext</code> methods that can be used to access them.

_Multicolumn table_

```js
given(`Some title here:
  |  name  |       email        |     twitter     |
  | Aslak  | aslak@cucumber.io  | @aslak_hellesoy |
  | Julien | julien@cucumber.io | @jbpros         |
  | Matt   | matt@cucumber.io   | @mattwynne      |
`, () => { });
```

_Methods_

<code>stepContext.table</code> returns an array of objects where the tables first row is used as the property name. This would be the recommended option to use for this style of table.

<code>stepContext.tableAsList</code> returns the table as a multi-dimensional array.

_Two column table_
```js
given(`Some title here:
    | account | 12345 |
    | balance |   100 |
    | status  | valid |
`, () => { });
```

_Methods_

<code>stepContext.table</code> returns an array of objects where the tables first row is used as the property name. Which in this example wouldn't be a good choice :)

<code>stepContext.tableAsList</code> returns the table as a multi-dimensional array.

<code>stepContext.tableAsEntity</code> returns the table as a single entity where the property names are in the first column. This would be the recommended choice for this example as it would allow access such as <code>stepContext.tableAsEntity.balance</code>.

_Single column table_
```js
given(`Some title here:
    |    17|
    |   42 |
    | 4711 |
`, () => { });
```
_Methods_

<code>stepContext.tableAsList</code> returns the table as a multi-dimensional array of strings.

<code>stepContext.tableAsSingleList</code> returns the table as a simple list. This would be the recommended option to use for this style of table.

## [DocStrings](https://docs.cucumber.io/gherkin/reference#doc-strings)
Doc Strings are useful for passing a larger piece of text to a step definition. A Doc String must start on a new line and start with three double-quote marks and be on their own. The subsequent lines should start under the first quote of the line above. When parsing the additional whitespace will be removed so each line begins where the first double-quote mark begins. To end a Doc String, another new line with three double-quotes is used.

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

As a convienience, there is also a method that will automatically convert the docString into an entity if its in a valid JSON format.

``` js
given(`an address with valid JSON
    """
    {
        "name":"John",
        "address": "123 Street"
    }
    """
`, () => { });
```

```js
const docString = stepContext.docStringAsEntity;
let name = docString.name;
```

# [Scenario Outline](https://docs.cucumber.io/gherkin/reference#scenario-outline)
There are occasions where you want to validate several values against the same scenario. Creating the individual scenarios would require a lot of duplicate code. A Scenario Outline provides the ability to create a single Scenario but have it run against many examples. A Scenario Outline supports the same features of a Scenario but with the addition of Examples:

_Gherkin_
``` Gherkin
Scenario Outline: feeding a suckler cow
  Given the cow weighs <weight> kg
  When we calculate the feeding requirements
  Then the energy should be <energy> MJ
  And the protein should be <protein> kg

  Examples:
    | weight | energy | protein |
    |    450 |  26500 |     215 |
    |    500 |  29500 |     245 |
    |    575 |  31500 |     255 |
    |    600 |  37000 |     305 |
```

_livedoc-mocha_
```js
scenarioOutline(`feeding a suckler cow

Examples:
    | weight | energy | protein |
    |    450 |  26500 |     215 |
    |    500 |  29500 |     245 |
    |    575 |  31500 |     255 |
    |    600 |  37000 |     305 |
`, () => {
        given("the cow weighs <weight> kg", () => {
        });

        when("we calculate the feeding requirements", () => {

        });

        then("the energy should be <energy> MJ", () => {

        });

        and("the protein should be <protein> kg", () => {

        });
    });
```
Each row of an example describes a single set of data that can be used during the execution of the scenario. The example above will execute this scenario 4 times with each iteration having access to the values of weight, energy and protein for the row being executed.

Unlike Cucumber, examples are not defined at the end of the Scenario Outline, but are included as part of the Scenario Outline narrative. This tends to make it easier to reason about the examples as its not lost at the bottom of the scenario.

To reference values from the example you can specify the name in angle brackets \<name\> which will be resolved when the scenario is run. Its recommended to reference at least one of these values in at least one of your steps so that each iteration can be distinguished from another.

>Its important to include the text __Examples:__ above your table. If you do not your table will not be recognized and your scenarios will not run.

### Multiple tables
Gherkin and livedoc-mocha support the ability to add more than one table to your Scenario Outline. This can be useful to more clearly define your examples. However, when the scenarios are executed they will be merged into a single table. As such your tables much have the same structure. This is only useful for making your scenarios clearer.

 _livedoc-mocha_
```js
scenarioOutline(`feeding a suckler cow

Examples: Young cows
    | weight | energy | protein |
    |    450 |  26500 |     215 |
    |    500 |  29500 |     245 |

Examples: Older cows
    | weight | energy | protein |
    |    575 |  31500 |     255 |
    |    600 |  37000 |     305 |

`, () => {
        given("the cow weighs <weight> kg", () => {
        });

        when("we calculate the feeding requirements", () => {

        });

        then("the energy should be <energy> MJ", () => {

        });

        and("the protein should be <protein> kg", () => {

        });
    });
```

This example is the same as the previous one and will execute and output the exact same way. However, it provides a little more context on the examples being used. The younger cows are lighter than the older cows. They have been separated for the purpose of adding additional context about their weights.

> During development you may want to temporarily skip some examples to focus on one. In this situation you can comment out the lines in the table you don't want to execute and they will be ignored during execution.

## Context
Each step within a Scenario Outline has a access to context which is defined by the global variable <code>scenarioOutlineContext</code>. This context object has the same properties as <code>scenarioContext</code> with the additional property:

* __example:__ the row from the example expressed as an entity object, that is currently being used by the scenario.

# [Tags](https://docs.cucumber.io/gherkin/reference#tags)
Tags are a way to group Scenarios. They are @-prefixed strings and you can place as many tags as you like within a Feature, Scenario or Scenario Outline. Using a space character is not allowed in tags and are instead used to separate them.

Using the first example, you would add tags in the following way:

_Gherkin_
``` Gherkin
@account @atm @important
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
        @account atm
        @important

        Account Holders should be able to withdraw cash at any of the
        companies ATMs.

        Rules:
        * Account Holders should have a valid keycard
        * Have sufficient available funds
        * The ATM has the necessary funds`, () => {

    });
```

Livedoc-mocha forgoes the need to prefix each tag with an @ sign, as is done in Cucumber. It is also possible to use multiple lines for your tags. When doing so the first tag must be prefixed with an @.

## Type Coercion Support
livedoc-mocha supports type coercion to make using your data in your tests easier. Any time data is retrieved via a context, it will be coerced. The following table shows the supported types:

    | type          | example              |
    | number        |                 1234 |
    | numberZero    |                    0 |
    | boolean true  | true                 |
    | boolean false | false                |
    | array         | ["hello", "Goodbye"] |
    | object        | {"prop": "Goodbye"}  |
    | null values   | null                 |
    | USDate        | 01/02/2019           |
    | ISODate       | 2019-01-02           |
    | spaces        | " "                  |
    | quotes        | " a \\" is here"     |

In general type coercion is handled by attempting to JSON.parse the value and if that fails will fall back to returning the original string. Dates are a special case and there is support for two common formats [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) and a simple US date format (mm/dd/yyyy).

## Async Support
Livedoc-mocha supports the async/await syntax for writing tests. However, there are a few minor limitations which need to be kept in mind when using this feature.

_Example_
```js
scenario("Step statements should support async operations", () => {
    let value = 0;
    // tslint:disable-next-line:no-empty
    when(`a step is testing code that is async`, async () => {
        value = 10;
        await Utils.sleep(10);
        value = 20;
    });

    then("the test should continue after the async operation", () => {
        value.should.be.equal(20);
    });
});
```

This example demonstrates how to use the async/await keywords. The function must return a promise or use the <code>async</code> keyword and the call to the async function must be proceeded with the <code>await</code> keyword.

> __NOTE:__ mocha does not support Async on describe or context functions. As such livedoc-mocha does not support Async operations on feature, background, scenario or scenarioOutline. To ensure mistakes are not made livedoc-mocha will throw an exception letting you know if you try to use an unsupported scenario.