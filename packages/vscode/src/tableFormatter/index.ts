'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import {
    window,
    commands,
    Disposable,
    ExtensionContext,
    TextDocument,
    TextEdit,
    TextLine,
    Range,
    Position,
    workspace,
    TextDocumentWillSaveEvent,
    DecorationRenderOptions,
    DecorationOptions,
    TextEditor,
    TextEditorDecorationType,
    ThemableDecorationAttachmentRenderOptions,
    ThemableDecorationRenderOptions,
    ThemableDecorationInstanceRenderOptions,
    DecorationRangeBehavior,
} from 'vscode';

import {
    rawTextToFormattedTable,
    IFormattedTableResult,
    isOutlineExamplesTable,
    shouldUseRowHeaders
} from "./formatter";

interface ITrackedDocument {
    document: TextDocument;
    decorations: IDocumentDecoration[];
}

const trackedDocuments = [] as ITrackedDocument[];
let formattingErrorDecorationType: TextEditorDecorationType = null;
let headerDecorationType: TextEditorDecorationType = null;
let commentedDecorationType: TextEditorDecorationType = null;

let activeEditor: TextEditor = null;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activateTableFormatter(context: ExtensionContext) {
    const errorRenderOptions: DecorationRenderOptions = {
        border: "solid thin rgba(188,66,66,1)",
        borderStyle: "none none solid none",
        after: {
            contentText: "Data table is not structured properly",
            margin: "50px",
            color: "rgba(188,66,66,1)",
        } as ThemableDecorationAttachmentRenderOptions,
        rangeBehavior: DecorationRangeBehavior.ClosedClosed
    };

    const headerRenderOptions: DecorationRenderOptions = {
        color: "rgb(0, 150, 125)",
        rangeBehavior: DecorationRangeBehavior.ClosedClosed
    };

    formattingErrorDecorationType = window.createTextEditorDecorationType(errorRenderOptions);
    headerDecorationType = window.createTextEditorDecorationType(headerRenderOptions);
    commentedDecorationType = window.createTextEditorDecorationType({
        color: "rgba(34,184,4,1)",
        rangeBehavior: DecorationRangeBehavior.ClosedClosed
    });

    try {
        var disposable = commands.registerCommand('extension.formatDataTables', () => {
            formatDataTablesInCurrentDocument();
        });
        context.subscriptions.push(disposable);
    } catch (e) {
        console.warn("Command 'extension.formatDataTables' already registered.");
    }

    const disposeOnWillSaveTextDocument = workspace.onWillSaveTextDocument(onWillSaveTextDocument);
    const disposeOnActiveEditorChanged = window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);

    const disposeOnDidCloseTextDocument = workspace.onDidCloseTextDocument(doc => {
        const ndx = trackedDocuments.findIndex(te => te.document === doc);
        !!~ndx && trackedDocuments.splice(ndx, 1);
    });

    // Add to a list of disposables which are disposed when this extension is deactivated.
    // context.subscriptions.push(disposable); // Moved inside try-catch
    context.subscriptions.push(disposeOnWillSaveTextDocument);
    context.subscriptions.push(disposeOnActiveEditorChanged);
    context.subscriptions.push(disposeOnDidCloseTextDocument);

    window.activeTextEditor && onDidChangeActiveTextEditor(window.activeTextEditor);
}

// this method is called when your extension is deactivated
export function deactivateTableFormatter() {
    formattingErrorDecorationType = null;
    headerDecorationType = null;
    commentedDecorationType = null;
    trackedDocuments.splice(0, trackedDocuments.length);
}

function onDidChangeActiveTextEditor(editor: TextEditor) {
    if (!editor) {
        return;
    }

    activeEditor = editor;

    let trackedDocument = null;
    if (!(trackedDocument = trackedDocuments.find(td => td.document === editor.document))) {
        const document = editor.document;
        const decorations = [] as IDocumentDecoration[];

        trackedDocument = {
            document,
            decorations,
        };
        trackedDocuments.push(trackedDocument);

        if (window.activeTextEditor === editor) {
            formatDataTablesInCurrentDocument();
        }
    }

    decorateEditor(editor, trackedDocument);
}

