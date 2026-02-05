import { cn } from '../lib/utils';

export interface ProgressBarProps {
  /** Percentage values for each segment */
  segments: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
  /** Whether to animate transitions */
  animate?: boolean;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
};

/**
 * Shared progress bar component for consistent status visualization.
 */
export function ProgressBar({
  segments,
  size = 'sm',
  className,
  animate = true,
}: ProgressBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div
      className={cn(
        'flex rounded-full overflow-hidden bg-muted',
        sizeClasses[size],
        className
      )}
    >
      {segments.map((segment, i) => {
        const pct = (segment.value / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={i}
            className={cn(
              'h-full',
              segment.color,
              animate && 'transition-all duration-500 ease-out'
            )}
            style={{ width: `${pct}%` }}
            title={segment.label}
          />
        );
      })}
    </div>
  );
}

export interface StatusProgressBarProps {
  passed: number;
  failed: number;
  pending?: number;
  skipped?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Pre-configured progress bar for test status visualization.
 */
export function StatusProgressBar({
  passed,
  failed,
  pending = 0,
  skipped = 0,
  size = 'sm',
  className,
}: StatusProgressBarProps) {
  const segments = [
    { value: passed, color: 'bg-pass', label: `${passed} passed` },
    { value: failed, color: 'bg-fail', label: `${failed} failed` },
    { value: pending, color: 'bg-pending', label: `${pending} pending` },
    { value: skipped, color: 'bg-muted-foreground/30', label: `${skipped} skipped` },
  ].filter(s => s.value > 0);

  return <ProgressBar segments={segments} size={size} className={className} />;
}
