export interface IFormattedTableResult {
    table?: string[][];
    error?: string;
}

export function rawTextToFormattedTable(rawText: string): IFormattedTableResult {
    const columnWidths: number[] = [];
    let table = parseTableToArray(rawText, columnWidths);

    if(!validateTableStructure(table)) {
        return {
            error: "Data table is not structured properly"
        };
    }

    table = padColumnValues(table, columnWidths);

    return {
        table
    };
}

function parseTableToArray(rawTable: string, outDataLengths: number[]): string[][] {
    if (!outDataLengths) {
        throw "outDataLengths must be initialized to an empty array";
    }

    const rows = rawTable.split(/\r?\n/);
    const table = rows.map(row => {
        let cols = row.replace(/^(\s|\t)*\|/, "").replace(/\|(\s|\t)*$/, "").split("|");
        cols = cols.map((value, index) => {
            value = value.trim();

            if (outDataLengths.length <= index) {
                outDataLengths.push(value.length);
            } else {
                outDataLengths[index] = outDataLengths[index] < value.length && value.length || outDataLengths[index];
            }

            return value;
        });
        return cols;
    });

    return table;
}

function validateTableStructure(table: string[][]): boolean {
    const expectedNumberOfColumns = table[0].length;
    return table.every(row => row.length === expectedNumberOfColumns);
}

function padColumnValues(table: string[][], columnWidths: number[]): string[][] {
    return table.map(row => {
        return row.map((colValue, index) =>{
            return padValue(colValue, columnWidths[index]);
        });
    });
}

function padValue(v: string, columnWidth: number): string {
    const padRight = Number.isNaN(Number(v));
    let padding: string[] = [];

    let paddingNeeded = columnWidth - v.length;
    paddingNeeded += 2; // leading and trailing space for whitespace
    padding = Array(paddingNeeded);

    if (padRight) {
        padding.splice(1, 0, v);
    } else {
        padding.splice(padding.length - 1, 0, v);
    }

    return padding.join(" ");
}