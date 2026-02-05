require('chai').should();
import { feature, scenarioOutline, background, given, when, Then as then } from "../../../app/livedoc";

feature(`Background works with Scenario Outlines`, (ctx) => {
    let afterBackgroundCheck = 0;
    background(`Validate afterBackground         
        `, (ctx) => {
            given("afterBackgroundCheck has 10 added to it", (ctx) => {
                afterBackgroundCheck += 10;
            });

            ctx.afterBackground(() => {
                afterBackgroundCheck = 0;
            });
        })
    scenarioOutline(`given the following items
        @filter:background-test
        Examples:
        | col1 |
        | row1 |
        | row2 |
        | row3 |
        | row4 |
    `, (ctx) => {

            given("this is <col1>", (ctx) => {
            });

            when("the background executes", (ctx) => { });

            then("afterBackgroundCheck should be '10'", (ctx) => {
                afterBackgroundCheck.should.be.equal(ctx.step.values[0]);
            });
        });
});
