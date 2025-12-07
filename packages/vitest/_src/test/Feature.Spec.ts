import { feature, scenario, Given, When, Then, And } from "../app/livedoc";
const chai = require('chai');
chai.should();

feature(`Feature statement
        @tag-sample:test tag-sample:test2
        @even-more

        Features are used to define a feature that requires testing
        
        `, (ctx) => {

    const featureTitleExpected = "Feature statement";
    const filename = "Feature.Spec";
    const description = "Features are used to define a feature that requires testing";
    const tags = ["tag-sample:test", "tag-sample:test2", "even-more"];

    scenario("Using the feature statement to create a new feature", (ctx) => {
        const featureCtx = ctx.feature;

        Given(`a spec file named ${filename}`, (ctx) => { });

        When("using the feature statement", (ctx) => { });

        Then("the featureContext.title should match the title", (ctx) => {
            featureCtx!.title.should.be.equal(featureTitleExpected);
        });

        And("the featureContext should be accessible from step level", (ctx) => {
            ctx.feature!.title.should.be.equal(featureTitleExpected);
        });

        And(`the featureContext.filename should contain '${filename}'`, (ctx) => {
            featureCtx!.filename.should.contain(filename);
        });

        And(`the featureContext.description should match`, (ctx) => {
            featureCtx!.description.should.be.equal(description);
        });

        And(`the featureContext.tags should match`, (ctx) => {
            featureCtx!.tags.should.be.eql(tags);
        });
    });
});
