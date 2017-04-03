///<reference path="../app/livedoc.ts" />

require('chai').should();

feature(`Background statement

        Background statements are used to define a common given that is
        applied to each scenario. The background is executed before each scenario
        `, () => {

        let someValue = 0;

        background(" ", () => {
            someValue = 100;
            given("This will be executed before each test somevalue = '100", () => {
                //someValue = 100;
            })
        });

        scenario("Add 10 to someValue", () => {
            when(`someValue is increased by '10'`, () => {
                someValue
                someValue += stepContext.values[0];
            });

            then("someValue should be '110'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });
        });

        scenario("Add 20 to someValue", () => {
            console.log(backgroundContext.values[0]);
            when(`someValue is increased by '20'`, () => {
                someValue += stepContext.values[0];
            });

            then("someValue should be '120'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });
        });

        scenario("Add 200 to someValue", () => {
            console.log(backgroundContext.values[0]);
            when(`someValue is increased by '200'`, () => {
                someValue += stepContext.values[0];
            });

            then("someValue should be '300'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });
        });
    });
