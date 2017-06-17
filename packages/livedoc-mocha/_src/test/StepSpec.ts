///<reference path="../app/livedoc.ts" />
import * as Utils from "./Utils";

require('chai').should();

feature.only(`Step statement
    Step statements are used to define the details of a test, the supported steps are:
        given - sets up the state for the scenario
        when  - defines an action performed by a user/system
        then  - defines the outcome of the when steps
        and   - used by given/when/then to add additional context
        but   - used by given/when/then to provide an exclusion context`, () => {

        scenario("Step statement is just a title", () => {
            let givenTitle = "";
            given(`a simple title`, () => {
                givenTitle = stepContext.title;
            });

            then("the title should match stepContext.title", () => {
                givenTitle.should.be.equal("a simple title");
            });
        });

        scenario("Step statement has a title and a docString", () => {
            let givenTitle = "";
            let docString = "";
            given(`a simple title
                """
                With this docString that
                has multiple lines
                """`, () => {
                    givenTitle = stepContext.title;
                    docString = stepContext.docString;
                });

            then("the title should match stepContext.title", () => {
                givenTitle.should.be.equal("a simple title");
            });

            and("the docString should match stepContext.docString", () => {
                docString.should.be.equal("With this docString that\nhas multiple lines");
            })
        });

        scenario("Step statement is just a title", () => {
            let whenTitle = "";
            when(`a simple title`, () => {
                whenTitle = stepContext.title;
            });

            then("the title should match stepContext.title", () => {
                whenTitle.should.be.equal("a simple title");
            });
        });

        scenario("Step statement has a title and a docString", () => {
            let givenTitle = "";
            let docString = "";
            given(`a simple title
                """
                With this docString that
                has multiple lines
                1
                2
                3
                4
                """`, () => {
                    givenTitle = stepContext.title;
                    docString = stepContext.docString;
                });

            then("the title should match stepContext.title", () => {
                givenTitle.should.be.equal("a simple title");
            });

            and("the docString should match stepContext.docString", () => {
                docString.should.be.equal("With this docString that\nhas multiple lines\n1\n2\n3\n4");
            })
        });

        scenario("Step statement has a title and a docString that is valid json", () => {
            let givenTitle = "";
            given(`a simple title
                """
                {
                    "name":"John",
                    "address": "123 Street"
                }
                """`, () => {
                    givenTitle = stepContext.title;
                });

            then("the title should match stepContext.title", () => {
                givenTitle.should.be.equal("a simple title");
            });

            and("the docStringAsEntity should return an object with the correct properties", () => {
                const docString = scenarioContext.given.docStringAsEntity;
                docString.name.should.be.equal("John");
                docString.address.should.be.equal("123 Street");
            })
        });

        scenario("Step statement has a title and a table", () => {

            given(`a simple title has a table

                | name    | email               | twitter          |
                | Aslak   | aslak@cucumber.io   | @aslak_hellesoy  |
                | Julien  | julien@cucumber.io  | @jbpros          |
                | Matt    | matt@cucumber.io    | @mattwynne       |

                This is a table above!!
            `, () => { });

            then("the title should match stepContext.title", () => {
                scenarioContext.given.title.should.be.equal("a simple title has a table");
            });

            and("the table should match stepContext.table", () => {
                const table = scenarioContext.given.table;
                table.length.should.be.equal(3);
                table[0].name.should.be.equal("Aslak");
                table[0].email.should.be.equal("aslak@cucumber.io");
                table[0].twitter.should.be.equal("@aslak_hellesoy");
                table[2].name.should.be.equal("Matt");
                table[2].email.should.be.equal("matt@cucumber.io");
                table[2].twitter.should.be.equal("@mattwynne");
            });
        });

        scenario("Step statement has a two column table with names in first column", () => {
            let stepTitle = "";
            let entity: Row;
            when(`a simple title has a table

                | name     | Aslak              |
                | email    | aslak@cucumber.io  |
                | twitter  | @aslak_hellesoy    |
                | address  |           1 street |

                This is a table above!!
            `, () => {
                    stepTitle = stepContext.title;
                    entity = stepContext.tableAsEntity;
                });

            then("the table should be convertible to an entity using stepContext.tableToEntity", () => {
                entity.name.should.be.equal("Aslak");
                entity.email.should.be.equal("aslak@cucumber.io");
                entity.twitter.should.be.equal("@aslak_hellesoy");
                entity.address.should.be.equal("1 street");
            })
        });

        scenario("Step statement has a single column of values as a table", () => {
            given(`a simple title has a table of values

                |    17 |
                |    42 |
                |  4711 |

                This is a table above!!
            `, () => { });

            then("the table should be convertible to a list using stepContext.tableToList", () => {
                // Add the numbers up
                let total = 0;
                const list = scenarioContext.given.tableAsSingleList;
                for (let i = 0; i < list.length; i++) {
                    total += list[i];
                }

                total.should.be.equal(4770);
            })
        });

        scenario("Step statement has a column of values of different intrinsic types as a table", () => {
            given(`a simple title has a table of values

                | string        | test                  |
                | number        |                  1234 |
                | booleanTrue   | true                  |
                | booleanFalse  | false                 |
                | array         | ["hello", "Goodbye"]  |

            `, () => { });

            then("the table should be convertible to a list using stepContext.tableToList and have each type be its intrinsic type not just string", () => {
                // Add the numbers up
                const entity = scenarioContext.given.tableAsEntity;

                (typeof entity.string).should.be.equal("string");
                (typeof entity.number).should.be.equal("number");
                (typeof entity.booleanTrue).should.be.equal("boolean");
                (typeof entity.booleanFalse).should.be.equal("boolean");
                (typeof entity.array).should.be.equal("object");
                entity.array[0].should.be.equal("hello");
                entity.array[1].should.be.equal("Goodbye");

            })
        });

        scenario("Step statement uses quoted \" values to define values ", () => {
            let stepValues: string[];
            when(`a title has "this value" and "that value"`, () => {
                stepValues = stepContext.values;
            });

            then("contextStep.values should have '2' items", () => {
                stepValues.length.should.be.equal(stepContext.values[0]);
            });

            and("the two values should be available via contextStep.values", () => {
                stepValues[0].should.be.equal("this value");
                stepValues[1].should.be.equal("that value");
            });

        });

        scenario("Step statement uses quoted ' values to define values ", () => {
            let stepValues: string[];
            when(`a title has 'this value2' and 'that value2'`, () => {
                stepValues = stepContext.values;
            });

            then("contextStep.values should have '2' items", () => {
                stepValues.length.should.be.equal(stepContext.values[0]);
            });

            and("the two values should be available via contextStep.values", () => {
                stepValues[0].should.be.equal("this value2");
                stepValues[1].should.be.equal("that value2");
            });

            and("quoted values should support multiple types: number: '1234'", () => {
                (typeof stepContext.values[0]).should.be.equal("number");
            });

            and("quoted values should support multiple types: boolean: 'true' or 'false'", () => {
                (typeof stepContext.values[0]).should.be.equal("boolean");
            });

            and("quoted values should support multiple types: array: '[1, 3, 4, 5]'", () => {
                (typeof stepContext.values[0]).should.be.equal("object");
                stepContext.values[0][0].should.be.equal(1);
            });
        });

        feature("Step statements should support async operations", () => {
            let value = 0;
            when(`a step is testing code that is async`, async () => {
                value = 10;
                await Utils.sleep(10);
                value = 20;
            });

            then("the test should continue after the async operation", () => {
                value.should.be.equal(20);
            });
        });

    });
