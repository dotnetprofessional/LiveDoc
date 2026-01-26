import { AlertCircle, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { cn } from '../lib/utils';

export interface ErrorInfo {
  message?: string;
  stack?: string;
  code?: string;
  diff?: string;
  filename?: string;
}

export interface ErrorDisplayProps {
  /** The error object containing message, stack, code, etc. */
  error: ErrorInfo;
  /** Title for the error card header */
  title?: string;
  /** If true, shows simplified view (message only) */
  isBusiness?: boolean;
  /** Visual style variant */
  variant?: 'card' | 'inline';
  /** Additional class names */
  className?: string;
}

/**
 * Extracts filename from stack trace if not provided explicitly.
 */
function extractFilenameFromStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  const match = stack.match(/at\s+(?:.*?\s+)?\(?([^\s()]+\.[tj]sx?:\d+:\d+)/i);
  return match?.[1];
}

/**
 * Safely converts value to display string.
 */
function toDisplayText(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim().length > 0) return v;
  if (v === null || v === undefined) return undefined;
  const str = String(v).trim();
  return str.length > 0 ? str : undefined;
}

/**
 * Shared component for displaying error details consistently across the viewer.
 * Shows message, code, stack trace, filename, and diff when available.
 */
export function ErrorDisplay({
  error,
  title = 'Failure Summary',
  isBusiness = false,
  variant = 'card',
  className,
}: ErrorDisplayProps) {
  if (!error?.message) return null;

  const filename = error.filename ?? extractFilenameFromStack(error.stack);

  // Inline variant - compact error display for lists/steps
  if (variant === 'inline') {
    return (
      <div className={cn("rounded-lg border border-destructive/30 bg-destructive/10 overflow-hidden", className)}>
        <div className="px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] leading-relaxed font-mono text-foreground/90 whitespace-pre-wrap break-words">
                {error.message}
              </div>
            </div>
          </div>
        </div>

        {!isBusiness && (error.code || error.stack || error.diff) && (
          <details className="group border-t border-destructive/15">
            <summary className="px-3 py-2 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
              Show details
            </summary>
            <div className="px-3 py-2 space-y-2 animate-in fade-in zoom-in-95 duration-200">
              {error.code && (
                <div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Code</div>
                  <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-40 scrollbar-thin bg-muted/30 rounded px-2 py-1">
                    {error.code}
                  </pre>
                </div>
              )}
              {error.diff && (
                <div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Diff</div>
                  <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto max-h-40 scrollbar-thin bg-muted/30 rounded px-2 py-1">
                    {error.diff}
                  </pre>
                </div>
              )}
              {error.stack && (
                <div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Stack trace</div>
                  <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap overflow-x-auto max-h-60 scrollbar-thin">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    );
  }

  // Card variant - full error display for detail views
  if (isBusiness) {
    return (
      <Card className={cn("bg-destructive/5 border-destructive/20 shadow-none overflow-hidden", className)}>
        <CardHeader className="bg-destructive/10 border-b border-destructive/10 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <h3 className="text-sm font-bold text-destructive uppercase tracking-widest">{title}</h3>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
            <div className="text-sm font-medium text-foreground/90 whitespace-pre-wrap font-mono">{error.message}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full technical view with table layout
  const rows: Array<[string, string | undefined]> = [
    ['Message', toDisplayText(error.message)],
    ['Code', toDisplayText(error.code)],
    ['Diff', toDisplayText(error.diff)],
    ['Stack trace', toDisplayText(error.stack)],
    ['Filename', toDisplayText(filename)],
  ];

  const visibleRows = rows.filter(([, v]) => v !== undefined) as Array<[string, string]>;

  return (
    <Card className={cn("bg-destructive/5 border-destructive/20 shadow-none overflow-hidden", className)}>
      <CardHeader className="bg-destructive/15 border-b border-destructive/15 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <h3 className="text-sm font-bold text-destructive uppercase tracking-widest">{title}</h3>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="overflow-hidden rounded-xl border border-destructive/20 bg-card">
          <table className="min-w-full text-xs border-collapse">
            <tbody>
              {visibleRows.map(([k, v]) => (
                <tr key={k} className="border-b border-border/50 last:border-b-0">
                  <td className="w-36 px-3 py-2 align-top font-bold text-muted-foreground uppercase tracking-widest text-[10px] bg-muted/20 border-r border-border/50">
                    {k}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <pre className="text-[11px] leading-relaxed font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto max-h-80 scrollbar-thin">
                      {v}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
