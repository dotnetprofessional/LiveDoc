import { LiveDocSpec } from "./reporter";

function livedocSpec(runner, options) {
    new LiveDocSpec(runner, options);
}
exports = module.exports = livedocSpec;