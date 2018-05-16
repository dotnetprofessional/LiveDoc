import { Chalk } from "chalk";

export interface ColorTheme {
    featureTitle: Chalk;
    featureDescription: Chalk;

    backgroundTitle: Chalk;
    backgroundDescription: Chalk;

    scenarioTitle: Chalk;
    scenarioDescription: Chalk;
    // scenarioExampleValue: Chalk;

    stepTitle: Chalk;
    stepDescription: Chalk;
    stepKeyword: Chalk;

    statusPass: Chalk;
    statusFail: Chalk;
    statusPending: Chalk;
    statusUnknown: Chalk;

    tags: Chalk;
    comments: Chalk;
    keyword: Chalk;

    dataTableHeader: Chalk;
    dataTable: Chalk;
    docString: Chalk;
}
