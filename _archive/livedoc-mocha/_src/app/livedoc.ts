import { LiveDocRuleOption } from "./LiveDocRuleOption";
import * as mocha from "mocha";
import { ExecutionResults } from "./model/ExecutionResults";
import { LiveDocOptions } from "./LiveDocOptions";
import { ParserException } from "./model";
import { DefaultColorTheme, ReporterOptions, SilentReporter } from "./reporter";

var fs = require('fs'),
    crypto = require('crypto');

export class LiveDoc {
    constructor() {
        this.recommendedRuleSettings();
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
        this.options.reporterOptions.colors = new DefaultColorTheme();
    }
    /**
     * Sets the minimal set of rules to ensure tests are structured correctly
     * 
     * @memberof LiveDoc
     */
    public defaultRuleSettings() {
        const enabled = LiveDocRuleOption.enabled;

        this.options.rules.singleGivenWhenThen = enabled;
        this.options.rules.backgroundMustOnlyIncludeGiven = enabled;
        this.options.rules.enforceTitle = enabled;
    }

    /**
     * Sets the recommended set of rules to ensure best practices
     * 
     * @memberof LiveDoc
     */
    public recommendedRuleSettings() {
        const warning = LiveDocRuleOption.warning;
        const enabled = LiveDocRuleOption.enabled;

        // minimal
        this.options.rules.singleGivenWhenThen = enabled;
        this.options.rules.backgroundMustOnlyIncludeGiven = enabled;
        this.options.rules.enforceTitle = enabled;

        // Additional recommendations
        this.options.rules.enforceUsingGivenOverBefore = warning;
        this.options.rules.mustIncludeGiven = warning;
        this.options.rules.mustIncludeWhen = warning;
        this.options.rules.mustIncludeThen = warning;
    }

    public static executeTestAsync(filename: string, livedocOptions: LiveDocOptions = null): Promise<ExecutionResults> {

        // Add isolated mode - this prevents command-line parameters from interfering with the options passed in
        livedocOptions.isolatedMode = true;
        // override the default reporter to be the silent one
        let mochaOptions = {
            ui: 'livedoc-mocha',
            reporter: SilentReporter,
            livedoc: livedocOptions,
        }

        return new Promise<ExecutionResults>((resolve, reject) => {
            const mochaInstance = new mocha(mochaOptions as any);

            mochaInstance.addFile(filename);
            (mochaInstance.run(function (failures: number) {
                process.exitCode = failures;  // exit with non-zero status if there were failures
            }) as any)
                .on('end', function () {
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

