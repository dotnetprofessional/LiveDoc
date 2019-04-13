import { Chalk } from "chalk";
import chalk from "chalk";
import { ColorTheme } from "./ColorTheme";

export class DefaultColorTheme implements ColorTheme {
    tags: Chalk = chalk.gray;
    comments: Chalk = chalk.green;
    keyword: Chalk = chalk.yellow;

    featureTitle: Chalk = chalk.whiteBright;
    featureDescription: Chalk = chalk.white;

    backgroundTitle: Chalk = this.featureTitle;
    backgroundDescription: Chalk = this.featureDescription;

    scenarioTitle: Chalk = this.featureTitle;
    scenarioDescription: Chalk = this.featureDescription;

    stepTitle: Chalk = this.featureTitle;
    stepDescription: Chalk = this.featureDescription;
    stepKeyword: Chalk = this.keyword;

    statusPending: Chalk = chalk.cyanBright;
    statusUnknown: Chalk = chalk.redBright;
    statusPass: Chalk = chalk.green;
    statusFail: Chalk = chalk.redBright;

    dataTable: Chalk = chalk.grey;
    dataTableHeader: Chalk = chalk.green;
    docString: Chalk = chalk.whiteBright;
    valuePlaceholders: Chalk = chalk.cyan;

    summaryHeader: Chalk = chalk.whiteBright;
}