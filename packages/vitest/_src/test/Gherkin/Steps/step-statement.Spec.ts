import { feature, scenario, scenarioOutline, given, when, Then as then, and, LiveDoc } from "../../../app/livedoc";
import { ExecutionResults } from "../../../app/model/ExecutionResults";
import { SpecStatus } from "../../../app/model/SpecStatus";
import * as Utils from '../../Utils';
import * as chai from 'chai';
chai.should();

feature(`Step statement
    Step statements are used to define the details of a test, the supported steps are:
        given - sets up the state for the scenario
        when  - defines an action performed by a user/system
        then  - defines the outcome of the when steps
        and   - used by given/when/then to add additional context
        but   - used by given/when/then to provide an exclusion context`
    , (ctx) => {

    scenario("given step statement is just a title", (ctx) => {
        let givenTitle = "";
        given(`a simple title`, (ctx) => {
            givenTitle = ctx.step!.title;
        });

        when("using the stepContext", (ctx) => { });

        then("the title should match stepContext.title", (ctx) => {
            givenTitle.should.be.equal("a simple title");
        });
    });

    scenario("Step statement has a docString that includes significant spaces", (ctx) => {
        let docString = "";
        given(`a simple title
                """
                    This string is indented
                    so they should be honoured
                """`, (ctx) => {
            docString = ctx.step!.docString;
        });

        when("using the stepContext", (ctx) => { });

        then("the docString should match stepContext.docString including the significant spaces", (ctx) => {
            chai.expect(docString).to.equal("    This string is indented\n    so they should be honoured");
        });
    });

    scenario("when step statement is just a title", (ctx) => {
        let whenTitle = "";
        given(`a simple title`, (ctx) => {
            whenTitle = ctx.step!.title;
        });
        when("accessing the value from the stepContext", (ctx) => { });

        then("the title should match stepContext.title", (ctx) => {
            chai.expect(whenTitle).to.equal("a simple title");
        });
    });

    scenario("Step statement has a title and a docString", (ctx) => {
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
                """`, (ctx) => {
            givenTitle = ctx.step!.title;
            docString = ctx.step!.docString;
        });

        when("accessing the value from the stepContext", (ctx) => { });

        then("the title should match stepContext.title", (ctx) => {
            givenTitle.should.be.equal("a simple title");
        });

        and("the docString should match stepContext.docString", (ctx) => {
            docString.should.be.equal("With this docString that\nhas multiple lines\n1\n2\n3\n4");
        });
    });

    scenario("Step statement has a title and a docString that is valid json", (ctx) => {
        let givenTitle = "";
        let givenStep: any;

        given(`a simple title
                """
                {
                    "name":"John",
                    "address": "123 Street"
                }
                """`, (ctx) => {
            givenTitle = ctx.step!.title;
            givenStep = ctx.step;
        });

        when("accessing the value from the stepContext", (ctx) => { });

        then("the title should match stepContext.title", (ctx) => {
            givenTitle.should.be.equal("a simple title");
        });

        and("the docStringAsEntity should return an object with the correct properties", (ctx) => {
            const docString = givenStep.docStringAsEntity;
            docString.name.should.be.equal("John");
            docString.address.should.be.equal("123 Street");
        });
    });

    scenario("Step statement has a title and a table", (ctx) => {
        let givenStep: any;

        given(`a simple title has a table

                |  name  |       email        |     twitter     |
                | Aslak  | aslak@cucumber.io  | @aslak_hellesoy |
                | Julien | julien@cucumber.io | @jbpros         |
                | Matt   | matt@cucumber.io   | @mattwynne      |

                This is a table above!!
            `, (ctx) => {
            givenStep = ctx.step;
        });

        when("using the stepContext", (ctx) => { });

        then("the title should match stepContext.title", (ctx) => {
            givenStep.title.should.be.equal("a simple title has a table");
        });

        and("the table should match stepContext.table", (ctx) => {
            const table = givenStep.table;
            table.length.should.be.equal(3);
            table[0].name.should.be.equal("Aslak");
            table[0].email.should.be.equal("aslak@cucumber.io");
            table[0].twitter.should.be.equal("@aslak_hellesoy");
            table[2].name.should.be.equal("Matt");
            table[2].email.should.be.equal("matt@cucumber.io");
            table[2].twitter.should.be.equal("@mattwynne");
        });
    });

    scenario("Step statement has a two column table with names in first column", (ctx) => {
        let entity: any;
        when(`a simple title has a table

                | name    | Aslak             |
                | email   | aslak@cucumber.io |
                | twitter | @aslak_hellesoy   |
                | address | 1 street          |

                This is a table above!!
            `, (ctx) => {
            entity = ctx.step!.tableAsEntity;
        });

        then("the table should be convertible to an entity using stepContext.tableToEntity", (ctx) => {
            entity.name.should.be.equal("Aslak");
            entity.email.should.be.equal("aslak@cucumber.io");
            entity.twitter.should.be.equal("@aslak_hellesoy");
            entity.address.should.be.equal("1 street");
        });
    });

    scenario("Step statement has a single column of values as a table", (ctx) => {
        let givenStep: any;
        given(`a simple title has a table of values

                |    17|
                |   42 |
                | 4711 |

                This is a table above!!
            `, (ctx) => {
            givenStep = ctx.step;
        });

        when("using the stepContext", (ctx) => { });

        then("the table should be convertible to a list using stepContext.tableToList", (ctx) => {
            // Add the numbers up
            let total = 0;
            const list = givenStep.tableAsSingleList;
            for (let i = 0; i < list.length; i++) {
                total += list[i];
            }

            total.should.be.equal(4770);
        });
    });

    scenario("Step statement has a column of values of different intrinsic types as a table", (ctx) => {
        let givenStep: any;
        given(`a simple title has a table of values

                | string       | test                 |
                | number       |                 1234 |
                | numberZero   |                    0 |
                | booleanTrue  | true                 |
                | booleanFalse | false                |
                | array        | ["hello", "Goodbye"] |
                | object       | {"prop": "Goodbye"}  |
                | nullValue    | null                 |
                | USDate       | 01/02/2019           |
                | ISODate      | 2019-01-02           |
                | spaces       | " "                  |
                | quotes       | " a \\" is here"     |
                
            `, (ctx) => {
            givenStep = ctx.step;
        });

        when("using the stepContext", (ctx) => { });

        then("the table should be convertible to a list using stepContext.tableToList and have each type be its intrinsic type not just string", (ctx) => {
            // Add the numbers up
            const entity = givenStep.tableAsEntity;

            (typeof entity.string).should.be.equal("string");
            (typeof entity.number).should.be.equal("number");
            (typeof entity.numberZero).should.be.equal("number");
            (typeof entity.booleanTrue).should.be.equal("boolean");
            (typeof entity.booleanFalse).should.be.equal("boolean");
            (typeof entity.array).should.be.equal("object");
            entity.array[0].should.be.equal("hello");
            entity.array[1].should.be.equal("Goodbye");
            (typeof entity.object).should.be.equal("object");
            entity.object.prop.should.be.equal("Goodbye");
            true.should.equal(entity.nullValue === null);

            // Handle dates
            let expectedDate = new Date("Jan 2, 2019").getTime();
            entity.USDate.getTime().should.be.equal(expectedDate);

            // Need to re parse the date as the formats timezone is different see: 
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse
            expectedDate = new Date("2019-01-02").getTime();
            entity.ISODate.getTime().should.be.equal(expectedDate);

            (typeof entity.spaces).should.be.equal("string");
            entity.spaces.should.be.equal(" ");

            (typeof entity.quotes).should.be.equal("string");
            entity.quotes.should.be.equal(' a " is here');
        });
    });

    scenario("Step statement uses quoted \" values to define values ", (ctx) => {
        let stepValues: string[];
        when(`a title has "this value" and "that value"`, (ctx) => {
            stepValues = ctx.step!.values;
        });

        then("contextStep.values should have '2' items", (ctx) => {
            stepValues.length.should.be.equal(ctx.step!.values[0]);
        });

        and("the two values should be available via contextStep.values", (ctx) => {
            stepValues[0].should.be.equal("this value");
            stepValues[1].should.be.equal("that value");
        });
    });

    scenario("Step statement uses quoted ' values to define values ", (ctx) => {
        let stepValues: any[];
        when(`a title has 'this value2' and 'that value2'`, (ctx) => {
            stepValues = ctx.step!.values;
        });

        then("contextStep.values should have '2' items", (ctx) => {
            stepValues.length.should.be.equal(ctx.step!.values[0]);
        });

        and("the two values should be available via contextStep.values", (ctx) => {
            stepValues[0].should.be.equal("this value2");
            stepValues[1].should.be.equal("that value2");
        });

        and("quoted values should support multiple types: number: '1234'", (ctx) => {
            (typeof ctx.step!.values[0]).should.be.equal("number");
        });

        and("quoted values should support multiple types: boolean: 'true' or 'false'", (ctx) => {
            (typeof ctx.step!.values[0]).should.be.equal("boolean");
        });

        and("quoted values should support multiple types: array: '[1, 3, 4, 5]'", (ctx) => {
            (typeof ctx.step!.values[0]).should.be.equal("object");
            ctx.step!.values[0][0].should.be.equal(1);
        });
    });

    scenario("Step statements should support async operations", (ctx) => {
        let value = 0;
        when(`a step is testing code that is async`, async (ctx) => {
            value = 10;
            await Utils.sleep(10);
            value = 20;
        });

        then("the test should continue after the async operation", (ctx) => {
            value.should.be.equal(20);
        });
    });

    scenario(`failing tests are reported as such
        @dynamic
        `, (ctx) => {
        let outlineGiven: any;
        let executionResults: ExecutionResults;
        given(`a step that will fail
            """
            feature("A feature with a failing step", ()=> {
                scenario(\`A scenario with a failing step\`, () => {
                    given("a step that will fail", () => {
                        throw new Error("Its ok I'm supposed to fail!");
                    });
                });            
            });
            """
            `, (ctx) => {
                outlineGiven = ctx.step!;
            });

        when(`executing feature`, async (ctx) => {
            executionResults = await LiveDoc.executeDynamicTestAsync(outlineGiven.docString);
        });

        then("the step is marked as failed", (ctx) => {
            const step = executionResults.features[0].scenarios[0].steps[0];
            chai.expect(step.status).to.equal(SpecStatus.fail);
        });
    });

    scenario(`Step statement narration can be bound using custom object at time of execution`, (ctx) => {
        let myVariable: { name: string } = { name: "" };
        let stepText = "";

        given(`the variable myVariable has a name property`, (ctx) => {

        });
        and(`the name property is updated in this step to 'hello world'`, (ctx) => {
            myVariable.name = ctx.step!.values[0];
        });

        when(`defining a step that binds the variable name {{name}}`, (ctx) => {
            stepText = ctx.step!.displayTitle;
        }, myVariable);

        then("the step display title includes the bound values", (ctx) => {
            chai.expect(stepText).to.contain(myVariable.name);
        });
    });

    scenario(`Step statement narration can be bound using custom function at time of execution`, (ctx) => {
        let myVariable: { name: string } = { name: "" };
        let stepText = "";

        given(`the variable myVariable has a name property`, (ctx) => {

        });
        and(`the name property is updated in this step to 'hello world'`, (ctx) => {
            myVariable.name = ctx.step!.values[0];
        });

        when(`defining a step that binds the variable name {{name}}`, (ctx) => {
            stepText = ctx.step!.displayTitle;
        }, () => ({ name: myVariable.name }));

        then(`the step display title includes the bound values`, (ctx) => {
            chai.expect(stepText).to.contain(myVariable.name);
        });
    });
});
