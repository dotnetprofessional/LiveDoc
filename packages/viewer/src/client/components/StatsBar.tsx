import { Statistics } from '@livedoc/schema';
import { cn } from '../lib/utils';

interface StatsBarProps {
  summary: Statistics;
  duration?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatsBar({ summary, duration, size = 'md', className }: StatsBarProps) {
  const { passed, failed, pending, skipped, total } = summary;
  const pPct = total > 0 ? (passed / total * 100) : 0;
  const fPct = total > 0 ? (failed / total * 100) : 0;
  const pendPct = total > 0 ? (pending / total * 100) : 0;
  const skipPct = total > 0 ? (skipped / total * 100) : 0;

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
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-pass" style={{ width: `${pPct}%` }} />
          <div className="h-full bg-fail" style={{ width: `${fPct}%` }} />
          <div className="h-full bg-pending" style={{ width: `${pendPct}%` }} />
          <div className="h-full bg-muted-foreground/30" style={{ width: `${skipPct}%` }} />
        </div>
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
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold leading-none">{total}</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Items</div>
        </div>
      </div>

      <div className="relative h-3 bg-muted rounded-full overflow-hidden flex shadow-inner">
        <div 
          className="h-full bg-pass transition-all duration-700 ease-in-out" 
          style={{ width: `${pPct}%` }} 
        />
        <div 
          className="h-full bg-fail transition-all duration-700 ease-in-out" 
          style={{ width: `${fPct}%` }} 
        />
        <div 
          className="h-full bg-pending transition-all duration-700 ease-in-out" 
          style={{ width: `${pendPct}%` }} 
        />
        <div 
          className="h-full bg-muted-foreground/20 transition-all duration-700 ease-in-out" 
          style={{ width: `${skipPct}%` }} 
        />
      </div>
      
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

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
