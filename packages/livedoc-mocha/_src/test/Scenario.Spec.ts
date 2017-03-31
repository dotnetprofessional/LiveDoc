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
                with this description`, () => {
                let givenContext;
                given(`the current scenario has these properties:
                | title       | The global variable scenarioContext is set |
                | description | with this description                      |
                `, () => {
                        givenContext = stepContext;
                    });
                then("the scenarioContext.title should match title", () => {
                    givenContext.tableAsEntity.title.should.be.equal(scenarioContext.title);
                })

                then("the scenarioContext.description should match description", () => {
                    givenContext.tableAsEntity.description.should.be.equal(scenarioContext.description);
                })
            });

        scenario(`The global variable scenarioContext is set for a different scenario
                with this description2`, () => {
                let givenContext;
                given(`the current scenario has these properties:
                | title       | The global variable scenarioContext is set for a different scenario |
                | description | with this description2                                               |
                `, () => {
                        givenContext = stepContext;
                    });
                then("the scenarioContext.title should match title", () => {
                    givenContext.tableAsEntity.title.should.be.equal(scenarioContext.title);
                })

                then("the scenarioContext.description should match description", () => {
                    givenContext.tableAsEntity.description.should.be.equal(scenarioContext.description);
                })
            })

    });

