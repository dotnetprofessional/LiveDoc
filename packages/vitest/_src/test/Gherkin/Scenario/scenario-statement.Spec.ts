import { feature, scenario, given, when, Then as then, and } from "../../../app/livedoc";
const chai = require('chai');
chai.should();

feature(`Scenario statement

        Scenarios are used to define the actions or events of a feature`, (ctx) => {

    scenario("Able to access featureContext from scenario", (ctx) => {
        let context = ctx.feature;
        given("A scenario is within a feature", (ctx) => {
            // Actually nothing to do here :)
        });

        when("using a scenario", (ctx) => { });

        then("the feature context should be available", (ctx) => {
            context!.title.should.be.equal("Scenario statement");
        });
    });

    scenario(`The global variable scenarioContext is set
                @mytag:test another-tag
                with this description`, (ctx) => {

        let givenContext: any;
        let tags = ["mytag:test", "another-tag"];

        given(`the current scenario has these properties:
                | title       | The global variable scenarioContext is set |
                | description | with this description                      |
                `, (ctx) => {
            givenContext = ctx.step;
        });

        when("using the scenarioContext", (ctx) => { });

        then("the scenarioContext.title should match title", (ctx) => {
            givenContext.tableAsEntity.title.should.be.equal(ctx.scenario!.title);
        });

        and("the scenarioContext.description should match description", (ctx) => {
            givenContext.tableAsEntity.description.should.be.equal(ctx.scenario!.description);
        });

        and(`the scenarioContext.tags should match '${tags}'`, (ctx) => {
            ctx.scenario!.tags.should.be.eql(tags);
        });
    });

    scenario(`The global variable scenarioContext is set for a different scenario
                with this description2`, (ctx) => {
        let givenContext: any;
        given(`the current scenario has these properties:
                | title       | The global variable scenarioContext is set for a different scenario |
                | description | with this description2                                              |
                `, (ctx) => {
            givenContext = ctx.step;
        });
        when("using the scenarioContext", (ctx) => { });
        then("the scenarioContext.title should match title", (ctx) => {
            givenContext.tableAsEntity.title.should.be.equal(ctx.scenario!.title);
        });

        and("the scenarioContext.description should match description", (ctx) => {
            givenContext.tableAsEntity.description.should.be.equal(ctx.scenario!.description);
        });
    });

    scenario(`given step is associated with scenarioContext.given

                As the given step and its associated ands and buts provide the context for
                subsequent steps, its helpful to have easy access to this information rather
                than forcing the consumer to record the values manually.
                `, (ctx) => {

        let givenStep: any;
        let andStep: any;

        given(`the following table:
                | property1 | value1 |
                | property2 | value2 |
                `, (ctx) => {
            givenStep = ctx.step;
        });

        and("some the values '1' and '2' in an and step definition", (ctx) => {
            andStep = ctx.step;
        });

        when("using the scenarioContext.given", (ctx) => { });

        then("the scenarioContext.given should contain the table from the given statement", (ctx) => {
            const entity = givenStep.tableAsEntity;
            entity.property1.should.be.equal("value1");
            entity.property2.should.be.equal("value2");
        });

        and("the scenarioContext.and should have '1' item", (ctx) => {
            // In vitest version, we have the and step captured
            andStep.should.exist;
        });

        and("the scenarioContext.and[0].values should contain a '1' and a '2' from the given's and", (ctx) => {
            andStep.values[0].should.be.equal(ctx.step!.values[0]);
            andStep.values[1].should.be.equal(ctx.step!.values[1]);
        });
    });

    scenario(`given step is associated with scenarioContext.given and does not provide data from a previous scenario

                Ensure that each scenario is isolated from the other.
                `, (ctx) => {

        let givenStep: any;

        given(`the following table from the second scenario:
                | property3 | value3 |
                | property4 | value4 |
                `, (ctx) => {
            givenStep = ctx.step;
        });

        when("using the scenarioContext.given", (ctx) => { });

        then("the scenarioContext.given should contain the table from the given statement", (ctx) => {
            const entity = givenStep.tableAsEntity;
            entity.property3.should.be.equal("value3");
            entity.property4.should.be.equal("value4");
        });
    });
});
