import type { DataTableRow } from "../types";
import type { Attachment } from "@swedevtools/livedoc-schema";

let _attachmentCounter = 0;
function nextAttachmentId(): string {
    return `att-${Date.now()}-${++_attachmentCounter}`;
}

/**
 * Framework metadata about the current step
 * READ-ONLY - contains title, parsed values, tables, docStrings
 * Provides helpers for accessing step data in various formats
 */
export class StepContext {
    private _table?: DataTableRow[];
    private _attachments: Attachment[];

    public title: string = "";
    public displayTitle: string = "";
    public dataTable: DataTableRow[] = [];
    public docString: string = "";
    public type: string = "";
    public values: any[] = [];
    public valuesRaw: string[] = [];
    public params: Record<string, any> = {};
    public paramsRaw: Record<string, string> = {};

    constructor(attachments?: Attachment[]) {
        this._attachments = attachments ?? [];
    }

    /**
     * Attach arbitrary data (base64-encoded) to this step.
     */
    attach(data: string, opts?: { title?: string; mimeType?: string; kind?: 'image' | 'screenshot' | 'file' }): void {
        this._attachments.push({
            id: nextAttachmentId(),
            kind: opts?.kind ?? 'file',
            title: opts?.title,
            mimeType: opts?.mimeType ?? 'application/octet-stream',
            base64: data,
        });
    }

    /**
     * Convenience: attach a PNG screenshot.
     */
    attachScreenshot(base64: string, title?: string): void {
        this.attach(base64, { title, mimeType: 'image/png', kind: 'screenshot' });
    }

    /**
     * Convenience: attach a JSON payload (e.g., API response).
     */
    attachJSON(data: unknown, title?: string): void {
        const json = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        const base64 = typeof globalThis.btoa === 'function'
            ? globalThis.btoa(unescape(encodeURIComponent(json)))
            : Buffer.from(json, 'utf-8').toString('base64');
        this.attach(base64, { title, mimeType: 'application/json', kind: 'file' });
    }

    /** Attachments collected during step execution. */
    public get attachments(): Attachment[] {
        return this._attachments;
    }

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
