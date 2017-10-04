///<reference path="../app/livedoc.ts" />

require('chai').should();

feature(`Feature statement
        @tag-sample:test tag-sample:test2
        @even-more

        Features are used to define a feature that requires testing`, () => {

        let featureTitle = featureContext.title;
        let featureTitleExpected = "Feature statement";
        let filename = "Feature.Spec.js";
        let description = "\nFeatures are used to define a feature that requires testing";
        let tags = ["tag-sample:test", "tag-sample:test2", "even-more"];

        scenario("Using the feature statement to create a new feature", () => {
            given(`a spec file named ${filename}`, () => { });

            when("using the feature statement", () => { });

            then("the global variable featureContext.title should match the title at the feature level", () => {
                featureTitle.should.be.equal(featureTitleExpected);
            });

            and("the global variable featureContext.title should match the title at the step level", () => {
                featureContext.title.should.be.equal(featureTitleExpected);
            });

            and(`the global variable featureContext.filename should match '${filename}'`, () => {
                featureContext.filename.should.be.equal(filename);
            });

            and(`the global variable featureContext.description should match '${description}'`, () => {
                featureContext.description.should.be.equal(description);
            });

            and(`the global variable featureContext.tags should match '${tags}'`, () => {
                featureContext.tags.should.be.eql(tags);
            })
        });
    });

feature.skip("Features can be skipped", () => {
    scenario("a scenario within a skipped feature", () => {
        given("a skipped feature, this should not fire!", () => {
            throw Error("This should not have fired! The feature was skipped!");
        })
    })
});

feature("Scenarios within features can be skipped", () => {
    scenario.skip("a scenario within a feature can be skipped", () => {
        given("a skipped scenario, this should not fire!", () => {
            throw Error("This should not have fired! The feature was skipped!");
        })
    })
});

feature("Step definitions within scenarios can be skipped", () => {
    scenario("a scenario within a feature", () => {
        given.skip("a skipped step within a scenario, this should not fire!", () => {
            throw Error("This should not have fired! The feature was skipped!");
        })
    })
});