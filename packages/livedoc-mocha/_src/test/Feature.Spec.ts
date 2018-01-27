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

feature(`Scenarios within features can be skipped`, () => {
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

feature(`Scenarios within features can be skipped via use of tags
        Note: must run tests with --ld-exclude filter:exclude`, () => {
        scenario(`this scenario should be run
            `, () => {
                given("a non skipped scenario, this should fire!", () => {

                });

                when(`a non skipped scenario has a skipped step via tags it shouldn't run
                    @filter:exclude`, () => {

                    });
            });

        scenario(`a scenario within a feature can be skipped
        @filter:exclude
        `, () => {
                given("a skipped scenario, this should not fire!", () => {
                    throw Error("This should not have fired! The feature was skipped!");
                });
            });

        scenarioOutline(`a scenarioOutline within a feature can be skipped
            @filter:exclude

            Examples:
            |value|
            |3|
            |4|
            `, () => {
                given("a skipped scenario, this should not fire! <value>", () => {
                    throw Error("This should not have fired! The feature was skipped!");
                });
            });
    });

feature(`Features can be skipped via use of tags
        @filter:exclude
        Note: must run tests with --ld-exclude filter:exclude`, () => {
        scenario("a scenario within a skipped feature", () => {
            given("a skipped feature, this should not fire!", () => {
                throw Error("This should not have fired! The feature was skipped!");
            })
        })
    });

feature(`Features can be skipped via use of tags
        Note: must run tests with --ld-exclude filter:exclude`, () => {
        scenario(`a scenario within a skipped feature
        @filter:exclude
        `, () => {
                given("an always-run scenario, this should fire!", () => {

                });
            });
    });

feature(`Features that are marked as include and exclude won't be run
    @filter:include filter:exclude
    Note: must run tests with --ld-exclude filter:exclude`, () => {
        scenario("a scenario within a skipped feature", () => {
            given("a conflicted filter so can fire!", () => {
                throw Error("This should not have fired! The feature was skipped!");
            })
        })
    });

feature(`Features can be included via use of tags
        Note: must run tests with --ld-include filter:include`, () => {
        scenario(`a scenario within a skipped feature
        @filter:include
        `, () => {
                given("an always-run scenario, this should fire!", () => {

                });
            });
    });