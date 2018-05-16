import * as model from "../model";
import { ReporterTheme } from "./ReporterTheme";
import { ReportWriter } from "./ReportWriter";
import { ColorTheme } from "./ColorTheme";

/**
 * This reporter doesn't produce any output. This is the
 * default reporter used with the executeTest methods.
 *
 * @export
 * @class SilentReporter
 * @implements {ReporterTheme}
 */
export class SilentReporter implements ReporterTheme {
    options: Object;

    colorTheme: ColorTheme;

    executionStart(output: ReportWriter): void {
    }

    executionEnd(results: model.ExecutionResults, output: ReportWriter): void {
    }

    featureStart(feature: model.Feature, output: ReportWriter): void {
    }

    featureEnd(feature: model.Feature, output: ReportWriter): void {
    }

    scenarioStart(scenario: model.Scenario, output: ReportWriter): void {
    }

    scenarioEnd(scenario: model.Scenario, output: ReportWriter): void {
    }

    scenarioOutlineStart(scenario: model.ScenarioOutline, output: ReportWriter): void {
    }

    scenarioOutlineEnd(scenario: model.ScenarioOutline, output: ReportWriter): void {
    }

    scenarioExampleStart(example: model.ScenarioExample, output: ReportWriter): void {
    }

    scenarioExampleEnd(example: model.ScenarioExample, output: ReportWriter): void {
    }

    backgroundStart(background: model.Background, output: ReportWriter): void {
    }

    backgroundEnd(background: model.Background, output: ReportWriter): void {
    }

    stepStart(step: model.StepDefinition, output: ReportWriter): void {
    }

    stepEnd(step: model.StepDefinition, output: ReportWriter): void {
    }

    stepExampleStart(step: model.StepDefinition, output: ReportWriter): void {
    }

    stepExampleEnd(step: model.StepDefinition, output: ReportWriter): void {
    }

    suiteStart(suite: model.LiveDocSuite, output: ReportWriter): void {
    }
    suiteEnd(suite: model.LiveDocSuite, output: ReportWriter): void {
    }
    testStart(test: model.LiveDocTest<model.MochaSuite>, output: ReportWriter): void {
    }
    testEnd(test: model.LiveDocTest<model.MochaSuite>, output: ReportWriter): void {
    }

}
