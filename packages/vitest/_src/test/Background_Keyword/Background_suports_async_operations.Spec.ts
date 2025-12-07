require('chai').should();
import * as Utils from '../Utils';
import { feature, scenario, background, Given, When, Then, And } from "../../app/livedoc";

feature("Background supports async operations", (ctx) => {
    let someValue = 0;
    let afterBackgroundCheck = 0;

    background("This will be executed before each test", (ctx) => {

        ctx.afterBackground(async () => {
            await Utils.sleep(10);
            afterBackgroundCheck = 0;
        });

        Given("somevalue = '30'", async (ctx) => {
            await Utils.sleep(10);
            someValue = ctx.background!.given.values[0];
        });

        And("we add '70' to somevalue", (ctx) => {
            someValue += ctx.background!.and[0].values[0];
        });

        And("the stepContext is available so should get '10' from this step", (ctx) => {
            ctx.step.values[0].should.be.equal(10);
        })

        And("afterBackgroundCheck has '10' added to it", async (ctx) => {
            await Utils.sleep(10);
            afterBackgroundCheck += 10;
        });
    });

    scenario("Add 10 to someValue", (ctx) => {
        When(`someValue is increased by '10'`, (ctx) => {
            someValue += ctx.step.values[0];
        });

        Then("someValue should be '110'", (ctx) => {
            someValue.should.be.equal(ctx.step.values[0]);
        });

        And("afterBackgroundCheck should be '10'", (ctx) => {
            afterBackgroundCheck.should.be.equal(ctx.step.values[0]);
        });
    });

    scenario("Using a second background still awaits", (ctx) => {
        When(`someValue is increased by '10'`, (ctx) => {
            someValue += ctx.step.values[0];
        });

        Then("someValue should be '110'", (ctx) => {
            someValue.should.be.equal(ctx.step.values[0]);
        });

        And("afterBackgroundCheck should be '10'", (ctx) => {
            afterBackgroundCheck.should.be.equal(ctx.step.values[0]);
        });
    });
});
