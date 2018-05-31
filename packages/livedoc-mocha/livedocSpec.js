/*
    This file is to allow referencing the reporter directly via livedoc-mocha/livedocSpec
    rather than livedoc-mocha/release/livedocSpec
*/

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reporter_1 = require("./release/reporter");
function livedocSpec(runner, options) {
    new reporter_1.LiveDocSpec(runner, options);
}
exports = module.exports = livedocSpec;