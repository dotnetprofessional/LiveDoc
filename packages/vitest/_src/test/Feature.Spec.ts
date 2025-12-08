import { feature, scenario, given, when, Then as then, and } from "../app/livedoc";
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

        given(`a spec file named ${filename}`, (ctx) => { });

        when("using the feature statement", (ctx) => { });

        then("the featureContext.title should match the title", (ctx) => {
            featureCtx!.title.should.be.equal(featureTitleExpected);
        });

        and("the featureContext should be accessible from step level", (ctx) => {
            ctx.feature!.title.should.be.equal(featureTitleExpected);
        });

        and(`the featureContext.filename should contain '${filename}'`, (ctx) => {
            featureCtx!.filename.should.contain(filename);
        });

        and(`the featureContext.description should match`, (ctx) => {
            featureCtx!.description.should.be.equal(description);
        });

        and(`the featureContext.tags should match`, (ctx) => {
            featureCtx!.tags.should.be.eql(tags);
        });
    });
});
