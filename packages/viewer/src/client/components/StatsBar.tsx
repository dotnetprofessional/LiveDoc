import { Statistics } from '@swedevtools/livedoc-schema';
import { cn } from '../lib/utils';
import { StatusProgressBar } from './ProgressBar';
import { formatDuration } from '../lib/status-utils';

interface StatsBarProps {
  summary?: Statistics;
  duration?: number;
  ruleViolations?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatsBar({ summary, duration, ruleViolations, size = 'md', className }: StatsBarProps) {
  const safeSummary: Statistics = summary ?? { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
  const { passed, failed, pending, skipped, total } = safeSummary;

  if (size === 'sm') {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-pass">{passed}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">P</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-fail">{failed}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">F</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-pending">{pending}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">U</span>
        </div>
        {typeof ruleViolations === 'number' && (
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-foreground">{ruleViolations}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">V</span>
          </div>
        )}
        <StatusProgressBar
          passed={passed}
          failed={failed}
          pending={pending}
          skipped={skipped}
          size="sm"
          className="w-16"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-pass leading-none">{passed}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">passed</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-fail leading-none">{failed}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">failed</span>
          </div>
          
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-pending leading-none">{pending}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">pending</span>
          </div>

          {typeof ruleViolations === 'number' && (
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-foreground leading-none">{ruleViolations}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">violations</span>
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold leading-none">{total}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Items</div>
        </div>
      </div>

      <StatusProgressBar
        passed={passed}
        failed={failed}
        pending={pending}
        skipped={skipped}
        size="lg"
        className="shadow-inner"
      />
      
      {duration !== undefined && (
        <div className="flex justify-end">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Execution Time: {formatDuration(duration)}
          </span>
        </div>
      )}
    </div>
  );
}
