import { LiveDocRules } from "./LiveDocRules";
import { CommandLineOptions } from "./CommandLineOptions";
import { LiveDocRuleOption } from "./LiveDocRuleOption";

export class LiveDoc {
    constructor () {
        this.defaultRecommendations();
    }

    public rules: LiveDocRules = new LiveDocRules();
    public options: CommandLineOptions = new CommandLineOptions();

    public shouldMarkAsPending(tags: string[]): boolean {
        return this.markedAsExcluded(tags) && (!this.markedAsIncluded(tags) || this.options.showFilterConflicts);
    }

    public shouldInclude(tags: string[]): boolean {
        return this.markedAsIncluded(tags) && (!this.markedAsExcluded(tags) || this.options.showFilterConflicts);
    }

    public markedAsExcluded(tags: string[]): boolean {
        // exclusions
        for (let i = 0; i < this.options.exclude.length; i++) {
            if (tags.indexOf(this.options.exclude[i]) > -1) {
                // found a match so return true
                return true;
            }
        }

        return false;
    }

    public markedAsIncluded(tags: string[]): boolean {
        // exclusions
        for (let i = 0; i < this.options.include.length; i++) {
            if (tags.indexOf(this.options.include[i]) > -1) {
                // found a match so return true
                return true;
            }
        }

        return false;
    }
    /**
     * Sets the minimal set of rules to ensure tests are structured correctly
     * 
     * @memberof LiveDoc
     */
    public enforceMinimalRulesOnly() {
        this.setAllRulesTo(LiveDocRuleOption.disabled);
        const option = LiveDocRuleOption.enabled;

        this.rules.missingFeature = option;
        this.rules.givenWhenThenMustBeWithinScenario = option;
        this.rules.mustNotMixLanguages = option;
        this.rules.backgroundMustOnlyIncludeGiven = option;
        this.rules.enforceUsingGivenOverBefore = option;
        this.rules.enforceTitle = option;
    }

    /**
     * Sets the recommended set of rules to ensure best practices
     * 
     * @memberof LiveDoc
     */
    public defaultRecommendations() {
        this.enforceMinimalRulesOnly();

        const option = LiveDocRuleOption.enabled;

        this.rules.singleGivenWhenThen = option;
        this.rules.mustIncludeGiven = LiveDocRuleOption.warning;
        this.rules.mustIncludeWhen = LiveDocRuleOption.warning;
        this.rules.mustIncludeThen = LiveDocRuleOption.warning;
        this.rules.andButMustHaveGivenWhenThen = option;
    }

    /**
     * Sets all rules to warnings
     * 
     * @memberof LiveDoc
     */
    public setAllRulesAsWarnings() {
        this.setAllRulesTo(LiveDocRuleOption.warning);
    }

    private setAllRulesTo(option: LiveDocRuleOption) {
        this.rules.missingFeature = option;
        this.rules.givenWhenThenMustBeWithinScenario = option;
        this.rules.singleGivenWhenThen = option;
        this.rules.mustIncludeGiven = option;
        this.rules.mustIncludeWhen = option;
        this.rules.mustIncludeThen = option;
        this.rules.andButMustHaveGivenWhenThen = option;
        this.rules.mustNotMixLanguages = option;
        this.rules.backgroundMustOnlyIncludeGiven = option;
        this.rules.enforceUsingGivenOverBefore = option;
        this.rules.enforceTitle = option;
    }
}

