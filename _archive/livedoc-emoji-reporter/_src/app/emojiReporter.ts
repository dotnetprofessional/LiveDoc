import * as model from "livedoc-mocha/model";
import * as reporter from "livedoc-mocha/reporter";

exports = module.exports = liveDocEmoji;

function liveDocEmoji(runner, options) {
    new LiveDocEmoji(runner, options);
}

export default class LiveDocEmoji extends reporter.LiveDocReporter {

    protected featureStart(feature: model.Feature): void {
        this.write(feature.title + ": ");
    }

    protected featureEnd(feature: model.Feature): void {
        this.writeLine(" ");
    }

    protected scenarioEnd(scenario: model.Scenario): void {
        this.outputEmoji(scenario);
    }

    protected scenarioExampleEnd(example: model.ScenarioExample) {
        this.outputEmoji(example);
    }

    private outputEmoji(scenario: model.Scenario) {
        if (scenario.statistics.failedCount === 0) {
            this.write("😃 ");
        } else {
            this.write("😡 ");
        }
    }
}