/*
    This file is to allow referencing the reporter directly via livedoc-mocha/livedocSpec
    rather than livedoc-mocha/release/livedocSpec
*/

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reporter_1 = require("./release/reporter");
exports = module.exports = reporter_1.JsonReporter;