/**
 * Color theme for LiveDoc reporters
 */
export interface ColorTheme {
    tags: (text: string) => string;
    comments: (text: string) => string;
    keyword: (text: string) => string;
    
    featureTitle: (text: string) => string;
    featureDescription: (text: string) => string;
    
    backgroundTitle: (text: string) => string;
    backgroundDescription: (text: string) => string;
    
    scenarioTitle: (text: string) => string;
    scenarioDescription: (text: string) => string;
    
    stepTitle: (text: string) => string;
    stepDescription: (text: string) => string;
    stepKeyword: (text: string) => string;
    
    statusPending: (text: string) => string & { inverse: (text: string) => string };
    statusUnknown: (text: string) => string;
    statusPass: (text: string) => string & { inverse: (text: string) => string };
    statusFail: (text: string) => string & { inverse: (text: string) => string };
    
    dataTable: (text: string) => string & { bold: (text: string) => string };
    dataTableHeader: (text: string) => string;
    docString: (text: string) => string;
    valuePlaceholders: (text: string) => string;
    
    summaryHeader: (text: string) => string;
}

/**
 * Default color theme using chalk
 */
import { Chalk } from "chalk";

// Force chalk to use colors even if it thinks the terminal doesn't support them
// This is needed for Vitest workers which may not have a proper TTY
const chalkInstance = new Chalk({ level: 3 }); // Level 3 = TrueColor support

export const DefaultColorTheme: ColorTheme = {
    tags: chalkInstance.gray,
    comments: chalkInstance.green,
    keyword: chalkInstance.yellow,
    featureTitle: chalkInstance.whiteBright,
    featureDescription: chalkInstance.white,
    backgroundTitle: chalkInstance.whiteBright,
    backgroundDescription: chalkInstance.white,
    scenarioTitle: chalkInstance.whiteBright,
    scenarioDescription: chalkInstance.white,
    stepTitle: chalkInstance.whiteBright,
    stepDescription: chalkInstance.white,
    stepKeyword: chalkInstance.yellow,
    statusPending: chalkInstance.cyanBright as any,
    statusUnknown: chalkInstance.redBright,
    statusPass: chalkInstance.green as any,
    statusFail: chalkInstance.redBright as any,
    dataTable: chalkInstance.grey as any,
    dataTableHeader: chalkInstance.green,
    docString: chalkInstance.whiteBright,
    valuePlaceholders: chalkInstance.cyan,
    summaryHeader: chalkInstance.whiteBright,
};
