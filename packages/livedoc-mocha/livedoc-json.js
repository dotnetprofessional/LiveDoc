/*
    This file is to allow referencing the reporter directly via livedoc-mocha/livedocSpec
    rather than livedoc-mocha/release/livedocSpec
*/

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const postReporter_json = require("./release/reporter");
exports = module.exports = postReporter_json.JsonReporter;