function onWillSaveTextDocument(e: TextDocumentWillSaveEvent): void {
    const trackedDocument = trackedDocuments.find(td => td.document === e.document);
    const promise = new Promise<TextEdit[]>((res, rej) => {
        const doc = e.document;
        const replacements = formatDataTables(doc);

        const edits: TextEdit[] = [];
        let i = replacements.length;
        while (i--) {
            const r = replacements[i];
            const edit = new TextEdit(new Range(r.startPosition, r.endPosition), r.content);
            edits.push(edit);
        }

        res(edits);
    });

    const activeDocument = activeEditor.document;
    if (activeDocument === trackedDocument.document) {
        promise
            .then(() => {
                setTimeout(() => {
                    decorateEditor(window.activeTextEditor, trackedDocument);
                }, 0);
            });
    }


    e.waitUntil(promise);
}

function formatDataTablesInCurrentDocument() {
    // Get the current text editor
    let editor = window.activeTextEditor;
    if (!editor) {
        return;
    }

    let doc = editor.document;
    const trackedDocument = trackedDocuments.find(td => td.document === doc);
    const replacements = formatDataTables(doc);

    editor.edit(editBuilder => {
        let i = replacements.length;
        while (i--) {
            const r = replacements[i];
            editBuilder.replace(new Range(r.startPosition, r.endPosition), r.content);
        };
    })
        .then(() => {
            decorateEditor(editor, trackedDocument);
        });
}

interface IDocumentDecoration {
    type: TextEditorDecorationType,
    decorations: DecorationOptions[]
}

function formatDataTables(doc: TextDocument): IReplacement[] {
    const trackedDocument = trackedDocuments.find(td => td.document === doc);
    const editor = window.visibleTextEditors.find(editor => editor.document === doc);
    const rawTables = findTables(doc);

    const docDecorations: IDocumentDecoration[] = []
    const docReplacements: IReplacement[] = [];

    rawTables.forEach(raw => {
        const formatted = rawTextToFormattedTable(raw.content);

        // Error decorations
        const errorDecorations = docDecorations.find(v => v.type === formattingErrorDecorationType) || (docDecorations.push({ type: formattingErrorDecorationType, decorations: [] } as IDocumentDecoration), docDecorations[docDecorations.length - 1]);

        [].push.apply(errorDecorations.decorations, parseResultToDecorations(raw, formatted));

        if (!formatted.error) {
            const headerDocDecorations = docDecorations.find(v => v.type === headerDecorationType) || (docDecorations.push({ type: headerDecorationType, decorations: [] } as IDocumentDecoration), docDecorations[docDecorations.length - 1]);
            const commentDocDecorations = docDecorations.find(v => v.type === commentedDecorationType) || (docDecorations.push({ type: commentedDecorationType, decorations: [] } as IDocumentDecoration), docDecorations[docDecorations.length - 1]);

            const commentPlaceholder = new Array((<any>formatted.table).commentPatternMaxLength + 1).join(" ");
            const lineLead = raw.lineLead.length ? raw.lineLead.slice(0, raw.lineLead.length - commentPlaceholder.length) : raw.lineLead;
            const delta = raw.startPosition.character + lineLead.length + commentPlaceholder.length + 1;

            let headerDecorations: DecorationOptions[] = null;

            const textBeforeTable = doc.getText(new Range(new Position(0, 0), raw.startPosition));
            const useRowHeaders = shouldUseRowHeaders(formatted.table, isOutlineExamplesTable(textBeforeTable));
            headerDecorations = useRowHeaders
                ? decorateRowHeaders(formatted.table, raw.startPosition, delta)
                : decorateColumnHeaders(formatted.table, raw.startPosition, delta);

            [].push.apply(headerDocDecorations.decorations, headerDecorations);

            const content = formatted.table.map((row, lineOffset) => {
                let commentPatternOrPlaceholder = commentPlaceholder;

                let { isCommented, commentPattern } = (<any>row);
                if ((<any>formatted.table).hasCommentedRecords) {
                    commentPatternOrPlaceholder = commentPattern && commentPlaceholder.slice(commentPattern.length) + commentPattern || commentPlaceholder;
                }

                const output = `${lineLead}${commentPatternOrPlaceholder}|${row.join("|")}|\r\n`;

                if (isCommented) {
                    const startPosition = raw.startPosition.translate(lineOffset, lineLead.length);
                    commentDocDecorations.decorations.push({
                        range: new Range(startPosition, startPosition.translate(0, output.length))
                    });
                }

                return output;
            }).join("").replace(/\r\n$/, "");

            docReplacements.push({
                startPosition: raw.startPosition,
                endPosition: raw.endPosition,
                content
            });
        }
    });

    trackedDocument.decorations = docDecorations;
    return docReplacements;
}

