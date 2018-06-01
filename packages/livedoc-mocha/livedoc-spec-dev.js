/*
    This file is to allow referencing the reporter directly via livedoc-mocha/livedocSpec
    rather than livedoc-mocha/release/livedocSpec
*/

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reporter_2 = require("./build/app/reporter");
function livedocSpec(runner, options) {
    new reporter_2.LiveDocSpec(runner, options);
}
exports = module.exports = livedocSpec;