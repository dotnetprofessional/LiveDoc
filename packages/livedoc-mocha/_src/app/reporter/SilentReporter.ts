import { LiveDocReporter } from "./LiveDocReporter";

/**
 * Initialize a new SilentReporter reporter.
 *
 * @api public
 * @param {Runner} runner
 */
function silentReporter(runner, options) {
    new SilentReporter(runner, options);
}
exports = module.exports = silentReporter;


/**
 * This reporter doesn't produce any output. This is the
 * default reporter used with the executeTest methods.
 *
 * @export
 * @class SilentReporter
 * @implements {ReporterTheme}
 */
export class SilentReporter extends LiveDocReporter {

}
