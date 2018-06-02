/// <reference types="mocha" />
/// <reference path="./globals.d.ts" />

export * from "./model";
import * as mocha from "mocha";

import { liveDocMocha } from "./LiveDocUI";

(mocha as any).interfaces['livedoc-mocha'] = module.exports = liveDocMocha;


