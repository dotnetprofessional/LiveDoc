///<reference path="../app/livedoc.ts" />
require('chai').should();

feature(`Scenario Outline statement`, () => {
    let weightTotal = 0;
    scenarioOutline(`feeding a suckler cow

Examples:
    | weight  | energy  | protein  |
    |     450 |   26500 |      215 |
    |     500 |   29500 |      245 |
    |     575 |   31500 |      255 |
    |     600 |   37000 |      305 |
`, () => {

            given("the cow weighs <weight> kg", (args) => {
                // TODO: FIX UP
                weightTotal += Number(scenarioOutlineContext.example.weight);
            });

            when("we calculate the feeding requirements", () => {
            });

            then("the energy should be <energy> MJ", () => {
            });

            and("the protein should be <protein> kg", () => {
            });

            and("the title should have the examples bound <weight>", () => {
                stepContext.title.should.contain(scenarioOutlineContext.example.weight);
            })
        });

    scenario("validate outline provided the correct values to steps", () => {
        given("the previous scenario was a Scenario Outline", () => { });
        when("the scenario has completed", () => { });
        then("the total of the weight column provided to the given is '2125'", () => {
            weightTotal.should.be.equal(stepContext.values[0]);
        })
    })
});



