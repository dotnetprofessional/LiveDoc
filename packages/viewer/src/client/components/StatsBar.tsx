interface StatsBarProps {
  passed: number;
  failed: number;
  pending: number;
  duration?: number;
  label?: string; // e.g., "scenarios", "features"
}

export function StatsBar({ passed, failed, pending, duration, label = 'scenarios' }: StatsBarProps) {
  const total = passed + failed + pending;
  const pPct = total > 0 ? (passed / total * 100) : 0;
  const fPct = total > 0 ? (failed / total * 100) : 0;
  const pendPct = total > 0 ? (pending / total * 100) : 0;

  return (
    <div className="flex items-center gap-5 px-4 py-3 bg-surface border border-border rounded-lg mb-5">
      {/* Stats */}
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold text-pass">{passed}</span>
        <span className="text-xs text-text-secondary">passed</span>
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold text-fail">{failed}</span>
        <span className="text-xs text-text-secondary">failed</span>
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-semibold text-pending">{pending}</span>
        <span className="text-xs text-text-secondary">pending</span>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 max-w-[280px] h-2.5 bg-surface-hover rounded overflow-hidden flex">
        <div 
          className="h-full bg-pass transition-all duration-300" 
          style={{ width: `${pPct}%` }} 
        />
        <div 
          className="h-full bg-fail transition-all duration-300" 
          style={{ width: `${fPct}%` }} 
        />
        <div 
          className="h-full bg-pending transition-all duration-300" 
          style={{ width: `${pendPct}%` }} 
        />
      </div>

      {/* Summary */}
      <span className="ml-auto text-sm text-text-muted font-mono">
        {total} {label} · {formatDuration(duration)}
      </span>
    </div>
  );
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
