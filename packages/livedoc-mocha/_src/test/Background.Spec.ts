///<reference path="../app/livedoc.ts" />

require('chai').should();

feature.only(`Background statement

        Background statements are used to define a common given that is
        applied to each scenario. The background is executed before each scenario
        `, () => {

        let someValue = 0;
        let count = 0;
        background("This will be executed before each test", () => {

            given("somevalue = '30'", () => {
                count++;
                someValue = backgroundContext.given.values[0];
            });

            and("we add '70' to somevalue", () => {
                someValue += backgroundContext.and[0].values[0];
            });

            and("the stepContext is available so should get '10' from this step", () => {
                console.log(stepContext.values[0]);
                stepContext.values[0].should.be.equal(10);
            })
        });

        scenario("Add 10 to someValue", () => {
            when(`someValue is increased by '10'`, () => {
                someValue += stepContext.values[0];
            });

            then("someValue should be '110'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });
        });

        scenario("Add 20 to someValue", () => {
            //console.log(backgroundContext.given.values[0]);
            when(`someValue is increased by '20'`, () => {
                someValue += stepContext.values[0];
            });

            then("someValue should be '120'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });
        });

        scenario("Add 200 to someValue", () => {
            when(`someValue is increased by '200'`, () => {
                someValue += stepContext.values[0];
            });

            then("someValue should be '300'", () => {
                someValue.should.be.equal(stepContext.values[0]);
            });

            and("the background should be executed '3' times", () => {
                stepContext.values[0].should.be.equal(count);
            })
        });
    });
