interface ItemRowData {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'pending';
  count: number;
  passed: number;
  failed: number;
  pending: number;
  duration?: number;
}

interface ItemListProps {
  type: 'Group' | 'Feature' | 'Scenario';
  items: ItemRowData[];
  onItemClick: (id: string) => void;
}

export function ItemList({ type, items, onItemClick }: ItemListProps) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[10px_1fr_80px_140px_50px_50px_50px_70px] gap-3 px-4 py-2.5 bg-surface-hover/50 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wide">
        <span></span>
        <span>{type}</span>
        <span className="text-center">{type === 'Scenario' ? 'Steps' : 'Scenarios'}</span>
        <span>Progress</span>
        <span className="text-center">Pass</span>
        <span className="text-center">Fail</span>
        <span className="text-center">Pend</span>
        <span className="text-right">Time</span>
      </div>
      
      {/* Rows */}
      {items.map((item) => (
        <ItemRow key={item.id} item={item} onClick={() => onItemClick(item.id)} />
      ))}
      
      {items.length === 0 && (
        <div className="px-4 py-8 text-center text-text-muted">
          No {type.toLowerCase()}s found
        </div>
      )}
    </div>
  );
}

interface ItemRowProps {
  item: ItemRowData;
  onClick: () => void;
}

function ItemRow({ item, onClick }: ItemRowProps) {
  const total = item.passed + item.failed + item.pending;
  const pPct = total > 0 ? (item.passed / total * 100) : 0;
  const fPct = total > 0 ? (item.failed / total * 100) : 0;
  const pendPct = total > 0 ? (item.pending / total * 100) : 0;

  const statusColors: Record<string, string> = {
    pass: 'bg-pass',
    fail: 'bg-fail',
    skip: 'bg-skip',
    pending: 'bg-pending',
  };

  return (
    <div
      className="grid grid-cols-[10px_1fr_80px_140px_50px_50px_50px_70px] gap-3 items-center px-4 py-3 border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-hover transition-colors"
      onClick={onClick}
    >
      {/* Status Dot */}
      <span className={`w-2.5 h-2.5 rounded-full ${statusColors[item.status]}`}></span>
      
      {/* Name */}
      <span className="text-sm font-medium text-text truncate">{item.name}</span>
      
      {/* Count */}
      <span className="text-xs text-text-muted text-center">{item.count}</span>
      
      {/* Progress Bar */}
      <div className="h-1.5 bg-surface-hover rounded overflow-hidden flex">
        <span className="bg-pass h-full" style={{ width: `${pPct}%` }}></span>
        <span className="bg-fail h-full" style={{ width: `${fPct}%` }}></span>
        <span className="bg-pending h-full" style={{ width: `${pendPct}%` }}></span>
      </div>
      
      {/* Pass/Fail/Pending */}
      <span className="text-xs text-center font-mono text-pass">{item.passed || '-'}</span>
      <span className="text-xs text-center font-mono text-fail">{item.failed || '-'}</span>
      <span className="text-xs text-center font-mono text-pending">{item.pending || '-'}</span>
      
      {/* Duration */}
      <span className="text-xs text-right font-mono text-text-muted">
        {formatDuration(item.duration)}
      </span>
    </div>
  );
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
