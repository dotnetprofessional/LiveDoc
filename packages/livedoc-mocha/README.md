> These docs reference livedoc 0.4.0 Beta 2.
> For docs on the current stable version [click here](https://github.com/dotnetprofessional/LiveDoc/tree/b8ddf23d23ed6b65e7f9f5bb2a9bf14b22809e08/packages/livedoc-mocha) 
# LiveDoc-mocha
LiveDoc-mocha is a library for adding behavior using a language called [Gherkin](https://cucumber.io/docs/reference#gherkin) to the mocha testing library. The [Gherkin](https://cucumber.io/docs/reference#gherkin) syntax uses a combination of keywords and natural language. The specifications are written in plain english and are meant to be read by anyone on your team and used to aid in improving collaboration, communication and trust within the team. These specifications also help to reduce ambiguity, confusion about what needs to be built, the rules and importantly why its being built. This is the first step to the concept of [Living Documentation](https://leanpub.com/livingdocumentation).

> NB: If you are viewing this from npmjs.com, links and images may be broken. Please visit the [project site](https://github.com/dotnetprofessional/LiveDoc/blob/master/packages/livedoc-mocha#readme) to view this document.

* [VSCode Plugin](https://marketplace.visualstudio.com/items?itemName=dotNetProfessional.livedoc-vscode)
* [Installing](README.md#Installing)
* [API reference](README.md#api)
* [Command line options](README.md#command-line)
* [Reporters](docs/Reporters.md)
* [Why another library?](README.md#why-another-library)

## So what does this look like?
If we take the following feature which describes an account holder withdrawing money from an ATM. The format is the same as you might use in Cucumber.js, Cucumber, SpecFlow etc.

```Gherkin
Feature: Account Holder withdraws cash

        Account Holders should be able to withdraw cash at any of the
        companies ATMs.

        Rules:
        * Account Holders should have a valid keycard
        * Have sufficient available funds
        * The ATM has the necessary funds

  Scenario: Account has sufficient funds
    Given the account holders account has the following:
        | account | 12345 |
        | balance |   100 |
        | status  | valid |
      And the machine contains 1000 dollars
    When the Account Holder requests 20 dollars
    Then the ATM should dispense 20 dollars
      And the account balance should be 80 dollars
```
When run with livedoc-mocha will produce the following output:

![Mocha Test Result](docs/images/Feature.PNG)

Converting the original Gherkin to livedoc-mocha would looks like this:

```js
feature(`Account Holder withdraws cash

        Account Holders should be able to withdraw cash at any of the
        companies ATMs.

        Rules:
        * Account Holders should have a valid keycard
        * Have sufficient available funds
        * The ATM has the necessary funds
        `, () => {

        scenario("Account has sufficient funds", () => {
            let atm = new ATM();
            let cashReceived: number;

            given(`the account holders account has the following:
            | account | 12345 |
            | balance |   100 |
            | status  | valid |
        `, () => {
                    const accountHolder = stepContext.tableAsEntity;
                    atm.setStatus(accountHolder.account, accountHolder.status);
                    atm.deposit(accountHolder.account, accountHolder.balance)
                });

            and("the machine contains '1000' dollars", () => {
                atm.addCash(stepContext.values[0]);
            });

            when("the Account Holder requests '20' dollars", () => {
                cashReceived = atm.withDraw(scenarioContext.given.tableAsEntity.account, stepContext.values[0]);
            });

            then("the ATM should dispense '20' dollars", () => {
                cashReceived.should.be.equal(stepContext.values[0]);
            });

            and("the account balance should be '80' dollars", () => {
                atm.getBalance(scenarioContext.given.tableAsEntity.account).should.be.equal(stepContext.values[0]);
            });
        });
    });
```

As can be seen by this simple example the actual test code is small and concise as much of the test setup was included as part of the test narrative. This in turn makes the test easier to understand and makes for excellent documentation.

This is just a small example of what can be done with LiveDoc-mocha. To understand more of what it can do, check out the [API documentation](docs/API.md).

The class used for this sample wasn't shown for brevity, however you can find the example [source code here](_src/test/Sample/Example.Spec.ts).

## Installing
This library builds off the mocha.js library as a custom ui. To setup, follow these steps.

__NPM__
```bat
npm install --save-dev livedoc-mocha
```
To get the latest code and bug fixes, you can install the current beta, however this version may have bugs. You can find details of the releases on the [releases tab](https://github.com/dotnetprofessional/LiveDoc/releases).
```bat
npm install --save-dev livedoc-mocha@beta
```

__Mocha__

Livedoc-mocha as the name suggests extends mocha which is a very popular javascript testing library. You will need to install mocha to use livedoc-mocha. You can install mocha with the following command:

``` bat
npm install mocha --save-dev
```
Once you have mocha installed you need to configure mocha to run your tests and to use livedoc-mocha, a basic setup would be running this command from the command line:
```bat
mocha --ui livedoc-mocha --reporter livedoc-mocha/livedoc-spec --recursive path-to-my-tests/
```
The `--reporter` switch makes use of livedocs enchanced reporter specifically designed for Gherkin style Specs. However, this is optional and can be omitted, however the livedoc reporter is highly recommended.

For more details configuring mocha see the official [mocha.js site](http://mochajs.org/).

__Typescript__

If you are using typescript and the keywords are not being recognized add the following import statement to your test file.
```js
import "livedoc-mocha";
```

__Wallaby.js__

If you use [wallaby.js](https://wallabyjs.com/) you can configure livedoc-mocha by adding the following setup to your wallaby.js configuration file. If you already have a setup section then just include the two lines within your existing configuration file, otherwise copy this section to your file.
```js
setup: function (wallaby) {
    require("livedoc-mocha");
    wallaby.testFramework.ui('livedoc-mocha');
}
```
## API
For full details of what's supported see the [__API reference__](docs/API.md)

Also for a brief tutorial on how to write Gherkin specs using livedoc-mocha see the [tutorial](docs/Tutorial.md).

Release notes can be found [here](docs/ReleaseNotes.md)

## Command Line
livedoc-mocha supports the following command line options. 

### Filtering
These are useful when wanting to filter the features/scenarios that you want to run:

* <code>--ld-include</code>: Used to only include features/scenarios that have been marked with the tags provided. Example use would be to only run what's been tagged with @integration. 

example:
```js 
--ld-include "tag1 tag2 tag3"
```
* <code>--ld-exclude</code>: Used to exclude features/scenarios that have been marked with the tags provided. Example use would be run everything __except__ those tagged with @integration. 

example:
```js 
--ld-exclude "tag1 tag2 tag3"
```

* --showFilterConflicts: When used will display conflicted filter matches as pending rather than not showing them at all.

The <code>--ld-include</code> and <code>ld-exclude</code> switches can be used together to both include and exclude features/scenarios. You should note that when specifying the tags you don't include the @ symbol. When a conflict occurs by default the exclude will take precedence. However, there may be times when you want to know what the conflicts were. In that case using the <code>--showFilterConflicts</code> will show the otherwise excluded scenarios but mark them as pending, so they are still not executed.

> For more details on tags and tagging, refer to the [Tags](docs/API.md#tags) documentation in teh API reference.

### Output
It can be useful to have the output sent to a text file. In these cases you can add the following to your command line:

`--reporter-options output=results.txt`

### Reporters
livedoc-mocha supports a new type of reporter called a [post-reporter](docs/Post-Reporters.md), as well as the more traditional reporter known as a [ui-reporter](docs/UI-Reporters.md). To add a new post-reporter use the following:

```--ld-reporters reporter-name```

Post-reporters make use of the same ```--reporter-options``` parameter and so if a reporter requires additional parameters they should be added there. See the following for more details

[Reporters](docs\Reporters.md)

* Reporters: reporters support command line options. Refer to the specific docs on [Reporters](docs/Reporters.md) for more details.
  
# Why another library?
There are a number of different libraries that bring the Gherkin language to javascript and even mocha:

* [Cucumber.js](https://github.com/cucumber/cucumber-js): This is the official javascript implementation of Cucumber which is the Ruby client for Gherkin. It uses a model similar to the Ruby client of .feature files written in plain text, with step files to map to the text representation and provide the implementation of the test/spec.

* [mocha-cakes-2](https://github.com/iensu/mocha-cakes-2): A simple library that provides Gherkin aliases for the default mocha syntax. This library unlike Cucumber.js doesn't use a separate file and keeps the spec description with its implementation, in the same way LiveDoc-mocha does.

There are others too, however they typically fall into the two categories above, either separating the spec from the implementation or combining both.

There are pros and cons to both approaches, however LiveDoc-mocha went with the combining spec and implementation as the additional separation can be hard to maintain. However, if having separate files is your preferred style, then you should consider using [Cucumber.js](https://github.com/cucumber/cucumber-js) for your projects.

While [mocha-cakes-2](https://github.com/iensu/mocha-cakes-2) provides a great starting point, its feature list was limited to simple aliasing. LiveDoc-mocha tries to deliver as much of the full spec as possible. The addition of more advanced features such as Tables, Values, docStrings and Backgrounds brings the experience much closer to the full Gherkin experience without the context switch you can experience with libraries like [Cucumber.js](https://github.com/cucumber/cucumber-js).
