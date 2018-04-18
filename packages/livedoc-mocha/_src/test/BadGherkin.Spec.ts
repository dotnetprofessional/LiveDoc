
livedoc.setAllRulesAsWarnings();

// feature("Existing code hasn't applied the Gherkin language correctly", () => {
//     given("a given step definition is added to a feature, it shouldn't blow up!", () => { });
//     when("a when step definition is added to a feature, it shouldn't blow up!", () => { });
//     then("a then step definition is added to a feature, it shouldn't blow up!", () => { });
//     and("a and step definition is added to a feature, it shouldn't blow up!", () => { });
//     but("a but step definition is added to a feature, it shouldn't blow up!", () => { });
// });

// scenario("Scenarios must be in a feature", () => {
// });

// scenarioOutline("Scenario Outlines must be within a feature!", () => {
// });


//given("some thing", () => { });

// background("Backgrounds must be within a feature!", () => {
// });

// feature("The tester thinks multiple givens are a good idea", () => {
//     scenario("a tester adds multiple givens to a scenario", () => {
//         given("some thing has happened", () => { });
//         given("another thing has happened", () => { });
//     })
// });

// feature("The tester thinks multiple whens are a good idea", () => {
//     scenario("a tester adds multiple whens to a scenario", () => {
//         given("some thing has happened", () => { });
//         when("something has happens", () => { });
//         when("and another thing happens", () => { });
//     })
// });

// feature("The tester thinks multiple thens are a good idea", () => {
//     scenario("a tester adds multiple thens to a scenario", () => {
//         given("some thing has happened", () => { });
//         when("something has happens", () => { });
//         then("this result should happen", () => { });
//         then("and this result should happen", () => { });
//     })
// });

// feature("Incorrect use of and and but", () => {
//     scenario("and is used without a GWT", () => {
//         and("this and should be preceded by a GTW", () => { });
//     });

//     scenario("but is used without a GWT", () => {
//         but("this and should be preceded by a GTW", () => { });
//     });
// });

feature(`Ensure a Given, When and Then exists
    as nothing comes after a Then definition it is not possible for the
    model to validate that one exists as the model is built up a step at a time.

`, () => {
        scenario("no given is used in scenario", () => {
            when("when is used without a given", () => { });
        });

        scenario("but is used without a GWT", () => {
            then("when is used without a given or when", () => { });
        });
    });

feature("The tester mixes Gherkin with mocha BDD syntax", () => {
    // describe("should have used scenario instead of describe", () => {
    //     it("some condition", () => { });
    // });

    scenario("tester uses bdd for assertions", () => {
        it("should be a given maybe?", () => { });
    })
});

feature("The tester attempts to use invalid syntax in background", () => {
    background("", () => {
        when("some condition", () => { });
    });
});

feature("The tester uses before within a scenario", () => {
    scenario("my scenario", () => {
        before(() => { });
        when("some condition", () => { });
    });
});

// No titles
feature("", () => {
    scenario("", () => {
        given("", () => { });
    });
});


/* The following tests need to be run manually as they throw exceptions. 
   Exception tests are not yet supported, so they can't be kept live 
*/

// done!!
// feature.only("Features may not be marked as async", async () => {
// });

// feature("Scenarios may not be marked as async", () => {
//     scenario("my scenario", async () => {
//     });
// });

// feature("Backgrounds may not be marked as async", () => {
//     background("my background", async () => {
//     });
// });

// feature("Backgrounds may not be marked as async", () => {
//     scenarioOutline(`my scenario outline
//         Examples:
//| column name  | column name  |
//| column value | column value |
//         `, async () => {

//         });
// });