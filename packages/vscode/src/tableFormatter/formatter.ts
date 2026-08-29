export interface IFormattedTableResult {
    table?: string[][];
    error?: string;
}

export function isOutlineExamplesTable(textBeforeTable: string): boolean {
    const examplesHeader = /(^|\r?\n)[ \t]*Examples\s*:[^\r\n`]*[ \t]*(?:\r?\n[ \t]*)*$/i.exec(textBeforeTable);
    if (!examplesHeader) {
        return false;
    }

    const textBeforeHeader = textBeforeTable.slice(0, examplesHeader.index + examplesHeader[1].length);
    const templateStart = findLastUnescapedBacktick(textBeforeHeader);
    if (templateStart === -1) {
        return false;
    }

    const textBeforeTemplate = textBeforeHeader.slice(0, templateStart);
    return /(?:^|[^\w$])(?:scenarioOutline|ruleOutline)(?:\s*\.\s*(?:only|skip))?\s*\(\s*$/.test(textBeforeTemplate);
}

export function shouldUseRowHeaders(table: string[][], forceColumnHeaders: boolean): boolean {
    if (forceColumnHeaders || table[0].length !== 2) {
        return false;
    }

    const rowHeadersCheck = { simple: true, extended: true };
    const columnHeadersCheck = { simple: true, extended: true };

    for (let rowNdx = 0; rowNdx < table.length; rowNdx++) {
        const row = table[rowNdx];
        if (rowNdx === 0) {
            for (let colNdx = 0; colNdx < row.length; colNdx++) {
                if (!checkHeaderAndShouldContinue(columnHeadersCheck, row[colNdx])) {
                    break;
                }
            }
        }

        if (!checkHeaderAndShouldContinue(rowHeadersCheck, row[0])) {
            break;
        }
    }

    let useRowHeaders = rowHeadersCheck.simple && !columnHeadersCheck.simple || rowHeadersCheck.extended && !columnHeadersCheck.extended;
    if (!useRowHeaders && rowHeadersCheck.simple === columnHeadersCheck.simple && rowHeadersCheck.extended === columnHeadersCheck.extended) {
        useRowHeaders = true;
    }

    return useRowHeaders;
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

function findLastUnescapedBacktick(value: string): number {
    for (let index = value.length - 1; index >= 0; index--) {
        if (value[index] !== "`") {
            continue;
        }

        let slashCount = 0;
        for (let slashIndex = index - 1; slashIndex >= 0 && value[slashIndex] === "\\"; slashIndex--) {
            slashCount++;
        }

        if (slashCount % 2 === 0) {
            return index;
        }
    }

    return -1;
}

function checkHeaderAndShouldContinue(checkedResult: { simple: boolean, extended: boolean }, value: string): boolean {
    const valueIsHeader = isHeader(value);
    checkedResult.simple = checkedResult.simple ? valueIsHeader.simple : checkedResult.simple;
    checkedResult.extended = checkedResult.extended ? valueIsHeader.extended : checkedResult.extended;

    return checkedResult.simple || checkedResult.extended;
}

function isHeader(value: string): { simple: boolean, extended: boolean } {
    const valueTrimmed = value.trim();
    let isString = isNaN(Number(valueTrimmed));
    try {
        isString = typeof JSON.parse(valueTrimmed) === "string";
    } catch (e) {
        isString = true;
    }
    return { simple: isString, extended: false };
}