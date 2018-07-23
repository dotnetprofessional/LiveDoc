export interface IFormattedTableResult {
    table?: string[][];
    error?: string;
}

export function rawTextToFormattedTable(rawText: string): IFormattedTableResult {
    const columnWidths: number[] = [];
    let table = parseTableToArray(rawText, columnWidths);

    if (!validateTableStructure(table)) {
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

    let hasCommentedRecords = false;
    let commentPatternMaxLength = 0;

    const rows = rawTable.split(/\r?\n/);
    const table = rows.map(row => {
        let rowTrimmed = row.trim();

        let commentMatch = /^(#|\/\/)[^\|]*\|/.exec(rowTrimmed);
        const isCommented = !!commentMatch;
        const commentPattern = commentMatch && commentMatch[1];

        rowTrimmed = commentPattern && rowTrimmed.slice(commentPattern.length).trim() || rowTrimmed;
        rowTrimmed = rowTrimmed.replace(/^\||\|$/g, "");

        let cols = rowTrimmed.split("|");
        cols = cols.map((value, index) => {
            value = value.trim();

            if (outDataLengths.length <= index) {
                outDataLengths.push(value.length);
            } else {
                outDataLengths[index] = outDataLengths[index] < value.length && value.length || outDataLengths[index];
            }

            return value;
        });

        (<any>cols).isCommented = isCommented;
        (<any>cols).commentPattern = commentPattern;
        commentPatternMaxLength = commentPattern && commentPattern.length > commentPatternMaxLength && commentPattern.length || commentPatternMaxLength;
        hasCommentedRecords = hasCommentedRecords || isCommented;
        return cols;
    });

    (<any>table).hasCommentedRecords = hasCommentedRecords;
    (<any>table).commentPatternMaxLength = commentPatternMaxLength;
    return table;
}

function validateTableStructure(table: string[][]): boolean {
    const expectedNumberOfColumns = table[0].length;
    return table.every(row => row.length === expectedNumberOfColumns);
}

function padColumnValues(table: string[][], columnWidths: number[]): string[][] {
    table.forEach(row => {
        row.forEach((colValue, index) => {
            row[index] = padValue(colValue, columnWidths[index]);
        });
    });
    return table;
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