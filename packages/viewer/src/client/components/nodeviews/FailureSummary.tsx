import { AlertCircle, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';

export interface FailureSummaryProps {
  node: any;
  isBusiness: boolean;
  isTestCaseNode: boolean;
  isOutline: boolean;
}

export function FailureSummary({ node, isBusiness, isTestCaseNode, isOutline }: FailureSummaryProps) {
  if (isTestCaseNode) return null;
  if (isOutline) return null;
  if ((node as any).execution?.status !== 'failed') return null;
  if (!(node as any).execution?.error) return null;

  return (
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
  );
}
