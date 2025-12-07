require('chai').should();
import { feature, scenarioOutline, background, Given, When, Then } from "../../app/livedoc";

feature(`Background works with Scenario Outlines`, (ctx) => {
    let afterBackgroundCheck = 0;
    background(`Validate afterBackground         
        `, (ctx) => {
            Given("afterBackgroundCheck has 10 added to it", (ctx) => {
                afterBackgroundCheck += 10;
            });

            ctx.afterBackground(() => {
                afterBackgroundCheck = 0;
            });
        })
    scenarioOutline(`Given the following items
        @filter:background-test
        Examples:
        | col1 |
        | row1 |
        | row2 |
        | row3 |
        | row4 |
    `, (ctx) => {

            Given("this is <col1>", (ctx) => {
            });

            When("the background executes", (ctx) => { });

            Then("afterBackgroundCheck should be '10'", (ctx) => {
                afterBackgroundCheck.should.be.equal(ctx.step.values[0]);
            });
        });
});
