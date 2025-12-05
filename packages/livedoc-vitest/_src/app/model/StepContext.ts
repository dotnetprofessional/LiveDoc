import type { DataTableRow } from "../types";

/**
 * Framework metadata about the current step
 * READ-ONLY - contains title, parsed values, tables, docStrings
 * Provides helpers for accessing step data in various formats
 */
export class StepContext {
    private _table?: DataTableRow[];

    public title: string = "";
    public displayTitle: string = "";
    public dataTable: DataTableRow[] = [];
    public docString: string = "";
    public type: string = "";
    public values: any[] = [];
    public valuesRaw: string[] = [];

    /**
     * Parse docString as JSON entity
     */
    public get docStringAsEntity(): any {
        if (!this.docString) return undefined;
        try {
            return JSON.parse(this.docString);
        } catch {
            return undefined;
        }
    }

    /**
     * Get data table with headers as column names
     */
    public get table(): DataTableRow[] {
        if (!this._table && this.dataTable.length > 0) {
            this._table = this.convertToTable(this.dataTable);
        }
        return this._table || [];
    }

    /**
     * Convert 2-column table to key-value entity
     */
    public get tableAsEntity(): DataTableRow | undefined {
        if (this.dataTable.length === 0 || this.dataTable[0].length > 2) {
            return undefined;
        }

        return this.convertDataTableRowToEntity(this.dataTable);
    }

    /**
     * Get data table as-is (raw array of arrays)
     */
    public tableAsList(): DataTableRow[] {
        return this.dataTable;
    }

    /**
     * Get first column as single array
     */
    public get tableAsSingleList(): any[] {
        if (this.dataTable.length === 0) {
            return [];
        }

        const list: any[] = [];
        for (const row of this.dataTable) {
            const value = Array.isArray(row) ? row[0] : Object.values(row)[0];
            list.push(this.coerceValue(value));
        }
        return list;
    }

    private convertToTable(dataTable: DataTableRow[]): DataTableRow[] {
        if (dataTable.length < 2) return [];

        const table: DataTableRow[] = [];
        const headers = dataTable[0] as any[];

        for (let i = 1; i < dataTable.length; i++) {
            const row: DataTableRow = {};
            const dataRow = dataTable[i] as any[];
            for (let col = 0; col < headers.length; col++) {
                row[headers[col].toString()] = this.coerceValue(dataRow[col]);
            }
            table.push(row);
        }

        return table;
    }

    private convertDataTableRowToEntity(dataTable: DataTableRow): DataTableRow {
        const entity: DataTableRow = {};
        const rows = dataTable as any[][];
        for (const row of rows) {
            entity[row[0].toString()] = this.coerceValue(row[1]);
        }
        return entity;
    }

    private coerceValue(valueString: string): any {
        try {
            return JSON.parse(valueString, (_key, value) => this.convertToDateIfPossible(value));
        } catch {
            return this.convertToDateIfPossible(valueString);
        }
    }

    private convertToDateIfPossible(value: any): any {
        if (typeof value !== 'string') return value;
        if (/^(\d{4}|\d{2})[-\/]\d{2}[-\/](\d{4}|\d{2})/.test(value)) {
            return new Date(value);
        }
        return value;
    }
}
