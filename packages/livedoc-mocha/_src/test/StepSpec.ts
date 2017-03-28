///<reference path="../app/livedoc.ts" />

var chai = require('chai')
    , expect = chai.expect
    , should = chai.should();

feature(`Step statement

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
            let whenTitle = "";
            let docString = "";
            when(`a simple title
                """
                With this docString that
                has multiple lines
                """`, () => {
                    whenTitle = stepContext.title;
                    docString = stepContext.docString;
                });

            then("the title should match stepContext.title", () => {
                whenTitle.should.be.equal("a simple title");
            });

            and("the docString should match stepContext.docString", () => {
                docString.should.be.equal("With this docString that\nhas multiple lines");
            })
        });

        scenario("Step statement has a title and a table", () => {
            let stepTitle = "";
            let table: Row[];
            let whenContext: StepContext;

            when(`a simple title has a table

                | name   | email              | twitter         |
                | Aslak  | aslak@cucumber.io  | @aslak_hellesoy |
                | Julien | julien@cucumber.io | @jbpros         |
                | Matt   | matt@cucumber.io   | @mattwynne      |

                This is a table above!!
            `, () => {
                    stepTitle = stepContext.title;
                    table = stepContext.table;
                    whenContext = stepContext;
                });

            then("the title should match stepContext.title", () => {
                stepTitle.should.be.equal("a simple title has a table");
            });

            and("the table should match stepContext.table", () => {
                table.length.should.be.equal(3);
                table[0].name.should.be.equal("Aslak");
                table[0].email.should.be.equal("aslak@cucumber.io");
                table[0].twitter.should.be.equal("@aslak_hellesoy");
                table[2].name.should.be.equal("Matt");
                table[2].email.should.be.equal("matt@cucumber.io");
                table[2].twitter.should.be.equal("@mattwynne");
            });

            but("not be convertible to an entity using stepContext.tableToEntity", () => {
                should.throw(() => { whenContext.tableToEntity() }, "tables must be two columns")
            });
        });

        scenario("Step statement has a two column table with names in first column", () => {
            let stepTitle = "";
            let entity: Row;
            when(`a simple title has a table

                | name    | Aslak              |
                | email   | aslak@cucumber.io  |
                | twitter | @aslak_hellesoy    |
                | address | 1 street           |

                This is a table above!!
            `, () => {
                    stepTitle = stepContext.title;
                    entity = stepContext.tableToEntity();
                });

            then("the table should be convertible to an entity using stepContext.tableToEntity", () => {
                entity.name.should.be.equal("Aslak");
                entity.email.should.be.equal("aslak@cucumber.io");
                entity.twitter.should.be.equal("@aslak_hellesoy");
                entity.address.should.be.equal("1 street");
            })
        });

        scenario("Step statement has a single column of values as a table", () => {
            let stepTitle = "";
            let list: string[];
            when(`a simple title has a table of values

                | 17   |
                | 42   |
                | 4711 |

                This is a table above!!
            `, () => {
                    stepTitle = stepContext.title;
                    list = stepContext.tableToList();
                });

            then("the table should be convertible to a list using stepContext.tableToList", () => {
                // Add the numbers up
                let total = 0;
                for (let i = 0; i < list.length; i++) {
                    total += Number(list[i]);
                }

                total.should.be.equal(4770);
            })
        });

        scenario("Step statement uses quoted \" values to define values ", () => {
            let stepValues: string[];
            when(`a title has "this value" and "that value"`, () => {
                stepValues = stepContext.values;
            });

            then("contextStep.values should have '2' items", () => {
                stepValues.length.should.be.equal(Number(stepContext.values[0]));
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
                stepValues.length.should.be.equal(Number(stepContext.values[0]));
            });

            and("the two values should be available via contextStep.values", () => {
                stepValues[0].should.be.equal("this value2");
                stepValues[1].should.be.equal("that value2");
            });

        });
    });
