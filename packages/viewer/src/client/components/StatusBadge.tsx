interface StatusBadgeProps {
  status: 'pass' | 'fail' | 'skip' | 'pending';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function StatusBadge({ status, size = 'md', showLabel = false }: StatusBadgeProps) {
  const colors: Record<string, string> = {
    pass: 'bg-pass',
    fail: 'bg-fail',
    skip: 'bg-skip',
    pending: 'bg-pending',
  };

  const labels: Record<string, string> = {
    pass: '✓',
    fail: '✗',
    skip: '○',
    pending: '◌',
  };

  const sizeClasses = size === 'sm' 
    ? 'w-4 h-4 text-[10px]' 
    : 'w-5 h-5 text-xs';

  if (showLabel) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]} text-white`}>
        {labels[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  return (
    <span 
      className={`inline-flex items-center justify-center rounded-full ${colors[status]} text-white font-bold ${sizeClasses}`}
      title={status}
    >
      {labels[status]}
    </span>
  );
}
