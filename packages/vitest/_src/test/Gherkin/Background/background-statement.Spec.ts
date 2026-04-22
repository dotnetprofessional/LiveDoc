import { feature, scenario, background, given, when, Then as then, and } from "../../../app/livedoc";
const chai = require('chai');
chai.should();

feature(`Background statement

        Background statements are used to define a common given that is
        applied to each scenario. The background is executed before each scenario
        `, () => {

    let someValue = 0;
    let count = 0;
    let afterBackgroundCheck = 0;

    background("This will be executed before each test", (ctx) => {

        ctx.afterBackground(() => {
            afterBackgroundCheck = 0;
        });

        given("somevalue = '30'", (ctx) => {
            count++;
            someValue = ctx.step!.values[0];
        });

        and("we add '70' to somevalue", (ctx) => {
            someValue += ctx.step!.values[0];
        });

        and("the stepContext is available so should get '10' from this step", (ctx) => {
            const val = ctx.step!.values[0];
            val.should.be.equal(10);
        });

        and("afterBackgroundCheck has '10' added to it", (ctx) => {
            afterBackgroundCheck += 10;
        });
    });

    scenario("Add 10 to someValue", (ctx) => {
        when("someValue is increased by '10'", (ctx) => {
            someValue += ctx.step!.values[0];
        });

        then("someValue should be '110'", (ctx) => {
            someValue.should.be.equal(ctx.step!.values[0]);
        });

        and("afterBackgroundCheck should be '10'", (ctx) => {
            afterBackgroundCheck.should.be.equal(ctx.step!.values[0]);
        });

        and("the background has been executed '1' times so far", (ctx) => {
            count.should.be.equal(ctx.step!.values[0]);
        });
    });

    scenario("Add 20 to someValue", (ctx) => {
        when("someValue is increased by '20'", (ctx) => {
            someValue += ctx.step!.values[0];
        });

        then("someValue should be '120'", (ctx) => {
            someValue.should.be.equal(ctx.step!.values[0]);
        });

        and("afterBackgroundCheck should be '10'", (ctx) => {
            afterBackgroundCheck.should.be.equal(ctx.step!.values[0]);
        });

        and("the background has been executed '2' times so far", (ctx) => {
            count.should.be.equal(ctx.step!.values[0]);
        });
    });

    scenario("Add 200 to someValue", (ctx) => {
        when("someValue is increased by '200'", (ctx) => {
            someValue += ctx.step!.values[0];
        });

        then("someValue should be '300'", (ctx) => {
            someValue.should.be.equal(ctx.step!.values[0]);
        });

        and("afterBackgroundCheck should be '10'", (ctx) => {
            afterBackgroundCheck.should.be.equal(ctx.step!.values[0]);
        });

        and("the background should be executed '3' times", (ctx) => {
            count.should.be.equal(ctx.step!.values[0]);
        });
    });
});
