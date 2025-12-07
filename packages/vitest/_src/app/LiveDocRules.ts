import { LiveDocRuleOption } from "./LiveDocRuleOption";

export class LiveDocRules {
    /**
     * Is triggered when more than 1 given, when or then is used within a single scenario, scenarioOutline or background
     */
    public singleGivenWhenThen: LiveDocRuleOption = LiveDocRuleOption.disabled;

    /**
     * Is triggered if no given is part of the test
     */
    public mustIncludeGiven: LiveDocRuleOption = LiveDocRuleOption.disabled;

    /**
     * Is triggered if no when is part of the test
     */
    public mustIncludeWhen: LiveDocRuleOption = LiveDocRuleOption.disabled;

    /**
     * Is triggered if no then is part of the test
     */
    public mustIncludeThen: LiveDocRuleOption = LiveDocRuleOption.disabled;

    /**
     * Is triggered if a background uses when or then
     */
    public backgroundMustOnlyIncludeGiven: LiveDocRuleOption = LiveDocRuleOption.disabled;

    /**
     * Using the before hook has the same affect as the given step definition but with the ability to convey meaning.
     * It is therefore encouraged to use a given over the before hook.
     */
    public enforceUsingGivenOverBefore: LiveDocRuleOption = LiveDocRuleOption.disabled;

    /**
     * Ensures that a title is specified for keywords that require it
     */
    public enforceTitle: LiveDocRuleOption = LiveDocRuleOption.disabled;
}
