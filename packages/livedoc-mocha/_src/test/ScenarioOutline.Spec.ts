///<reference path="../app/livedoc.ts" />
require('chai').should();

feature(`Scenario Outline statement`, () => {
    scenarioOutline(`feeding a suckler cow

Examples:
    | weight | energy | protein |
    |    450 |  26500 |     215 |
    |    500 |  29500 |     245 |
    |    575 |  31500 |     255 |
    |    600 |  37000 |     305 |
`, () => {
            given("the cow weighs <weight> kg", () => {
            });

            when("we calculate the feeding requirements", () => {

            });

            then("the energy should be <energy> MJ", () => {

            });

            and("the protein should be <protein> kg", () => {

            });
        });
});



