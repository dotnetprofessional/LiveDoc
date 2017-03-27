///<reference path="../app/livedoc.ts" />

require('chai').should();

feature(`Background statement

        Background statements are used to define a common given that is
        applied to each scenario. The background is executed before each scenario`, () => {

        let someValue = 0;

        background("This will be executed before each test", () => {
            someValue = 100;
        });

        it("this is a test", () => {

        });
        scenario("Add 10 to someValue", () => {
            when(`someValue is increased by 10`, () => {
                someValue += 10;
            });

            then("someValue should be '110'", () => {
                someValue.should.be.equal(Number(stepContext.values[0]));
            });
        });

        scenario("Add 20 to someValue", () => {
            when(`someValue is increased by 20`, () => {
                someValue += 10;
            });

            then("someValue should be '120'", () => {
                someValue.should.be.equal(Number(stepContext.values[0]));
            });
        });
    });
