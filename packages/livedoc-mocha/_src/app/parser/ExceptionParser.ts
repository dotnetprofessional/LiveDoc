// import * as callsites from "callsites";

const slash = "/";
export class ExceptionParser {

    public printException(error: Error) {
        const cleanException = this.cleanError(error);
        console.log("Error:");
        console.log("Message: " + cleanException.message);
        console.log(cleanException.stack);
    }

    /**
     * Strips out lines from the stack trace that are considered noise and
     * don't aid in understanding the error.
     *
     * @private
     * @param {*} e
     * @returns {Error}
     * @memberof ExceptionParser
     */
    private cleanError(e): Error {
        if (!e.stack) return e;
        var stack = e.stack.split('\n');
        var message = e.message.split('\n');
        // remove message from stack trace
        stack = stack.slice(message.length);
        const cwd = process.cwd() + slash;
        stack = stack.reduce((list, line) => {
            // Strip out certain lines.
            if (this.isNodeModule(line) ||
                this.isMochaInternal(line) ||
                this.isNodeInternal(line) ||
                this.isLiveDocAPI(line) ||
                this.isMochaCleanInternal(line)) {
                return list;
            }

            if (this.isMochaCleanInternal(line)) {
                return list;
            }

            // Clean up cwd.
            //   if (!env().SHOW_ABSOLUTE_PATHS)
            line = line.replace(cwd, "");

            list.push(line);
            return list;
        }, []);

        e.stack = stack.join('\n');
        return e;
    }

    /*
 * detect if a line is from a 3rd-party module.
 */

    /*
     * detect if a line is from a 3rd-party module.
     */

    private isNodeModule(line) {
        return (~line.indexOf('node_modules'));
    }

    private isLiveDocAPI(line) {
        return (~line.indexOf('_src\\app\\'));
    }
    /*
     * detect stuff from mocha itself.
     * usually not needed, but if SHOW_NODE_MODULES is on, you probably wanna
     * suppress this.
     */

    private isMochaInternal(line) {
        return (~line.indexOf('node_modules' + slash + 'mocha'));
    }

    /*
     * detect stuff ignored in the browser.
     */

    // private isBrowserIgnored(line) {
    //     var ignores = mocha.traceIgnores || [];

    //     for (var i = 0, len = ignores.length; i < len; i++) {
    //         var spec = ignores[i];

    //         if ((typeof spec === 'string' && ~line.indexOf(spec)) ||
    //             (typeof spec === 'function' && spec(line)) ||
    //             (spec instanceof RegExp && line.match(spec)))
    //             return true;
    //     }
    // }

    /*
     * detect stuff from this library.
     */

    private isMochaCleanInternal(line) {
        return (~line.indexOf('__mocha_internal__'));
    }

    /*
     * detect internal node errors. Examples:
     *
     *   at Module._compile (module.js:439:25)
     *   at Object.Module._extensions..js (module.js:474:10)
     *   at Module.load (module.js:356:32)
     *   at Function.Module._load (module.js:312:12)
     *   at Module.require (module.js:364:17)
     *   at require (module.js:380:17)
     *   at process._tickCallback (node.js:415:13)
     */

    private isNodeInternal(line) {
        return false ||
            (~line.indexOf('(timers.js:')) ||
            (~line.indexOf('(node.js:')) ||
            (~line.indexOf('(module.js:')) ||
            (~line.indexOf('internal/module')) ||
            (~line.indexOf('internal/bootstrap')) ||
            (~line.indexOf('(domain.js:')) ||
            (~line.indexOf('GeneratorFunctionPrototype.next (native)')) ||
            false;
    }
}

export class ExceptionEx {
    public linenumber: number;
    public message: string;
    public functionName: string;
    public filename: string;
    public stackTrace: string;
}