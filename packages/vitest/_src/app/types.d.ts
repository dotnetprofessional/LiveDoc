/**
 * Global type definitions for LiveDoc-Vitest
 */

export type DataTableRow = any[] | { [key: string]: any };

export interface LiveDocMetaTable {
    name: string;
    description: string;
    dataTable: DataTableRow[];
}

export interface LiveDocStepTaskMeta {
    kind: "step";
    step: {
        rawTitle: string;
        type: string;
    };
    scenarioOutline?: {
        title?: string;
        description: string;
        tables: LiveDocMetaTable[];
        tags: string[];
        example: {
            sequence: number;
            values: Record<string, unknown>;
        };
    };
}

export interface LiveDocRuleExampleTaskMeta {
    kind: "ruleExample";
    ruleOutline: {
        title: string;
        description: string;
        tables: LiveDocMetaTable[];
        tags: string[];
        example: {
            sequence: number;
            values: Record<string, unknown>;
        };
    };
}

export interface LiveDocRuleTaskMeta {
    kind: "rule";
    rule: {
        title: string;
        description: string;
        tags: string[];
    };
}

export type LiveDocTaskMeta = LiveDocStepTaskMeta | LiveDocRuleExampleTaskMeta | LiveDocRuleTaskMeta;

/**
 * Extend Vitest's TaskMeta to include LiveDoc context
 */
declare module "@vitest/runner" {
    interface TaskMeta {
        livedoc?: LiveDocTaskMeta;
    }
}
