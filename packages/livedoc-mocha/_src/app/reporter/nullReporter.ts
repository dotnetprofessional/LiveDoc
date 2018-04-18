import * as model from "../model"
import { LiveDocContext } from "../LiveDocContext";
import * as cliTable from "cli-table2";
import { TextBlockReader } from "../parser/TextBlockReader";
import chalk from "chalk";
import { SpecStatus } from "../model/SpecStatus";

//import * as fs from "fs-extra";

/**
 * Module dependencies.
 */

var Base = require('mocha').reporters.Base;

/**
 * Initialize a new `JSON` reporter.
 *
 * @api public
 * @param {Runner} runner
 */
function nullReporter(runner) {
    new NullReporter(runner);
}
exports = module.exports = nullReporter;

class NullReporter {
    constructor (runner) {
        Base.call(this, runner);
        runner.on('suite', function (suite) { });

        runner.on('suite end', function () {
            console.log("suite end...");
        });

        runner.on('test', function (test: Mocha.ITest) {
            debugger;
            console.log("test...");
        });

        runner.on('test end', function (test: Mocha.ITest) {
            console.log("test end...");
        });

        runner.on('pass', function (test: Mocha.ITest) {
            (test as any).step.status = SpecStatus.pass;
            console.log("Pass....");
        });

        runner.on('fail', function (test: any) {
            debugger;
            const step: model.Test = test.step;
            step.status = SpecStatus.fail;
            test = test as any;
            if (test.err) {
                step.exception.actual = test.err.actual || "";
                step.exception.expected = test.err.expected || "";
                step.exception.stackTrace = test.err.stack || "";
                step.exception.message = test.err.message || "";
            }
            console.log("Fail...");
        });

        runner.on('pending', function (test: Mocha.ITest) {
            (test as any).step.status = SpecStatus.pending;
        });

        runner.on('end', function () {
            console.log("end...");
        });

    }

    async done(failures, exit) {
        console.log("Exiting ....");
        exit && exit(failures);
    }
}
