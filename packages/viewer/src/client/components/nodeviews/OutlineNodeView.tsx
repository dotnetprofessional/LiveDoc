import type { DataTable, ExecutionResult, Status, TypedValue } from '@swedevtools/livedoc-schema';
import { CheckCircle2, HelpCircle, Layers, XCircle, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { formatDuration } from '../../lib/status-utils';
import { renderTitle, stripLeadingKindLabel } from '../../lib/title-utils';
import { Markdown } from '../Markdown';
import { StepList } from '../StepList';
import { ScenarioBlock } from '../ScenarioBlock';
import { ErrorDisplay } from '../ErrorDisplay';

export interface OutlineNodeViewProps {
  label: 'Scenario Outline' | 'Rule Outline';
  node: any;
  isBusiness: boolean;
  tone: 'scenario' | 'background';
  // Used for failure metadata (filename/code) when available
  featurePath?: string;
}

export function OutlineNodeView({ label, node, isBusiness, tone, featurePath }: OutlineNodeViewProps) {
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExampleId(null);
  }, [node?.id]);

  const kind = String(node?.kind ?? '').toLowerCase();
  const isOutline = kind === 'scenariooutline' || kind === 'ruleoutline';
  if (!isOutline) return null;

  const formatTypedValue = (v: TypedValue | undefined): string => {
    if (!v) return '';
    if (typeof v.displayFormat === 'string' && v.displayFormat.length > 0) return v.displayFormat;
    if (v.value === null) return 'null';
    if (v.value === undefined) return '';
    return String(v.value);
  };

  const looksLikeDataTables = (arr: unknown): arr is DataTable[] => {
    if (!Array.isArray(arr)) return false;
    const first = (arr as any[])[0];
    return !!first && Array.isArray(first.headers) && Array.isArray(first.rows);
  };

  const templateSteps: any[] = (() => {
    const template = (node as any).template;
    if (template) {
      if (Array.isArray((template as any).children)) return ((template as any).children as any[]);
      if (Array.isArray((template as any).steps)) return ((template as any).steps as any[]);
    }

    const steps = (node as any).steps;
    if (Array.isArray(steps)) return steps as any[];
    return [];
  })();

  const stepIdSet = useMemo(() => {
    const ids = new Set<string>();
    for (const s of templateSteps) {
      const id = String(s?.id ?? '').trim();
      if (id) ids.add(id);
    }
    return ids;
  }, [templateSteps]);

  const exampleDataTables = looksLikeDataTables((node as any).examples) ? ((node as any).examples as DataTable[]) : undefined;
  const allTables = exampleDataTables
    ? (exampleDataTables as any[])
    : Array.isArray((node as any).tables)
      ? ((node as any).tables as any[])
      : [];

  const exampleResults = Array.isArray((node as any).exampleResults)
    ? (((node as any).exampleResults as Array<{ testId: string; result: ExecutionResult }>) ?? [])
    : [];

  const resultsByKey = useMemo(() => {
    const m = new Map<string, ExecutionResult>();
    for (const entry of exampleResults) {
      const rowId = Number(entry?.result?.rowId);
      if (!Number.isFinite(rowId)) continue;
      m.set(`${rowId}|${String(entry.testId)}`, entry.result);
    }
    return m;
  }, [exampleResults]);

  // Row-level result selection: prefer outline-level results, otherwise pick any non-step result.
  const rowResultsByRowId = useMemo(() => {
    const m = new Map<number, ExecutionResult>();
    const outlineId = String((node as any)?.id ?? '');

    const byRow = new Map<number, Array<{ testId: string; result: ExecutionResult }>>();
    for (const entry of exampleResults) {
      const rowId = Number(entry?.result?.rowId);
      if (!Number.isFinite(rowId)) continue;
      const list = byRow.get(rowId) ?? [];
      list.push(entry);
      byRow.set(rowId, list);
    }

    for (const [rowId, entries] of byRow) {
      const nonStep = entries.filter((e) => !stepIdSet.has(String(e.testId ?? '')));
      const preferred = nonStep.find((e) => String(e.testId ?? '') === outlineId) ?? nonStep[0];
      if (preferred?.result) m.set(rowId, preferred.result);
    }

    return m;
  }, [node, stepIdSet, exampleResults]);

  const aggregateStatus = (statuses: Status[]): Status => {
    const s = new Set(statuses);
    if (s.has('failed') || s.has('timedOut')) return 'failed';
    if (s.has('cancelled')) return 'cancelled';
    if (s.has('running')) return 'running';
    if (s.has('pending')) return 'pending';
    if (s.has('skipped')) return 'skipped';
    if (s.has('passed')) return 'passed';
    return 'pending';
  };

  type OutlineRow = {
    id: string;
    values: Record<string, string>;
    execution?: ExecutionResult;
    steps?: any[];
  };

  const buildRowsForTable = (table: any | undefined): { headers: string[]; rows: OutlineRow[] } => {
    // v1 mode: table comes from `examples` (DataTable) and execution comes from exampleResults.
    if (exampleDataTables && table && Array.isArray(table.headers) && Array.isArray(table.rows) && table.headers.length > 0) {
      const headers = (table.headers as unknown[]).map((h) => String(h ?? '')).filter(Boolean);

      const rows: OutlineRow[] = (table.rows as any[]).map((r: any) => {
        const rowIdNum = Number(r?.rowId);
        const rowId = Number.isFinite(rowIdNum) ? rowIdNum : NaN;
        const id = Number.isFinite(rowId) ? String(rowId) : `row:${Math.random().toString(36).slice(2)}`;

        const vals = Array.isArray(r?.values) ? (r.values as TypedValue[]) : [];
        const values = headers.reduce<Record<string, string>>((acc, h, idx) => {
          acc[h] = formatTypedValue(vals[idx]);
          return acc;
        }, {});

        if (!Number.isFinite(rowId)) return { id, values };

        const patchedSteps = (templateSteps as any[]).map((s: any) => {
          const result = resultsByKey.get(`${rowId}|${String(s?.id ?? '')}`);
          return result ? { ...s, execution: result } : s;
        });

        const stepExecutions: ExecutionResult[] = (templateSteps as any[])
          .map((s: any) => resultsByKey.get(`${rowId}|${String(s?.id ?? '')}`))
          .filter((x): x is ExecutionResult => !!x);

        const rowResult = rowResultsByRowId.get(rowId);

        const rowStatus: Status | undefined = stepExecutions.length > 0
          ? aggregateStatus(stepExecutions.map((r) => r.status as Status))
          : (rowResult?.status as Status | undefined);

        const rowDuration = stepExecutions.length > 0
          ? stepExecutions.reduce((sum, r) => sum + (Number(r.duration) || 0), 0)
          : (Number(rowResult?.duration) || 0);

        const rowError = stepExecutions.length > 0
          ? stepExecutions.find((r) => r.status === 'failed' && r.error)?.error
          : rowResult?.error;

        const execution = rowStatus
          ? ({ status: rowStatus, duration: rowDuration, error: rowError, rowId } as ExecutionResult)
          : undefined;

        return { id, values, execution, steps: patchedSteps };
      });

      return { headers, rows };
    }

    return { headers: [], rows: [] };
  };

  const exampleTables = (allTables.length > 0 ? allTables : [undefined]).map((t) => {
    const { headers, rows } = buildRowsForTable(t);
    return {
      name: typeof t?.name === 'string' && String(t.name).trim().length > 0 ? String(t.name) : undefined,
      description: typeof t?.description === 'string' ? String(t.description) : undefined,
      headers,
      rows,
    };
  });

  const allRows = exampleTables.flatMap((t) => t.rows);
  const selectedRow = selectedExampleId ? allRows.find((r) => r.id === selectedExampleId) : undefined;
  const selectedValues = selectedRow?.values;
  const selectedSteps = selectedRow?.steps;
  const hasSelectedExecution = !!selectedRow?.execution;
  const hasOutlineDescription = typeof node.description === 'string' && node.description.trim().length > 0;

  const selectedFailureError = (() => {
    if (!selectedRow) return undefined;
    const rowError = selectedRow.execution?.error as { message: string; stack?: string; diff?: string } | undefined;
    if (rowError?.message) return rowError;

    const failedStep = (selectedSteps ?? []).find((s: any) => s?.execution?.status === 'failed' && s?.execution?.error);
    const stepError = failedStep?.execution?.error as { message: string; stack?: string; diff?: string } | undefined;
    if (stepError?.message) return stepError;

    return undefined;
  })();

  const selectedFailureMeta = (() => {
    const failedStep = (selectedSteps ?? []).find((s: any) => s?.execution?.status === 'failed');
    const code = typeof (failedStep as any)?.code === 'string' ? String((failedStep as any).code) : undefined;
    const filename = featurePath;
    return { code, filename };
  })();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="w-6 h-6 text-pass" />;
      case 'failed': return <XCircle className="w-6 h-6 text-fail" />;
      case 'pending': return <AlertCircle className="w-6 h-6 text-pending" />;
      default: return <HelpCircle className="w-6 h-6 text-muted-foreground/40" />;
    }
  };


  return (
    <div className="space-y-2">
      <ScenarioBlock
        label={label}
        title={renderTitle(stripLeadingKindLabel(String(node.title ?? ''), label), selectedValues)}
        status={(node as any).execution?.status as Status | undefined}
        description={node.description}
        tags={node.tags}
        steps={[]}
        showDurations={!isBusiness}
        showErrorStack={!isBusiness}
        tone={tone}
      />

      <div className={cn(hasOutlineDescription ? 'mt-4 space-y-5' : 'mt-1 space-y-3')}>
        {templateSteps.length > 0 && (
          <StepList
            steps={hasSelectedExecution && selectedSteps ? (selectedSteps as any) : (templateSteps as any)}
            showStatus={hasSelectedExecution}
            highlightValues={selectedValues}
            bindValues={selectedValues}
            showDurations={hasSelectedExecution && !isBusiness}
            showErrorStack={false}
          />
        )}

        {exampleTables.length > 0 && exampleTables.some((t) => t.headers.length > 0) && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 px-1">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground tracking-tight flex-1">Examples</h3>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{allRows.length}</span>
            </div>

            {exampleTables.map((table, tableIndex) => (
              <div key={`${tableIndex}:${table.name ?? ''}`} className="space-y-2">
                {(exampleTables.length > 1 || (table.name && table.name.trim().length > 0)) && (
                  <div className="flex items-center gap-2 px-1">
                    <h4 className="text-sm font-semibold text-foreground/90 flex-1">
                      {table.name ? `Examples: ${table.name}` : 'Examples'}
                    </h4>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{table.rows.length}</span>
                  </div>
                )}

                {table.description && table.description.trim().length > 0 && <Markdown content={table.description} className="max-w-3xl" />}

                <div className="overflow-hidden rounded-xl border bg-card">
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/60">
                        <th className="w-10 px-3 py-2 text-center font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50">#</th>
                        <th className="w-12 px-3 py-2 text-center font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50">Status</th>
                        {table.headers.map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-r-0"
                          >
                            {h}
                          </th>
                        ))}
                        <th className="w-20 px-3 py-2 text-right font-bold text-muted-foreground uppercase tracking-widest">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, idx) => {
                        const duration = row.execution?.duration as number | undefined;
                        const isSelected = selectedExampleId === row.id;

                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              'border-b border-border/50 last:border-b-0 transition-colors cursor-pointer group',
                              isSelected ? 'bg-primary/15 ring-1 ring-inset ring-primary/35' : 'hover:bg-muted/30'
                            )}
                            onClick={() => setSelectedExampleId(isSelected ? null : row.id)}
                          >
                            <td className="px-3 py-2 text-center font-mono text-[10px] text-muted-foreground border-r border-border/50">{idx + 1}</td>
                            <td className="px-3 py-2 text-center border-r border-border/50">
                              <div className="flex justify-center">
                                {row.execution?.status ? getStatusIcon(row.execution.status) : getStatusIcon('pending')}
                              </div>
                            </td>
                            {table.headers.map((h) => (
                              <td
                                key={h}
                                className="px-3 py-2 text-foreground/80 border-r border-border/50 last:border-r-0 font-mono text-[11px]"
                              >
                                {row.values[h] ?? ''}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
                              {duration === undefined || duration <= 0
                                ? ''
                                : formatDuration(duration)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedRow && selectedRow.execution?.status === 'failed' && selectedFailureError && (
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <ErrorDisplay
                error={{
                  ...selectedFailureError,
                  code: selectedFailureMeta.code ?? (selectedFailureError as any).code,
                  filename: selectedFailureMeta.filename ?? (selectedFailureError as any).filename,
                }}
                title="Exception Details"
                isBusiness={isBusiness}
                variant="card"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
