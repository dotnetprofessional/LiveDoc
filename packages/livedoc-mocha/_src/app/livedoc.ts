import { LiveDocRuleOption } from "./LiveDocRuleOption";
import * as mocha from "mocha";
import { ExecutionResults } from "./model/ExecutionResults";
import { LiveDocOptions } from "./LiveDocOptions";
import { ParserException } from "./model";
import { DefaultReporter, DefaultColorTheme, SilentReporter, ReporterOptions } from "./reporter";

var fs = require('fs'),
    crypto = require('crypto');

export class LiveDoc {
    constructor () {
        this.defaultRecommendations();
        this.useDefaultReporter();
    }

    public options: LiveDocOptions = new LiveDocOptions();

    public shouldMarkAsPending(tags: string[]): boolean {
        return this.markedAsExcluded(tags) && (!this.markedAsIncluded(tags) || this.options.filters.showFilterConflicts);
    }

    public shouldInclude(tags: string[]): boolean {
        if (tags.length === 0) {
            return false;
        }

        return this.markedAsIncluded(tags) && (!this.markedAsExcluded(tags) || this.options.filters.showFilterConflicts);
    }

    public markedAsExcluded(tags: string[]): boolean {
        // exclusions
        if (tags.length === 0) {
            return false;
        }

        for (let i = 0; i < this.options.filters.exclude.length; i++) {
            if (tags.indexOf(this.options.filters.exclude[i]) > -1) {
                // found a match so return true
                return true;
            }
        }

        return false;
    }

    public markedAsIncluded(tags: string[]): boolean {
        // inclusions
        if (tags.length === 0) {
            return false;
        }
        for (let i = 0; i < this.options.filters.include.length; i++) {
            if (tags.indexOf(this.options.filters.include[i]) > -1) {
                // found a match so return true
                return true;
            }
        }

        return false;
    }

    public useDefaultReporter() {
        // define the default reporter options
        this.options.reporterOptions = new ReporterOptions();
        this.options.reporterOptions.reporter = new DefaultReporter();
        this.options.reporterOptions.colors = new DefaultColorTheme();
    }
    /**
     * Sets the minimal set of rules to ensure tests are structured correctly
     * 
     * @memberof LiveDoc
     */
    public enforceMinimalRulesOnly() {
        this.setAllRulesTo(LiveDocRuleOption.disabled);
        const option = LiveDocRuleOption.enabled;

        this.options.rules.backgroundMustOnlyIncludeGiven = option;
        this.options.rules.enforceUsingGivenOverBefore = option;
        this.options.rules.enforceTitle = option;
    }

    /**
     * Sets the recommended set of rules to ensure best practices
     * 
     * @memberof LiveDoc
     */
    public defaultRecommendations() {
        this.enforceMinimalRulesOnly();

        const option = LiveDocRuleOption.enabled;

        this.options.rules.singleGivenWhenThen = option;
        this.options.rules.mustIncludeGiven = LiveDocRuleOption.warning;
        this.options.rules.mustIncludeWhen = LiveDocRuleOption.warning;
        this.options.rules.mustIncludeThen = LiveDocRuleOption.warning;
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
        this.options.rules.singleGivenWhenThen = option;
        this.options.rules.mustIncludeGiven = option;
        this.options.rules.mustIncludeWhen = option;
        this.options.rules.mustIncludeThen = option;
        this.options.rules.backgroundMustOnlyIncludeGiven = option;
        this.options.rules.enforceUsingGivenOverBefore = option;
        this.options.rules.enforceTitle = option;
    }

    public static executeTestAsync(filename: string, livedocOptions: LiveDocOptions = null): Promise<ExecutionResults> {

        // override the default reporter to be the silent one
        livedocOptions.reporterOptions.reporter = new SilentReporter();
        let mochaOptions = {
            ui: 'livedoc-mocha',
            reporter: "build/app/reporter/LiveDocReporter",
            livedoc: livedocOptions
        }

        return new Promise<ExecutionResults>((resolve, reject) => {
            const mochaInstance = new mocha(mochaOptions);

            mochaInstance.addFile(filename);
            (mochaInstance.run() as any)
                .on('end', function (x) {
                    resolve(this.suite.livedocResults);
                });
        });
    }

    public static async executeDynamicTestAsync(feature: string, livedocOptions: LiveDocOptions = new LiveDocOptions()): Promise<ExecutionResults> {
        let filename: string;
        try {
            // Ensure we've been given something!
            if (feature.length === 0) {
                throw new ParserException("feature is empty!", "executeDynamicTestAsync", "");
            }
            filename = LiveDoc.writeToTempFile(feature);
            return await LiveDoc.executeTestAsync(filename, livedocOptions);

        } finally {
            LiveDoc.deleteTempFile(filename);
        }
    }

    private static deleteTempFile(filename: string) {
        fs.unlinkSync(filename);
    }

    private static writeToTempFile(content: string): string {
        const tempFolder = "_temp";

        if (!fs.existsSync(tempFolder)) {
            fs.mkdirSync(tempFolder);
        }

        var filename = '_temp/livedoc' + crypto.randomBytes(4).readUInt32LE(0) + '.feature';
        fs.writeFileSync(filename, content);

        return filename;
    }
}

