import { Step, Status } from '@livedoc/schema';
import { renderTitle, highlightPlaceholders } from '../lib/title-utils';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

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
    <div className="space-y-6">
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
  const typeColors: Record<string, string> = {
    given: 'text-given',
    when: 'text-when',
    then: 'text-then',
    and: 'text-muted-foreground/70',
    but: 'text-destructive/70',
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

  return (
    <div className="group relative pl-8">
      {/* Status Icon - Absolute positioned */}
      {showStatus && (
        <div className="absolute left-0 top-1">
          {getStatusIcon(step.execution.status)}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <span className={cn(
            "font-black text-[10px] uppercase tracking-[0.2em] shrink-0 w-16",
            typeColors[String(step.keyword)] || 'text-muted-foreground/70'
          )}>
            {keywordLabel}
          </span>
          <div className="text-[15px] text-foreground font-medium leading-relaxed">
            {renderTitle(step.title, highlightValues)}
          </div>
          {showDurations && step.execution.duration > 0 && (
            <span className="text-[10px] font-bold text-muted-foreground/40 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
              <Clock className="w-3 h-3" />
              {step.execution.duration}ms
            </span>
          )}
        </div>

        {step.description && (
          <div className="mt-1 ml-20 text-sm text-muted-foreground/80 italic leading-relaxed border-l-2 border-muted pl-4 py-1">
            {step.description}
          </div>
        )}

        {step.docString && (
          <div className="mt-3 ml-20">
            <div className="relative">
              <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
              <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-xl p-4 whitespace-pre-wrap overflow-x-auto border border-border/50 shadow-inner">
                {step.docString}
              </pre>
            </div>
          </div>
        )}

        {normalizedTable && (
          <div className="mt-4 ml-20 overflow-hidden rounded-xl border border-border/50 shadow-sm">
            <table className="min-w-full text-xs font-medium border-collapse bg-card">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {normalizedTable.headers.map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {normalizedTable.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-2.5 text-foreground/80 border-r border-border/50 last:border-r-0 font-mono">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {step.execution.error && (
          <div className="mt-4 ml-20 p-4 bg-destructive/5 border border-destructive/20 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 text-destructive font-bold text-xs mb-2">
              <XCircle className="w-4 h-4" />
              {step.execution.error.message}
            </div>
            {showErrorStack && step.execution.error.stack && (
              <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap overflow-x-auto max-h-60 scrollbar-thin">
                {step.execution.error.stack}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function normalizeDataTable(dataTable: unknown): { headers: string[]; rows: string[][] } | null {
  if (!dataTable) return null;

  // Schema shape: { headers: string[], rows: { rowId, values: TypedValue[] }[] }
  if (
    typeof dataTable === 'object' &&
    dataTable !== null &&
    Array.isArray((dataTable as any).headers) &&
    Array.isArray((dataTable as any).rows)
  ) {
    const headers = ((dataTable as any).headers as unknown[]).map((h) => String(h ?? ''));
    const rows = ((dataTable as any).rows as any[])
      .map((r) => (Array.isArray(r?.values) ? r.values : []))
      .map((values) => values.map((v: any) => String(v?.displayFormat ?? v?.value ?? '')));
    return { headers, rows };
  }

  // Viewer legacy shape: { rows: string[][] }
  if (typeof dataTable === 'object' && dataTable !== null && Array.isArray((dataTable as any).rows)) {
    const rows = (dataTable as any).rows as unknown[];
    if (rows.length === 0 || !Array.isArray(rows[0])) return null;
    const headers = (rows[0] as unknown[]).map((c) => String(c ?? ''));
    const body = rows.slice(1).map((r: any) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
    return { headers, rows: body };
  }

  // Server shape: DataTableRow[] (array of objects) or string[][]
  if (Array.isArray(dataTable)) {
    if (dataTable.length === 0) return null;

    if (Array.isArray(dataTable[0])) {
      const rows = dataTable as unknown[][];
      const headers = (rows[0] || []).map((c) => String(c ?? ''));
      const body = rows.slice(1).map((r) => (r || []).map((c) => String(c ?? '')));
      return { headers, rows: body };
    }

    if (typeof dataTable[0] === 'object' && dataTable[0] !== null) {
      const objects = dataTable as Record<string, unknown>[];
      const headers = Object.keys(objects[0]);
      const body = objects.map((row) => headers.map((h) => String((row as any)?.[h] ?? '')));
      return { headers, rows: body };
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
    <div className="space-y-3">
      {steps.map((step, index) => {
        return (
          <div key={index} className="flex items-baseline gap-3 pl-8">
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
