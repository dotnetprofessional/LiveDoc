
livedoc.setAllRulesAsWarnings();

feature("Existing code hasn't applied the Gherkin language correctly", () => {
    when("a step definition is added to a feature, it shouldn't blow up!", () => { });
});

scenario("Tester neglected to specify a feature first!", () => {
    when("something", () => {
    });
});