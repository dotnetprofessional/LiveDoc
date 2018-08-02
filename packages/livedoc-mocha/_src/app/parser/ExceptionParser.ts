// import * as callsites from "callsites";

const slash = "/";
export class ExceptionParser {
    public parse(error: Error): Error {
        //const errors = callsites();
        debugger;
        // const exception = new ExceptionEx();
        // exception.linenumber = errors[0].linenumber;

        // return exception;
        return this.cleanError(error);
    }

    private cleanError(e) {
        if (!e.stack) return e;
        var stack = e.stack.split('\n');
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

            // experimental: show errors in a format
            // like "example/foo.js:10:19: at functionName"
            // if (env().FILENAMES_FIRST)
            //     line = reorderFilename(line);

            list.push(line);
            return list;
        }, []);

        e.stack = stack.join('\n');
        return e;
    }

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

    /*
     * puts filenames first.
     *
     *     "   at foobar (example.js:2:3)"
     *     => "example.js:2:3: foobar"
     *
     *     "   at example.js:2:3"
     *     => "example.js:2:3:"
     */

    // private reorderFilename(line) {
    //     var m;
    //     m = line.match(/^(\s*)at (.*?) \(native\)$/);
    //     if (m) return "" + m[1] + "[native]: " + m[2];

    //     m = line.match(/^(\s*)at (.*?) \((.*?)\)$/);
    //     if (m) return "" + m[1] + m[3] + ": " + m[2];

    //     m = line.match(/^(\s*)at (.*?)$/);
    //     if (m) return "" + m[1] + m[2] + ":";

    //     return line;
    // }


}

export class ExceptionEx {
    public linenumber: number;
    public message: string;
    public functionName: string;
    public filename: string;
    public stackTrace: string;
}