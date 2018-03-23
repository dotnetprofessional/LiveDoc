import { DescriptionParser } from "../parser/Parser";


export class StepContext {
    private _table: DataTableRow[];
    private _parser = new DescriptionParser();

    public title: string;
    public dataTable: DataTableRow[];

    public docString: string;

    public get docStringAsEntity() {
        return JSON.parse(this.docString);
    }

    public type: string;
    public values: any[];
    public valuesRaw: string[];

    public get table() {
        if (!this._table) {
            // crate a table representation of the dataTable
            this._table = this._parser.getTable(this.tableAsList());
        }
        return this._table;
    }

    public get tableAsEntity(): DataTableRow {
        if (this.dataTable.length === 0 || this.dataTable[0].length > 2) {
            return;
        }

        return this.convertDataTableRowToEntity(this.dataTable);
    }

    private convertDataTableRowToEntity(dataTable: DataTableRow): DataTableRow {
        let entity = {};
        for (let row = 0; row < dataTable.length; row++) {
            // Copy column to header key
            entity[dataTable[row][0].toString()] = this._parser.coerceValue(dataTable[row][1]);
        }
        return entity;
    }

    public tableAsList(): DataTableRow[] {
        return this.dataTable;
    }

    public get tableAsSingleList(): any[] {
        if (this.dataTable.length === 0) {
            return;
        }


        let list = [];
        for (let row = 0; row < this.dataTable.length; row++) {
            // Copy column to header key
            list.push(this._parser.coerceValue(this.dataTable[row][0]));
        }
        return list;
    }
}