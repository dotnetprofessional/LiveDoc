
export enum RuleViolations {

    /**
     * Is triggered when a more generic error occurs 
     */
    error,

    /**
     * Is triggered when a scenario, scenarioOutline or background is used without a feature
     */
    missingFeature,

    /**
     * Is triggered if a given, when or then is not a child of a scenario, scenarioOutline or background 
     */
    givenWhenThenMustBeWithinScenario,

    /**
     * Is triggered when more than 1 given, when or then is used within a single scenario, scenarioOutline or background
     */
    singleGivenWhenThen,

    /**
     * Is triggered if no given is part of the test 
     */
    mustIncludeGiven,

    /**
     * Is triggered if no when is part of the test 
     */
    mustIncludeWhen,

    /**
     * Is triggered if no then is part of the test 
     */
    mustIncludeThen,

    /**
     * Is triggered when an and or but doesn't also include a given, when or then
     */
    andButMustHaveGivenWhenThen,

    /**
     * Is triggered when the Gherkin language is mixed withe mocha's BDD language
     */
    mustNotMixLanguages,

    /**
     * Is triggered if a background uses when or then
     */
    backgroundMustOnlyIncludeGiven,

    /**
     * Using the before hook has the same affect as the given step definition but with the ability to convey meaning.
     * It is therefore encouraged to use a given over the before hook.
     */
    enforceUsingGivenOverBefore,

    /**
     * Ensures that a title is specified for keywords that require it
     */
    enforceTitle
}