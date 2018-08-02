/// <reference types="mocha" />
/// <reference path="./globals.d.ts" />

import * as mocha from "mocha";

import { liveDocMocha } from "./LiveDocUI";
import "source-map-support/register";
import { ExceptionParser } from "./parser/ExceptionParser";

(mocha as any).interfaces['livedoc-mocha'] = module.exports = liveDocMocha;

process.on('uncaughtException', function (error) {
    new ExceptionParser().printException(error);
});
