import * as Utils from '../Utils';

feature("Background supports async operations", () => {
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

    scenario("Using a second background still awaits", () => {
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