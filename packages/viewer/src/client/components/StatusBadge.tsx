import { Status } from '@livedoc/schema';
import { cn } from '../lib/utils';
import { Check, X, Minus, HelpCircle, Clock } from "lucide-react"

interface StatusBadgeProps {
  status: Status;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = 'md', showLabel = false, className }: StatusBadgeProps) {
  const variants = {
    passed: {
      bg: 'bg-pass/10 text-pass border-pass/20',
      icon: Check,
      label: 'Passed'
    },
    failed: {
      bg: 'bg-fail/10 text-fail border-fail/20',
      icon: X,
      label: 'Failed'
    },
    skipped: {
      bg: 'bg-muted text-muted-foreground border-border',
      icon: Minus,
      label: 'Skipped'
    },
    pending: {
      bg: 'bg-pending/10 text-pending border-pending/20',
      icon: Clock,
      label: 'Pending'
    },
    unknown: {
      bg: 'bg-muted text-muted-foreground border-border',
      icon: HelpCircle,
      label: 'Unknown'
    },
  };

  const { bg, icon: Icon, label } = variants[status] || variants.unknown;

  const sizeClasses = {
    xs: 'w-4 h-4 p-0.5',
    sm: 'w-5 h-5 p-1',
    md: 'w-6 h-6 p-1.5',
    lg: 'w-8 h-8 p-2',
  }[size];

  if (showLabel) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider shadow-sm transition-all",
        bg,
        className
      )}>
        <Icon className="w-3 h-3" strokeWidth={3} />
        {label}
      </span>
    );
  }

  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center rounded-full border shadow-sm shrink-0 transition-all",
        bg,
        sizeClasses,
        className
      )}
      title={status}
    >
      <Icon className="w-full h-full" strokeWidth={3} />
    </span>
  );
}
