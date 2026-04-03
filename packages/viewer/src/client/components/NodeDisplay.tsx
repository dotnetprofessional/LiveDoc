import type { AnyTest, ExecutionResult, TestCase } from '@swedevtools/livedoc-schema';
import { Calendar, ChevronRight, Clock, FileText, Globe, HelpCircle, AlertCircle, CheckCircle2, Tag, XCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { renderTitle } from '../lib/title-utils';
import { Markdown } from './Markdown';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { StatusProgressBar } from './ProgressBar';

interface NodeDisplayProps {
  node: TestCase | AnyTest;
  variant: 'header' | 'card';
  size?: 'lg' | 'md' | 'sm';
  showStats?: boolean;
  onClick?: () => void;
  contextLabel?: string;
}

export function NodeDisplay({ node, variant, size = 'lg', showStats = true, onClick, contextLabel }: NodeDisplayProps) {
  const { audienceMode, getCurrentRun } = useStore();
  const run = getCurrentRun();
  
  const kindLabel = String((node as any).kind ?? 'Item');
  const Icon = FileText;

  const isScenarioLike = /scenario|background/i.test(kindLabel);

  const isBusiness = audienceMode === 'business';
  const summary = (node as any).statistics ?? (node as any).summary;
  
  // Title highlighting
  const highlightValues = (node as any).binding
    ? (node as any).binding.variables?.reduce((acc: any, v: any) => ({ ...acc, [v.name]: v.value?.value }), {})
    : undefined;

  const getStatusIcon = (status: string, className = "w-6 h-6") => {
    switch (status) {
      case 'passed': return <CheckCircle2 className={cn(className, "text-pass")} />;
      case 'failed': return <XCircle className={cn(className, "text-fail")} />;
      case 'pending': return <AlertCircle className={cn(className, "text-pending")} />;
      default: return <HelpCircle className={cn(className, "text-muted-foreground/40")} />;
    }
  };

  const execution: ExecutionResult | undefined = (node as any).execution;

  const renderStats = () => {
    if (!showStats) return null;
    return (
        <Card className="bg-card border-none shadow-lg p-4 min-w-45 shrink-0">
          <div className="space-y-4">
            {run && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Last verified</span>
                  <span className="text-sm font-black flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    {new Date(run.run.timestamp).toLocaleString([], {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Environment</span>
                  <span className="text-sm font-black flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-primary" />
                    {run.run.environment || 'Default'}
                  </span>
                </div>
                <Separator className="opacity-50" />
              </>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Duration</span>
              <span className="text-sm font-black flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                {Number(execution?.duration ?? 0).toFixed(0)}ms
              </span>
            </div>
            {summary && (
              <>
                <Separator className="opacity-50" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Results</span>
                    <span className="text-[10px] font-bold">{summary.total} Total</span>
                  </div>
                  <StatusProgressBar
                    passed={summary.passed}
                    failed={summary.failed}
                    pending={summary.pending}
                    skipped={summary.skipped ?? 0}
                    size="sm"
                  />
                </div>
              </>
            )}
          </div>
        </Card>
    );
  };

  const renderTags = () => {
    const tags = ((node as any).tags ?? []) as string[];
    if (!Array.isArray(tags) || tags.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {tags.map((tag: string) => (
          <Badge key={tag} variant="secondary" className="rounded-full px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-muted/50 text-muted-foreground border-none">
            <Tag className="w-3 h-3 mr-1.5 opacity-50" />
        {String(tag ?? '').replace(/^@/, '')}
          </Badge>
        ))}
      </div>
    );
  };

  if (variant === 'card') {
    return (
      <Card 
        className="group cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-muted/50 overflow-hidden"
        onClick={onClick}
      >
        <div className="flex items-stretch min-h-16">
          <div className={cn(
            "w-1 shrink-0 transition-colors duration-300",
            execution?.status === 'passed' ? 'bg-pass' : 
            execution?.status === 'failed' ? 'bg-fail' : 'bg-pending'
          )} />
          <div className="flex-1 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0">
                {getStatusIcon(String(execution?.status ?? 'pending'))}
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                  {kindLabel}
                </div>
                <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                  {renderTitle((node as any).title, highlightValues)}
                </h3>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Card>
    );
  }

  // Header variant (formerly Hero)
  // Dynamic scaling based on size prop
  const titleSize = size === 'lg' ? 'text-3xl md:text-4xl' : size === 'md' ? 'text-2xl md:text-3xl' : 'text-xl';

  return (
    <div className={cn(isScenarioLike ? "mb-4" : "mb-10", size === 'lg' ? "" : "opacity-90")}>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-primary/5 rounded-xl border border-primary/10">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              {contextLabel || kindLabel}
            </span>
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            {!isBusiness && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] font-bold uppercase tracking-widest border-muted-foreground/20 text-muted-foreground/60"
              >
                ID: {String((node as any).id ?? '').split('-')[0]}
              </Badge>
            )}
          </div>

          <div className="flex items-start gap-4">
            <div className="mt-1 shrink-0">{getStatusIcon(String(execution?.status ?? 'pending'))}</div>
            <h1 className={cn("font-black tracking-tight text-foreground leading-tight", titleSize)}>
              {renderTitle((node as any).title, highlightValues)}
            </h1>
          </div>

          {(node as any).description && (
            <div className="mt-6 relative">
              <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary/10 rounded-full" />
              <div className="pl-2">
                 <Markdown content={String((node as any).description)} className="prose-lg font-medium leading-relaxed" />
              </div>
            </div>
          )}

          {renderTags()}
        </div>

        {/* Stats Column - only show for LG/Primary headers */}
        {(size === 'lg' || size === 'md') && showStats && (
          <div className="flex flex-col items-end gap-4 shrink-0">
              {renderStats()}
          </div>
        )}
      </div>
    </div>
  );
}
