/**
 * Global type definitions for LiveDoc-Vitest
 */

import type { Feature } from "./model/Feature";
import type { Scenario } from "./model/Scenario";
import type { VitestSuite } from "./model/VitestSuite";

/**
 * Extend Vitest's TaskMeta to include LiveDoc context
 */
declare module "@vitest/runner" {
    interface TaskMeta {
        livedoc?: Feature | Scenario | VitestSuite;
    }
}

/**
 * Represents a row in a data table
 * Can be an array of values or an object with named columns
 */
export type DataTableRow = any[] | { [key: string]: any };
