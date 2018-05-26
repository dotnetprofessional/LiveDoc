///<reference path="../app/livedoc.ts" />
require('chai').should();

feature(`Scenario statement

        Scenarios are used to define the actions or events of a feature`, () => {

        scenario("Able to access featureContext from scenario", () => {
            let context = featureContext;
            given("A scenario is within a feature", () => {
                // Actually nothing to do here :)
            });

            when("using a scenario", () => { });

            then("the feature context should be available", () => {
                context.title.should.be.equal("Scenario statement");
            })

        });

        scenario(`The global variable scenarioContext is set
                @mytag:test another-tag
                with this description`, () => {

                let givenContext;
                let tags = ["mytag:test", "another-tag"];

                given(`the current scenario has these properties:
                | title       | The global variable scenarioContext is set |
                | description | with this description                      |
                `, () => {
                        givenContext = stepContext;
                    });

                when("using the scenarioContext", () => { });

                then("the scenarioContext.title should match title", () => {
                    givenContext.tableAsEntity.title.should.be.equal(scenarioContext.title);
                })

                and("the scenarioContext.description should match description", () => {
                    givenContext.tableAsEntity.description.should.be.equal(scenarioContext.description);
                });

                and(`the scenarioContext.tags should match '${tags}'`, () => {
                    scenarioContext.tags.should.be.eql(tags);
                });
            });

        scenario(`The global variable scenarioContext is set for a different scenario
                with this description2`, () => {
                let givenContext;
                given(`the current scenario has these properties:
                | title       | The global variable scenarioContext is set for a different scenario |
                | description | with this description2                                              |
                `, () => {
                        givenContext = stepContext;
                    });
                when("using the scenarioContext", () => { });
                then("the scenarioContext.title should match title", () => {
                    givenContext.tableAsEntity.title.should.be.equal(scenarioContext.title);
                })

                and("the scenarioContext.description should match description", () => {
                    givenContext.tableAsEntity.description.should.be.equal(scenarioContext.description);
                })
            })


        scenario(`Given step is associated with scenarioContext.given

                As the given step and its associated ands and buts provide the context for
                subsequent steps, its helpful to have easy access to this information rather
                than forcing the consumer to record the values manually.
                `, () => {

                given(`the following table:
                | property1 | value1 |
                | property2 | value2 |
                `, () => { });

                and("some the values '1' and '2' in an and step definition", () => { });

                when("using the scenarioContext.given", () => { });

                then("the scenarioContext.given should contain the table from the given statement", () => {
                    const entity = scenarioContext.given.tableAsEntity;
                    entity.property1.should.be.equal("value1");
                    entity.property2.should.be.equal("value2");
                });

                and("the scenarioContext.and should have '1' item", () => {
                    scenarioContext.and.length.should.be.equal(1);
                });

                and("the scenarioContext.and[0].values should contain a '1' and a '2' from the given's and", () => {
                    scenarioContext.and[0].values[0].should.be.equal(stepContext.values[0]);
                    scenarioContext.and[0].values[1].should.be.equal(stepContext.values[1]);
                });
            });

        scenario(`Given step is associated with scenarioContext.given and does not provide data from a previous scenario

                Ensure that each scenario is isolated from the other.
                `, () => {

                given(`the following table from the second scenario:
                | property3 | value3 |
                | property4 | value4 |
                `, () => { });

                when("using the scenarioContext.given", () => { });

                then("the scenarioContext.given should contain the table from the given statement", () => {
                    const entity = scenarioContext.given.tableAsEntity;
                    entity.property3.should.be.equal("value3");
                    entity.property4.should.be.equal("value4");
                });

            });
    });
