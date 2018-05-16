feature(`Background works with Scenario Outlines`, () => {
    let afterBackgroundCheck = 0;
    background(`Validate afterBackground         
        `, () => {
            given("afterBackgroundCheck has 10 added to it", () => {
                afterBackgroundCheck += 10;
            });

            afterBackground(() => {
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
    `, () => {

            given("this is <col1>", () => {
            });

            when("the background executes", () => { });

            then("afterBackgroundCheck should be '10'", () => {
                afterBackgroundCheck.should.be.equal(stepContext.values[0]);
            });
        });
});