function decorateColumnHeaders(table: string[][], basePosition: Position, characterDelta: number): DecorationOptions[] {
    return table[0].map((v, i) => {
        const headerStartPos = basePosition.translate(0, characterDelta);
        const decoration = convertToHeaderDecoration(headerStartPos, headerStartPos.translate(0, v.length));
        characterDelta += v.length + 1;

        // center column heading
        const paddingLength = v.length - v.trim().length;
        let center = Math.floor(paddingLength / 2);
        const h = v.split("");

        while (center && --center) {
            h.splice(0, 0, h.pop());
        }

        table[0][i] = h.join("");

        return decoration;
    });
}

function decorateRowHeaders(table: string[][], basePosition: Position, characterDelta: number): DecorationOptions[] {
    return table.map((r, i) => {
        const v = r[0];
        const headerStartPos = basePosition.translate(i, characterDelta);
        const decoration = convertToHeaderDecoration(headerStartPos, headerStartPos.translate(0, v.length));

        return decoration;
    })
}

interface IReplacement {
    startPosition: Position;
    endPosition: Position;
    content: string;
}

interface IRawTableMetadata {
    startPosition: Position;
    endPosition: Position;
    content: string;
    lineLead: string;
    isCommented: boolean;
}

function findTables(doc: TextDocument) {
    const tables: IRawTableMetadata[] = [];
    let rawTableMetadata: IRawTableMetadata = null;

    for (let lineNumber = 0; lineNumber < doc.lineCount; lineNumber++) {
        const line = doc.lineAt(lineNumber);
        const tableRowPatternMatch = /^\s*(#|\/\/)?\s*\|(?:[^\|]+\|)*[^\|]+\|\s*$/.exec(line.text)
        const processLine = !line.isEmptyOrWhitespace && !!tableRowPatternMatch;
        const isCommented = tableRowPatternMatch && !!tableRowPatternMatch[1];

        if (processLine) {
            rawTableMetadata = rawTableMetadata ||
                {
                    startPosition: line.range.start,
                    endPosition: line.range.end,
                    content: "",
                    lineLead: line.text.slice(0, line.firstNonWhitespaceCharacterIndex),
                    isCommented
                };

            rawTableMetadata.endPosition = line.range.end;
        }

        if (!processLine || lineNumber === doc.lineCount - 1) {
            if (rawTableMetadata) {
                rawTableMetadata.content = doc.getText(new Range(rawTableMetadata.startPosition, rawTableMetadata.endPosition));
                tables.push(rawTableMetadata);
            }
            rawTableMetadata = null;
        }
    }

    return tables;
}

function decorateEditor(editor: TextEditor, trackedDocument: ITrackedDocument) {
    if (!editor) {
        return;
    }

    // Clear any decorations where the current set of document decorations 
    // does not have an entry for the corresponding type
    [formattingErrorDecorationType, headerDecorationType, commentedDecorationType].forEach(decorationType => {
        if (!trackedDocument.decorations.some(docDecoration => docDecoration.type === decorationType)) {
            editor.setDecorations(decorationType, []);
        }
    });

    trackedDocument.decorations.forEach(d => {
        editor.setDecorations(d.type, d.decorations);
    });
}

function parseResultToDecorations(rawMetadata: IRawTableMetadata, parseResult: IFormattedTableResult): DecorationOptions[] {
    if (!parseResult.error) {
        return [];
    }

    return [{
        range: new Range(rawMetadata.startPosition, rawMetadata.endPosition),
        hoverMessage: parseResult.error
    } as DecorationOptions];
}

function convertToHeaderDecoration(startPosition: Position, endPosition: Position): DecorationOptions {
    return {
        range: new Range(startPosition, endPosition)
    } as DecorationOptions;
}