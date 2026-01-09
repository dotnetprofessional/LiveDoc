import { Step, Status, TypedValue } from '@livedoc/schema';
import { renderTitle, highlightPlaceholders } from '../lib/title-utils';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Markdown } from './Markdown';
import { useState } from 'react';

type NormalizedCell = {
  text: string;
  type: TypedValue['type'] | 'unknown';
};

type NormalizedDataTable = {
  headers: string[];
  rows: NormalizedCell[][];
  columnAlign: Array<'left' | 'right' | 'center'>;
};

function isValueLikeHeader(text: string): boolean {
  const t = String(text ?? '').trim();
  if (t.length === 0) return true;
  if (/^(true|false|null|undefined)$/i.test(t)) return true;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return true;
  // ISO-ish datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const d = new Date(t);
    return !Number.isNaN(d.getTime());
  }
  return false;
}

function isLikelyKey(text: string): boolean {
  const t = String(text ?? '').trim();
  if (t.length === 0) return false;
  if (t.length > 50) return false;
  // Conservative: typical identifiers/labels (no punctuation-heavy strings)
  return /^[A-Za-z][A-Za-z0-9_\- ]*$/.test(t);
}

function shouldRenderTwoColumnVerticalTable(table: NormalizedDataTable): boolean {
  if (table.headers.length !== 2) return false;
  if (!isValueLikeHeader(table.headers[1])) return false;

  const keys = table.rows
    .map((r) => String(r?.[0]?.text ?? '').trim())
    .filter(Boolean);

  if (keys.length < 2) return false;
  const keyishRatio = keys.filter(isLikelyKey).length / keys.length;
  if (keyishRatio < 0.8) return false;

  const uniq = new Set(keys.map((k) => k.toLowerCase()));
  if (uniq.size !== keys.length) return false;

  return true;
}

interface StepListProps {
  steps: Step[];
  showStatus?: boolean;
  /** Optional example values to highlight in rendered titles (ScenarioOutline / RuleOutline examples) */
  highlightValues?: Record<string, string>;
  /** Hide per-step durations (Business mode default) */
  showDurations?: boolean;
  /** Show stack traces for failures (Developer mode default) */
  showErrorStack?: boolean;
}

export function StepList({ steps, showStatus = true, highlightValues, showDurations = true, showErrorStack = true }: StepListProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <StepItem key={index} step={step} showStatus={showStatus} highlightValues={highlightValues} showDurations={showDurations} showErrorStack={showErrorStack} />
      ))}
    </div>
  );
}

interface StepItemProps {
  step: Step;
  showStatus?: boolean;
  highlightValues?: Record<string, string>;
  showDurations?: boolean;
  showErrorStack?: boolean;
}

