import * as Utils from "./Utils";

require('chai').should();

feature(`Background statement

        Background statements are used to define a common given that is
        applied to each scenario. The background is executed before each scenario
        `, () => {

        let someValue = 0;
        let count = 0;
        let afterBackgroundCheck = 0;

        background("This will be executed before each test", () => {

            afterBackground(() => {
                afterBackgroundCheck = 0;
            });

            given("somevalue = '30'", () => {
                count++;
                someValue = backgroundContext.given.values[0];
            });

            and("we add '70' to somevalue", () => {
                someValue += backgroundContext.and[0].values[0];
            });

            and("the stepContext is available so should get '10' from this step", () => {
                stepContext.values[0].should.be.equal(10);
            })

            and("afterBackgroundCheck has '10' added to it", () => {
                afterBackgroundCheck += 10;
            });
        });

        scenario("Add 10 to someValue", () => {
            when(`someValue is increased by '10'`, () => {
                someValue += stepContext.values[0];
            });

            then("someValue should be '110'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });

            and("afterBackgroundCheck should be '10'", () => {
                afterBackgroundCheck.should.be.equal(stepContext.values[0]);
            });
        });

        scenario("Add 20 to someValue", () => {
            when(`someValue is increased by '20'`, () => {
                someValue
                someValue += stepContext.values[0];
            });

            then("someValue should be '120'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });

            and("afterBackgroundCheck should be '10'", () => {
                afterBackgroundCheck.should.be.equal(stepContext.values[0]);
            });
        });

        scenario("Add 200 to someValue", () => {
            when(`someValue is increased by '200'`, () => {
                someValue += stepContext.values[0];
            });

            then("someValue should be '300'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });

            and("the background should be executed '3' times", () => {
                stepContext.values[0].should.be.equal(count);
            });

            and("afterBackgroundCheck should be '10'", () => {
                afterBackgroundCheck.should.be.equal(stepContext.values[0]);
            });
        });
    });

feature("Background works with Scenario Outlines", () => {
    let afterBackgroundCheck = 0;

    background("Validate afterBackground", () => {
        given("afterBackgroundCheck has 10 added to it", () => {
            afterBackgroundCheck += 10;
        });

        afterBackground(() => {
            afterBackgroundCheck = 0;
        });
    })
    scenarioOutline(`Given the following items

        Examples:
        | col1  |
        | row1  |
        | row2  |
        | row3  |
        | row4  |
    `, () => {

            given("this is <col1>", () => {

            });

            then("afterBackgroundCheck should be '10'", () => {
                afterBackgroundCheck.should.be.equal(stepContext.values[0]);
            });
        });
})

feature("Background supports async operations", async () => {
    let someValue = 0;
    let count = 0;
    let afterBackgroundCheck = 0;

    background("This will be executed before each test", () => {

        afterBackground(async () => {
            await Utils.sleep(10);
            afterBackgroundCheck = 0;
        });

        given("somevalue = '30'", async () => {
            await Utils.sleep(10);
            count++;
            someValue = backgroundContext.given.values[0];
        });

        and("we add '70' to somevalue", () => {
            someValue += backgroundContext.and[0].values[0];
        });

        and("the stepContext is available so should get '10' from this step", () => {
            stepContext.values[0].should.be.equal(10);
        })

        and("afterBackgroundCheck has '10' added to it", async () => {
            await Utils.sleep(10);
            afterBackgroundCheck += 10;
        });
    });

    scenario("Add 10 to someValue", () => {
        when(`someValue is increased by '10'`, () => {
            someValue += stepContext.values[0];
        });

        then("someValue should be '110'", () => {
            someValue.should.be.equal(stepContext.values[0]);
        });

        and("afterBackgroundCheck should be '10'", () => {
            afterBackgroundCheck.should.be.equal(stepContext.values[0]);
        });
    });
});