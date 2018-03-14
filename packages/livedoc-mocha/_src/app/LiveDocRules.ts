import { LiveDocRuleOption } from "./model/LiveDocRuleOption";


export class LiveDocRules {
    /**
     * Is triggered when a scenario, scenarioOutline or background is used without a feature
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public missingFeature: LiveDocRuleOption; //done

    /**
     * Is triggered if a given, when or then is not a child of a scenario, scenarioOutline or background 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public givenWhenThenMustBeWithinScenario: LiveDocRuleOption; //done

    /**
     * Is triggered when more than 1 given, when or then is used within a single scenario, scenarioOutline or background
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public singleGivenWhenThen: LiveDocRuleOption; //done

    /**
     * Is triggered if no given is part of the test 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustIncludeGiven: LiveDocRuleOption; //done

    /**
     * Is triggered if no when is part of the test 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustIncludeWhen: LiveDocRuleOption; //done

    /**
     * Is triggered if no then is part of the test 
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustIncludeThen: LiveDocRuleOption; // not sure how to implement

    /**
     * Is triggered when an and or but doesn't also include a given, when or then
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public andButMustHaveGivenWhenThen: LiveDocRuleOption; //done

    /**
     * Is triggered when the Gherkin language is mixed withe mocha's BDD language
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public mustNotMixLanguages: LiveDocRuleOption; //done

    /**
     * Is triggered if a background uses when or then
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public backgroundMustOnlyIncludeGiven: LiveDocRuleOption;

    /**
     * Using the before hook has the same affect as the given step definition but with the ability to convey meaning.
     * It is therefore encouraged to use a given over the before hook.
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public enforceUsingGivenOverBefore: LiveDocRuleOption;

    /**
     * Ensures that a title is specified for keywords that require it
     * 
     * @type {LiveDocRuleOption}
     * @memberof LiveDocRules
     */
    public enforceTitle: LiveDocRuleOption;

}