function StepItem({ step, showStatus = true, highlightValues, showDurations = true, showErrorStack = true }: StepItemProps) {
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);

  const typeColors: Record<string, string> = {
    given: 'text-given',
    when: 'text-when',
    then: 'text-then',
    and: 'text-muted-foreground/60',
    but: 'text-destructive/60',
  };

  const keywordLabel = (step.keyword?.[0]?.toUpperCase() ?? '') + (step.keyword?.slice(1) ?? '');

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="w-4 h-4 text-pass" />;
      case 'failed': return <XCircle className="w-4 h-4 text-fail" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-pending" />;
      default: return <HelpCircle className="w-4 h-4 text-muted-foreground/40" />;
    }
  };

  const normalizedTable = normalizeDataTable(step.dataTable);
  const keyword = step.keyword?.toLowerCase() || '';
  const isContinuation = ['and', 'but'].includes(keyword);

  return (
    <div className="group relative flex items-start gap-2 py-1 -mx-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
      {/* 1. Status Column (Fixed Width) */}
      <div className="shrink-0 w-5 flex justify-center pt-0.5">
        {showStatus && getStatusIcon(step.execution.status)}
      </div>

      {/* 2. Keyword Column (Fixed Width, Right Aligned) */}
      <div className={cn(
        "shrink-0 w-14 text-right select-none",
        "font-medium text-sm",
        isContinuation && "pr-0",
        typeColors[keyword] || 'text-muted-foreground'
      )}>
        {keyword}
      </div>

      {/* 3. Content Column (Flexible) */}
      <div className="flex-1 min-w-0">
        {/* Title Row */}
        <div className="flex items-baseline justify-between gap-4">
           <div className="text-sm leading-relaxed text-foreground/90 font-medium">
             {renderTitle(step.title, highlightValues)}
           </div>
           
           {showDurations && step.execution.duration > 0 && (
            <span className="shrink-0 text-[10px] font-bold text-muted-foreground/40 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Clock className="w-3 h-3" />
              {step.execution.duration}ms
            </span>
          )}
        </div>

        {step.description && (
          <div className="mt-2 pl-4 border-l-2 border-muted">
             <Markdown content={step.description} className="text-sm text-muted-foreground/80 italic leading-relaxed" />
          </div>
        )}

        {step.docString && (
          <div className="mt-3">
            <div className="relative">
              <div className="absolute -left-3 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
              <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-xl p-4 whitespace-pre-wrap overflow-x-auto border border-border/50 shadow-inner">
                {step.docString}
              </pre>
            </div>
          </div>
        )}

        {normalizedTable && (() => {
          const isVertical = shouldRenderTwoColumnVerticalTable(normalizedTable);

          const headerAsFirstRow: NormalizedCell[] | null = isVertical
            ? [
                { text: normalizedTable.headers[0], type: 'string' },
                formatTypedValue(inferTypedValue(normalizedTable.headers[1]))
              ]
            : null;

          const rowsToRender = isVertical
            ? [headerAsFirstRow!, ...normalizedTable.rows]
            : normalizedTable.rows;

          const align = isVertical
            ? computeColumnAlign(rowsToRender, 2)
            : normalizedTable.columnAlign;

          return (
            // Hang-align the table under the status icon (not under the keyword column)
            <div className="mt-2 -ml-16 inline-block w-fit max-w-full sm:max-w-3xl align-top">
              <div className="rounded-lg max-w-full">
                <table className="table-auto text-xs border-collapse border border-foreground/25 max-w-full">
                  {!isVertical && (
                    <thead>
                      <tr className="bg-primary/10">
                        {normalizedTable.headers.map((h, idx) => {
                          const colAlign = align[idx] ?? 'left';
                          return (
                            <th
                              key={h}
                              className={cn(
                                'px-3 py-1.5 font-extrabold text-foreground/80 uppercase tracking-wide text-[11px] whitespace-nowrap border border-foreground/30 bg-primary/10',
                                colAlign === 'right' && 'text-right',
                                colAlign === 'center' && 'text-center',
                                colAlign === 'left' && 'text-left'
                              )}
                            >
                              {h}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                  )}

                  <tbody>
                    {rowsToRender.map((row, i) => (
                      <tr key={i} className={cn(!isVertical && 'border-t border-border/20')}>
                        {row.map((cell, cIdx) => {
                          const colAlign = align[cIdx] ?? 'left';
                          const isNumeric = cell.type === 'number';
                          const shouldWrap = cell.type === 'string' || cell.type === 'object' || cell.type === 'unknown';
                          const isKeyColumn = isVertical && cIdx === 0;

                          return (
                            <td
                              key={cIdx}
                              className={cn(
                                'px-3 py-1.5 border border-foreground/20 font-mono align-top',
                                isKeyColumn ? 'bg-primary/10 text-foreground/80 font-bold' : 'text-foreground/80',
                                colAlign === 'right' && 'text-right tabular-nums',
                                colAlign === 'center' && 'text-center',
                                colAlign === 'left' && 'text-left',
                                isNumeric && 'whitespace-nowrap',
                                shouldWrap ? 'whitespace-normal wrap-anywhere' : 'whitespace-nowrap'
                              )}
                            >
                              {cell.text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {step.execution.error && (
          <div className="mt-2 -ml-16 rounded-lg border border-destructive/30 bg-destructive/10 overflow-hidden">
            <div
              className={cn(
                "px-3 py-2",
                showErrorStack && step.execution.error?.stack && "cursor-pointer select-none"
              )}
              onClick={() => showErrorStack && step.execution.error?.stack && setIsErrorExpanded(!isErrorExpanded)}
            >
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] leading-relaxed font-mono text-foreground/90 whitespace-pre-wrap wrap-break-word">
                    {step.execution.error.message}
                  </div>

                  {showErrorStack && step.execution.error.stack && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit">
                      {isErrorExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {isErrorExpanded ? 'Hide details' : 'Show details'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {showErrorStack && step.execution.error.stack && isErrorExpanded && (
              <pre className="text-[10px] font-mono text-muted-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-96 scrollbar-thin px-3 py-2 border-t border-destructive/15 animate-in fade-in zoom-in-95 duration-200">
                {step.execution.error.stack}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTypedValue(v: TypedValue): NormalizedCell {
  if (typeof v?.displayFormat === 'string' && v.displayFormat.length > 0) {
    return { text: v.displayFormat, type: v.type ?? 'unknown' };
  }

  switch (v.type) {
    case 'string':
      return { text: String(v.value ?? ''), type: 'string' };
    case 'number':
      return { text: typeof v.value === 'number' ? String(v.value) : String(v.value ?? ''), type: 'number' };
    case 'boolean':
      return { text: typeof v.value === 'boolean' ? String(v.value) : String(v.value ?? ''), type: 'boolean' };
    case 'date': {
      if (typeof v.value === 'string') {
        const d = new Date(v.value);
        if (!Number.isNaN(d.getTime())) return { text: d.toISOString(), type: 'date' };
      }
      return { text: String(v.value ?? ''), type: 'date' };
    }
    case 'object': {
      try {
        return { text: JSON.stringify(v.value), type: 'object' };
      } catch {
        return { text: String(v.value ?? ''), type: 'object' };
      }
    }
    case 'null':
      return { text: 'null', type: 'null' };
    case 'undefined':
      return { text: 'undefined', type: 'undefined' };
    default:
      return { text: String((v as any)?.value ?? ''), type: 'unknown' };
  }
}

function inferTypedValue(value: unknown): TypedValue {
  if (value === null) return { value: null, type: 'null' };
  if (value === undefined) return { value: undefined, type: 'undefined' };
  if (typeof value === 'string') {
    // Best-effort ISO date detection
    const d = new Date(value);
    if (!Number.isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}T/.test(value)) return { value, type: 'date' };
    return { value, type: 'string' };
  }
  if (typeof value === 'number') return { value, type: 'number' };
  if (typeof value === 'boolean') return { value, type: 'boolean' };
  return { value, type: 'object' };
}

function computeColumnAlign(rows: NormalizedCell[][], columnCount: number): Array<'left' | 'right' | 'center'> {
  const align: Array<'left' | 'right' | 'center'> = [];
  for (let c = 0; c < columnCount; c++) {
    const col = rows.map((r) => r[c]).filter(Boolean);
    const allNumbers = col.length > 0 && col.every((cell) => cell.type === 'number');
    const allBooleans = col.length > 0 && col.every((cell) => cell.type === 'boolean');
    if (allNumbers) align[c] = 'right';
    else if (allBooleans) align[c] = 'center';
    else align[c] = 'left';
  }
  return align;
}

function normalizeDataTable(dataTable: unknown): NormalizedDataTable | null {
  if (!dataTable) return null;

  // Schema shape: { headers: string[], rows: { rowId, values: TypedValue[] }[] }
  if (
    typeof dataTable === 'object' &&
    dataTable !== null &&
    Array.isArray((dataTable as any).headers) &&
    Array.isArray((dataTable as any).rows)
  ) {
    const headers = ((dataTable as any).headers as unknown[]).map((h) => String(h ?? ''));
    const rowValues = ((dataTable as any).rows as any[])
      .map((r) => (Array.isArray(r?.values) ? (r.values as TypedValue[]) : ([] as TypedValue[])))
      .map((values) => values.map((v) => formatTypedValue(v)));

    const columnCount = Math.max(headers.length, ...rowValues.map((r) => r.length));
    const paddedRows = rowValues.map((r) => {
      const copy = r.slice();
      while (copy.length < columnCount) copy.push({ text: '', type: 'unknown' });
      return copy;
    });

    const columnAlign = computeColumnAlign(paddedRows, columnCount);
    return { headers, rows: paddedRows, columnAlign };
  }

  // Viewer legacy shape: { rows: string[][] }
  if (typeof dataTable === 'object' && dataTable !== null && Array.isArray((dataTable as any).rows)) {
    const rows = (dataTable as any).rows as unknown[];
    if (rows.length === 0 || !Array.isArray(rows[0])) return null;
    const headers = (rows[0] as unknown[]).map((c) => String(c ?? ''));
    const body: NormalizedCell[][] = rows
      .slice(1)
      .map((r: any) => (Array.isArray(r) ? r.map((c) => ({ text: String(c ?? ''), type: 'string' } as NormalizedCell)) : []));

    const columnCount = Math.max(headers.length, ...body.map((r) => r.length));
    const paddedRows = body.map((r) => {
      const copy = r.slice();
      while (copy.length < columnCount) copy.push({ text: '', type: 'unknown' });
      return copy;
    });
    const columnAlign = computeColumnAlign(paddedRows, columnCount);
    return { headers, rows: paddedRows, columnAlign };
  }

  // Server shape: DataTableRow[] (array of objects) or string[][]
  if (Array.isArray(dataTable)) {
    if (dataTable.length === 0) return null;

    if (Array.isArray(dataTable[0])) {
      const rows = dataTable as unknown[][];
      const headers = (rows[0] || []).map((c) => String(c ?? ''));
      const body: NormalizedCell[][] = rows
        .slice(1)
        .map((r) => (r || []).map((c) => ({ text: String(c ?? ''), type: 'string' } as NormalizedCell)));

      const columnCount = Math.max(headers.length, ...body.map((rr) => rr.length));
      const paddedRows = body.map((rr) => {
        const copy = rr.slice();
        while (copy.length < columnCount) copy.push({ text: '', type: 'unknown' });
        return copy;
      });
      const columnAlign = computeColumnAlign(paddedRows, columnCount);
      return { headers, rows: paddedRows, columnAlign };
    }

    if (typeof dataTable[0] === 'object' && dataTable[0] !== null) {
      const objects = dataTable as Record<string, unknown>[];
      const headers = Object.keys(objects[0]);
      const body = objects.map((row) =>
        headers.map((h) => {
          const inferred = inferTypedValue((row as any)?.[h]);
          return formatTypedValue(inferred);
        })
      );

      const columnCount = Math.max(headers.length, ...body.map((rr) => rr.length));
      const paddedRows = body.map((rr) => {
        const copy = rr.slice();
        while (copy.length < columnCount) copy.push({ text: '', type: 'unknown' });
        return copy;
      });
      const columnAlign = computeColumnAlign(paddedRows, columnCount);
      return { headers, rows: paddedRows, columnAlign };
    }
  }

  return null;
}

// Template step list for ScenarioOutline (no status, just template)
interface TemplateStepListProps {
  steps: { type: string; title: string }[];
}

export function TemplateStepList({ steps }: TemplateStepListProps) {
  const typeColors: Record<string, string> = {
    Given: 'text-given',
    When: 'text-when',
    Then: 'text-then',
    And: 'text-muted-foreground/70',
    But: 'text-destructive/70',
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isContinuation = ['and', 'but'].includes(step.type.toLowerCase());
        return (
          <div key={index} className={cn("flex items-baseline gap-3 pl-8 py-1", isContinuation && "ml-8")}>
            <span className={cn(
              "font-black text-[10px] uppercase tracking-[0.2em] shrink-0 w-16",
              typeColors[step.type] || 'text-muted-foreground'
            )}>
              {step.type}
            </span>
            <span className="text-[15px] text-foreground/80 font-medium">
              {highlightPlaceholders(step.title)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
