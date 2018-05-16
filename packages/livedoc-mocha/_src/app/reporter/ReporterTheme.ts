import * as model from "../model";
import { ReportWriter } from "./ReportWriter";
import { ColorTheme } from ".";
import { LiveDocSuite, LiveDocTest } from "../model";

export interface ReporterTheme {
    colorTheme: ColorTheme;
    options: Object;

    featureStart(feature: model.Feature, output: ReportWriter): void;
    featureEnd(feature: model.Feature, output: ReportWriter): void;

    scenarioStart(scenario: model.Scenario, output: ReportWriter): void;
    scenarioEnd(scenario: model.Scenario, output: ReportWriter): void;

    scenarioOutlineStart(scenario: model.ScenarioOutline, output: ReportWriter): void;
    scenarioOutlineEnd(scenario: model.ScenarioOutline, output: ReportWriter): void;

    scenarioExampleStart(example: model.ScenarioExample, output: ReportWriter): void;
    scenarioExampleEnd(example: model.ScenarioExample, output: ReportWriter): void;

    backgroundStart(background: model.Background, output: ReportWriter): void;
    backgroundEnd(background: model.Background, output: ReportWriter): void;

    stepStart(step: model.StepDefinition, output: ReportWriter): void;
    stepEnd(step: model.StepDefinition, output: ReportWriter): void;

    stepExampleStart(step: model.StepDefinition, output: ReportWriter): void;
    stepExampleEnd(step: model.StepDefinition, output: ReportWriter): void;

    executionStart(output: ReportWriter): void;
    executionEnd(results: model.ExecutionResults, output: ReportWriter): void;

    suiteStart(suite: LiveDocSuite, output: ReportWriter): void;
    suiteEnd(suite: LiveDocSuite, output: ReportWriter): void;

    testStart(test: LiveDocTest<model.MochaSuite>, output: ReportWriter): void;
    testEnd(test: LiveDocTest<model.MochaSuite>, output: ReportWriter): void;
}
