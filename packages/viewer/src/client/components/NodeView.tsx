import type { AnyTest, DataTable, ExecutionResult, Statistics, Status, StepTest, TestCase, TypedValue } from '@livedoc/schema';
import { StepList } from './StepList';
import { ChevronRight, CheckCircle2, XCircle, AlertCircle, HelpCircle, Layers, FileText, Home, Tag } from 'lucide-react';
import { useStore } from '../store';
import { renderTitle } from '../lib/title-utils';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { subtreeHasMatch, formatTagLabel } from '../lib/filter-utils';
import { Markdown } from './Markdown';
import { StatusBadge } from './StatusBadge';
import { buildGroupedNavTree, NavItem } from '../lib/nav-tree';
import { ScenarioBlock } from './ScenarioBlock';

interface NodeViewProps {
  node: TestCase | AnyTest;
}

function findNavPath(items: NavItem[], targetId: string): NavItem[] | null {
  for (const item of items) {
    if (item.id === targetId) return [item];
    if (item.kind === 'Group') {
      const found = findNavPath(item.children, targetId);
      if (found) return [item, ...found];
    }
  }
  return null;
}

export function NodeView({ node }: NodeViewProps) {
  const { navigate, audienceMode, getCurrentRun, filterText, filterTags } = useStore();
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExampleId(null);
  }, [node.id]);

  const runState = getCurrentRun();
  const run = runState?.run;
  const kind = String((node as any).kind ?? (node as any).style ?? '').toLowerCase();
  const isBusiness = audienceMode === 'business';

  const isTestCaseNode = (n: TestCase | AnyTest): n is TestCase => {
    return (n as any)?.style !== undefined && Array.isArray((n as any)?.tests);
  };

  const isContainer = isTestCaseNode(node);
  const isOutline = kind === 'scenariooutline' || kind === 'ruleoutline';

  // Build nav tree for breadcrumbs
  const navTree = useMemo(() => run ? buildGroupedNavTree(run.documents ?? []) : [], [run?.documents]);

  // Given any node (Scenario/Step/etc), find the owning Feature by scanning documents.
  // Then resolve background either from feature.background OR a Background node under feature.children.
  const feature = useMemo<TestCase | undefined>(() => {
    if (!run?.documents) return undefined;

    const isFeature = (n: any) => String(n?.style ?? n?.kind ?? '').toLowerCase() === 'feature';

    const containsId = (n: any): boolean => {
      if (!n) return false;
      if (n.id === node.id) return true;

      const children =
        (n.tests as any[] | undefined) ??
        (n.children as any[] | undefined) ??
        (n.steps as any[] | undefined);
      if (Array.isArray(children)) {
        for (const c of children) {
          if (containsId(c)) return true;
        }
      }

      const examples = n.examples as any[] | undefined;
      if (Array.isArray(examples)) {
        for (const e of examples) {
          if (containsId(e)) return true;
        }
      }

      const template = (n as any).template;
      if (template && containsId(template)) return true;

      return false;
    };

    for (const doc of run.documents) {
      if (isFeature(doc) && containsId(doc)) return doc as TestCase;
    }
    return undefined;
  }, [run?.documents, node.id]);

  const background = useMemo<AnyTest | undefined>(() => {
    if (!feature) return undefined;

    // vNext shape
    if ((feature as any).background) return (feature as any).background as AnyTest;

    // Legacy/batch shape: Background as first-class child under Feature
    const bg = (feature as any).children?.find((c: any) =>
      String(c?.kind ?? '').toLowerCase() === 'background'
    );
    return bg as AnyTest | undefined;
  }, [feature]);

  // Get breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (feature) {
      const path = findNavPath(navTree, feature.id);
      return path || [];
    }
    if (isContainer) {
      const path = findNavPath(navTree, node.id);
      return path || [];
    }
    return [];
  }, [navTree, feature, node.id, isContainer]);

  const children = isTestCaseNode(node)
    ? ((node.tests ?? []) as AnyTest[])
    : ('children' in (node as any) ? (node as any).children : undefined);
  const examples = 'examples' in (node as any) ? (node as any).examples : undefined;
  const template = 'template' in (node as any) ? (node as any).template : undefined;

  const isLeafContainer = ['scenario', 'background', 'rule', 'test'].includes(kind);
  const steps = Array.isArray((node as any).steps)
    ? ((node as any).steps as AnyTest[])
    : (isLeafContainer ? (children as AnyTest[] | undefined) : undefined);

  const stepTests = useMemo(() => {
    const arr = (steps ?? []) as AnyTest[];
    return arr.filter((t): t is StepTest => typeof (t as any)?.keyword === 'string');
  }, [steps]);
  const showCards = Array.isArray(children) && !isLeafContainer;

  const kindPrefixTitle = (kindLabel: string, title: string) => `${kindLabel}: ${title}`;

  const formatTypedValue = (v: TypedValue | undefined): string => {
    if (!v) return '';
    if (typeof v.displayFormat === 'string' && v.displayFormat.length > 0) return v.displayFormat;
    if (v.value === null) return 'null';
    if (v.value === undefined) return '';
    return String(v.value);
  };

  const highlightValues = undefined;

  const isScenarioView = !!feature && kind === 'scenario';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="w-6 h-6 text-pass" />;
      case 'failed': return <XCircle className="w-6 h-6 text-fail" />;
      case 'pending': return <AlertCircle className="w-6 h-6 text-pending" />;
      default: return <HelpCircle className="w-6 h-6 text-muted-foreground/40" />;
    }
  };

  const renderExceptionDetails = (error: { message: string; stack?: string; diff?: string }, title: string) => {
    const normalizeFileUrl = (raw: string) => {
      const s = String(raw ?? '');
      return s.startsWith('file:///') ? s.slice('file:///'.length) : s;
    };

    const extractFilenameFromStack = (stack: string | undefined) => {
      if (!stack) return undefined;
      const text = normalizeFileUrl(stack);
      // Matches:
      // - D:/path/file.ts:10:20
      // - file:///D:/path/file.ts:10:20
      // - /path/file.ts:10:20
      const match = text.match(/(?:^|\n)\s*(?:at\s+)?(file:\/\/\/)?([A-Za-z]:\/[^\s)]+?|\/[^\s)]+?):\d+:\d+/);
      const filename = match?.[2];
      return filename ? filename.trim() : undefined;
    };

    return (
      <Card className="bg-destructive/10 border-destructive/30 shadow-none overflow-hidden border-l-4 border-l-destructive">
        <CardHeader className="bg-destructive/15 border-b border-destructive/15 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <h3 className="text-sm font-bold text-destructive uppercase tracking-widest">{title}</h3>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {isBusiness ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
              <div className="text-sm font-medium text-foreground/90 whitespace-pre-wrap font-mono">
                {error.message}
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-destructive/20 bg-card">
              <table className="min-w-full text-xs border-collapse">
                <tbody>
                  {[
                    ['Message', error.message],
                    // These are optionally attached by the producer / step nodes; show rows only if present.
                    ['Code', (error as any).code as string | undefined],
                    ['Stack trace', error.stack],
                    ['Filename', (error as any).filename as string | undefined ?? extractFilenameFromStack(error.stack)],
                    ['Diff', error.diff]
                  ]
                    .filter(([, v]) => typeof v === 'string' && v.trim().length > 0)
                    .map(([k, v]) => (
                      <tr key={k} className="border-b border-border/50 last:border-b-0">
                        <td className="w-36 px-3 py-2 align-top font-bold text-muted-foreground uppercase tracking-widest text-[10px] bg-muted/20 border-r border-border/50">
                          {k}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <pre className="text-[11px] leading-relaxed font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto max-h-80 scrollbar-thin">
                            {String(v)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Determine the container to display as header (same style as GroupView)
  const containerNode = feature || (isContainer ? node : undefined);
  const containerTitle = (containerNode as any)?.title || '';
  const containerDescription = (containerNode as any)?.description;
  const containerTags = (((containerNode as any)?.tags ?? []) as string[]) || [];

  const statusFromStats = (stats: Statistics | undefined): Status | undefined => {
    if (!stats) return undefined;
    if (stats.failed > 0) return 'failed';
    if (stats.pending > 0) return 'pending';
    if (stats.total > 0 && stats.skipped === stats.total) return 'skipped';
    if (stats.total > 0 && stats.passed === stats.total) return 'passed';
    return 'pending';
  };

  const containerStatus = statusFromStats((containerNode as any)?.statistics as Statistics | undefined);
  const environment = run?.environment || 'local';

  const containerTitleWithKind = containerNode
    ? (String((containerNode as any).style ?? (containerNode as any).kind ?? '').toLowerCase() === 'feature'
      ? kindPrefixTitle('Feature', containerTitle)
      : containerTitle)
    : '';

  const renderOutline = () => {
    if (!isOutline) return null;

    const templateSteps = (() => {
      if (template) {
        if (Array.isArray((template as any).children)) return ((template as any).children as any[]);
        if (Array.isArray((template as any).steps)) return ((template as any).steps as any[]);
      }

      const v3Steps = (node as any).steps;
      if (Array.isArray(v3Steps)) return v3Steps as any[];
      return [];
    })();

    const exampleNodes = Array.isArray(examples) ? (examples as any[]) : [];

    const normalizeKey = (s: string) => String(s ?? '').replace(/['\s_\-]/g, '').toLowerCase();

    const bindingToValues = (binding: any | undefined): Record<string, string> => {
      const variables = (binding?.variables ?? []) as Array<{ name: string; value: TypedValue }>;
      return variables.reduce<Record<string, string>>((acc, v) => {
        acc[v.name] = formatTypedValue(v.value);
        return acc;
      }, {});
    };

    const valuesForHeader = (values: Record<string, string>, header: string): string => {
      if (values[header] !== undefined) return values[header];
      const target = normalizeKey(header);
      for (const [k, v] of Object.entries(values)) {
        if (normalizeKey(k) === target) return v;
      }
      return '';
    };

    const looksLikeDataTables = (arr: unknown): arr is DataTable[] => {
      if (!Array.isArray(arr)) return false;
      const first = (arr as any[])[0];
      return !!first && Array.isArray(first.headers) && Array.isArray(first.rows);
    };

    const v3ExampleTables = looksLikeDataTables((node as any).examples) ? ((node as any).examples as DataTable[]) : undefined;
    const allTables = v3ExampleTables
      ? (v3ExampleTables as any[])
      : Array.isArray((node as any).tables)
        ? ((node as any).tables as any[])
        : [];

    const v3ExampleResults = Array.isArray((node as any).exampleResults)
      ? (((node as any).exampleResults as Array<{ testId: string; result: ExecutionResult }>) ?? [])
      : [];

    const v3ResultsByKey = (() => {
      const m = new Map<string, ExecutionResult>();
      for (const entry of v3ExampleResults) {
        const rowId = Number(entry?.result?.rowId);
        if (!Number.isFinite(rowId)) continue;
        m.set(`${rowId}|${String(entry.testId)}`, entry.result);
      }
      return m;
    })();

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
      execution?: any;
      steps?: any[];
    };

    const executed = exampleNodes.map((ex) => {
      const values = bindingToValues(ex?.binding);
      const rowId = String(ex?.binding?.rowId ?? '');
      return { ex, values, rowId };
    });

    const executedByRowId = new Map<string, { ex: any; values: Record<string, string> }>();
    for (const e of executed) {
      if (e.rowId) executedByRowId.set(e.rowId, { ex: e.ex, values: e.values });
    }

    const buildRowsForTable = (table: any | undefined): { headers: string[]; rows: OutlineRow[] } => {
      // v3 mode: table comes from `examples` (DataTable) and execution comes from exampleResults.
      if (v3ExampleTables && table && Array.isArray(table.headers) && Array.isArray(table.rows) && table.headers.length > 0) {
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
            const result = v3ResultsByKey.get(`${rowId}|${String(s?.id ?? '')}`);
            return result ? { ...s, execution: result } : s;
          });

          const stepExecutions: ExecutionResult[] = (templateSteps as any[])
            .map((s: any) => v3ResultsByKey.get(`${rowId}|${String(s?.id ?? '')}`))
            .filter((x): x is ExecutionResult => !!x);

          const rowStatus = stepExecutions.length > 0
            ? aggregateStatus(stepExecutions.map((r) => r.status))
            : undefined;

          const rowDuration = stepExecutions.reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
          const rowError = stepExecutions.find((r) => r.status === 'failed' && r.error)?.error;

          const execution = rowStatus
            ? ({ status: rowStatus, duration: rowDuration, error: rowError } as ExecutionResult)
            : undefined;

          return { id, values, execution, steps: patchedSteps };
        });

        return { headers, rows };
      }

      if (table && Array.isArray(table.headers) && Array.isArray(table.rows) && table.headers.length > 0) {
        const headers = (table.headers as unknown[]).map((h) => String(h ?? '')).filter(Boolean);
        const tableRows = (table.rows as any[]).map((r: any) => {
          const id = String(r?.rowId ?? '');
          const vals = Array.isArray(r?.values) ? (r.values as TypedValue[]) : [];
          const values = headers.reduce<Record<string, string>>((acc, h, idx) => {
            acc[h] = formatTypedValue(vals[idx]);
            return acc;
          }, {});
          return { id: id || `row:${Math.random().toString(36).slice(2)}`, values };
        });

        return {
          headers,
          rows: tableRows.map((row) => {
            const matchByRowId = executedByRowId.get(row.id);
            if (matchByRowId) {
              const steps = Array.isArray(matchByRowId.ex?.children)
                ? (matchByRowId.ex.children as any[])
                : Array.isArray(matchByRowId.ex?.steps)
                  ? (matchByRowId.ex.steps as any[])
                  : [];
              return { ...row, execution: matchByRowId.ex?.execution, steps };
            }

            const matchByValues = executed.find(({ values }) =>
              headers.every((h) => valuesForHeader(values, h) === (row.values[h] ?? ''))
            );
            if (!matchByValues) return { ...row };

            const steps = Array.isArray(matchByValues.ex?.children)
              ? (matchByValues.ex.children as any[])
              : Array.isArray(matchByValues.ex?.steps)
                ? (matchByValues.ex.steps as any[])
                : [];
            return { ...row, execution: matchByValues.ex?.execution, steps };
          })
        };
      }

      // Fallback: derive rows from executed examples only.
      const ordered: string[] = [];
      const seen = new Set<string>();
      for (const ex of exampleNodes) {
        const vars = (ex?.binding?.variables ?? []) as Array<{ name: string }>;
        for (const v of vars) {
          const name = String(v?.name ?? '').trim();
          if (!name || seen.has(name)) continue;
          seen.add(name);
          ordered.push(name);
        }
      }

      const headers = ordered;
      const rows = exampleNodes.map((example: any) => {
        const values = bindingToValues(example?.binding);
        const steps = Array.isArray(example?.children)
          ? (example.children as any[])
          : Array.isArray(example?.steps)
            ? (example.steps as any[])
            : [];
        return {
          id: String(example?.binding?.rowId ?? example?.id ?? ''),
          values,
          execution: example?.execution,
          steps,
        };
      });

      return { headers, rows };
    };

    const exampleTables = (allTables.length > 0
      ? allTables
      : [undefined]
    ).map((t) => {
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
      const filename =
        (typeof (feature as any)?.path === 'string' && String((feature as any).path).trim().length > 0)
          ? String((feature as any).path)
          : (typeof (node as any)?.path === 'string' && String((node as any).path).trim().length > 0)
            ? String((node as any).path)
            : undefined;

      return { code, filename };
    })();

    return (
      <div
        className={cn(
          hasOutlineDescription ? 'mt-6 space-y-6' : 'mt-2 space-y-4'
        )}
      >
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
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {allRows.length}
              </span>
            </div>

            {exampleTables.map((table, tableIndex) => (
              <div key={`${tableIndex}:${table.name ?? ''}`} className="space-y-2">
                {(exampleTables.length > 1 || (table.name && table.name.trim().length > 0)) && (
                  <div className="flex items-center gap-2 px-1">
                    <h4 className="text-sm font-semibold text-foreground/90 flex-1">
                      {table.name ? `Examples: ${table.name}` : 'Examples'}
                    </h4>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {table.rows.length}
                    </span>
                  </div>
                )}

                {table.description && table.description.trim().length > 0 && (
                  <Markdown content={table.description} className="max-w-3xl" />
                )}

                <div className="overflow-hidden rounded-xl border bg-card">
                  <table className="min-w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/60">
                        <th className="w-10 px-3 py-2 text-center font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50">#</th>
                        <th className="w-12 px-3 py-2 text-center font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50">Status</th>
                        {table.headers.map(h => (
                          <th key={h} className="px-3 py-2 text-left font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-r-0">
                            {h}
                          </th>
                        ))}
                        <th className="w-20 px-3 py-2 text-right font-bold text-muted-foreground uppercase tracking-widest">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, idx: number) => {
                        const duration = row.execution?.duration as number | undefined;
                        const isSelected = selectedExampleId === row.id;

                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "border-b border-border/50 last:border-b-0 transition-colors cursor-pointer group",
                              isSelected
                                ? "bg-primary/15 ring-1 ring-inset ring-primary/35"
                                : "hover:bg-muted/30"
                            )}
                            onClick={() => setSelectedExampleId(isSelected ? null : row.id)}
                          >
                            <td className="px-3 py-2 text-center font-mono text-[10px] text-muted-foreground border-r border-border/50">{idx + 1}</td>
                            <td className="px-3 py-2 text-center border-r border-border/50">
                              <div className="flex justify-center">
                                {row.execution?.status ? getStatusIcon(row.execution.status) : getStatusIcon('pending')}
                              </div>
                            </td>
                            {table.headers.map(h => (
                              <td key={h} className="px-3 py-2 text-foreground/80 border-r border-border/50 last:border-r-0 font-mono text-[11px]">
                                {row.values[h] ?? ''}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
                              {duration === undefined || duration <= 0
                                ? ''
                                : duration < 1000
                                  ? `${Math.floor(duration)}ms`
                                  : `${(duration / 1000).toFixed(2)}s`}
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
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {renderExceptionDetails(
                {
                  ...selectedFailureError,
                  code: selectedFailureMeta.code,
                  filename: selectedFailureMeta.filename,
                } as any,
                'Exception Details'
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderChildren = () => {
    if (!showCards || !children || children.length === 0) return null;

    const textLower = filterText.trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;
    const visibleChildren = (!hasText && !hasTags)
      ? (children as any[])
      : (children as any[]).filter((child: any) => subtreeHasMatch(child as any, textLower, filterTags));

    if (visibleChildren.length === 0) return null;

    const Icon = FileText;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground tracking-tight flex-1">
            Scenarios
          </h3>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {visibleChildren.length}
          </span>
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {visibleChildren.map((child: any) => (
              <button
                key={child.id}
                onClick={() => navigate('node', child.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
              >
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {child.title}
                </span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {child.execution?.duration !== undefined && child.execution.duration < 1000 
                    ? `${Math.floor(child.execution.duration)}ms` 
                    : child.execution?.duration !== undefined 
                      ? `${(child.execution.duration / 1000).toFixed(2)}s` 
                      : ''}
                </span>
                <StatusBadge status={child.execution?.status} size="sm" />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* ========== HEADER - EXACT SAME STYLE AS GROUPVIEW ========== */}
      <div className="space-y-2">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2 overflow-hidden">
          {breadcrumbs.length > 0 ? (() => {
            // Container pages (Feature/Specification/Suite) should not show a non-clickable final crumb.
            // Scenario pages should include the owning Feature (clickable), but not the current Scenario.
            const crumbs = isContainer ? breadcrumbs.slice(0, -1) : breadcrumbs;
            if (crumbs.length === 0) return null;

            return crumbs.map((item, index) => {
              const isRoot = item.title === 'Root' && index === 0;
              
              return (
                <div key={item.id} className="flex items-center gap-1 shrink-0">
                  {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
                  <button 
                    onClick={() => navigate('group', item.id)}
                    className={cn(
                      "flex items-center gap-1.5 hover:text-foreground transition-colors truncate px-1 py-0.5 rounded-md hover:bg-muted/50",
                      ""
                    )}
                  >
                    {isRoot ? (
                      <>
                        <Home className="w-3.5 h-3.5" />
                        <span>Root</span>
                      </>
                    ) : item.title}
                  </button>
                </div>
              );
            });
          })() : (
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => navigate('group', 'group:/')}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors px-1 py-0.5 rounded-md hover:bg-muted/50"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
              <span className="font-medium text-foreground px-1 py-0.5">{containerTitleWithKind || containerTitle}</span>
            </div>
          )}
        </nav>
        
        {/* Title + Status */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight">{containerTitleWithKind || containerTitle}</h1>
          <div className="flex items-center gap-3">
            {environment && <Badge variant="outline" className="text-muted-foreground font-normal border-border bg-muted/20">{environment}</Badge>}
            {containerStatus && <StatusBadge status={containerStatus} size="lg" showLabel />}
          </div>
        </div>
        
        {/* Description */}
        {containerDescription && (
          <Markdown content={containerDescription} className="max-w-3xl" />
        )}

        {/* Tags */}
        {containerTags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {containerTags.map(tag => (
              <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                <Tag className="w-3 h-3 mr-1 opacity-60" />
                {formatTagLabel(tag)}
              </Badge> 
            ))}
          </div>
        )}
      </div>

      {/* ========== BACKGROUND ========== */}
      {background && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Background"
            title={renderTitle(background.title)}
            status={(background as any).execution?.status as Status | undefined}
            description={background.description}
            tags={(background as any).tags}
            steps={(((background as any).steps || (background as any).children) ?? []) as StepTest[]}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="background"
          />
        </div>
      )}

      {/* ========== SCENARIO SECTION (when viewing a child of a Feature) ========== */}
      {feature && !isTestCaseNode(node) && kind === 'scenario' && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Scenario"
            title={renderTitle(node.title, highlightValues)}
            status={(node as any).execution?.status as Status | undefined}
            description={node.description}
            tags={node.tags}
            steps={stepTests}
            highlightValues={highlightValues}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="scenario"
          />
        </div>
      )}

      {/* ========== SCENARIO OUTLINE SECTION ========== */}
      {feature && !isTestCaseNode(node) && kind === 'scenariooutline' && (
        <div className="space-y-3">
          <ScenarioBlock
            label="Scenario Outline"
            title={renderTitle(node.title)}
            status={(node as any).execution?.status as Status | undefined}
            description={node.description}
            tags={node.tags}
            steps={[]}
            showDurations={!isBusiness}
            showErrorStack={!isBusiness}
            tone="scenario"
          />
        </div>
      )}

      {/* ========== FAILURE SUMMARY ========== */}
      {!isTestCaseNode(node) && !isOutline && (node as any).execution?.status === 'failed' && (node as any).execution?.error && (
        <Card className="bg-destructive/5 border-destructive/20 shadow-none overflow-hidden">
          <CardHeader className="bg-destructive/10 border-b border-destructive/10 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <h3 className="text-sm font-bold text-destructive uppercase tracking-widest">Failure Summary</h3>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-foreground/90 whitespace-pre-wrap font-mono">
              {(node as any).execution.error.message}
            </div>
            {!isBusiness && (node as any).execution.error.stack && (
              <div className="mt-4">
                <details className="group">
                  <summary className="flex items-center gap-2 text-xs font-bold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-fit">
                    <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                    Full Stack Trace
                  </summary>
                  <div className="mt-3 pl-6 border-l-2 border-destructive/10">
                    <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap overflow-x-auto max-h-80 scrollbar-thin">
                      {(node as any).execution.error.stack}
                    </pre>
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========== STEPS ========== */}
      {steps && steps.length > 0 && !isScenarioView && !isOutline && (
        <StepList
          steps={stepTests}
          highlightValues={highlightValues}
          showDurations={!isBusiness}
          showErrorStack={!isBusiness}
        />
      )}

      {/* ========== OUTLINES (ScenarioOutline / RuleOutline) ========== */}
      {renderOutline()}

      {/* ========== CHILDREN (when viewing a container) ========== */}
      {renderChildren()}
    </div>
  );
}
