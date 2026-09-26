import type { AnyTest, Status } from '@swedevtools/livedoc-schema';
import { ChevronRight, Clock } from 'lucide-react';
import { AttachmentListBadge } from './AttachmentListBadge';
import { StatusBadge } from './StatusBadge';
import { cn } from '../lib/utils';
import { formatDuration } from '../lib/status-utils';

interface ListRowMetadataProps {
  node?: AnyTest;
  duration?: number;
  status?: Status;
  canDrillDown: boolean;
  showAttachmentSlot: boolean;
  statusSize: 'xs' | 'sm';
}

export function ListRowMetadata({
  node,
  duration,
  status,
  canDrillDown,
  showAttachmentSlot,
  statusSize,
}: ListRowMetadataProps) {
  // Only actionable evidence intercepts the navigation button's full-row hit area.
  return (
    <div className={cn(
      'pointer-events-none grid shrink-0 items-center gap-1.5 text-muted-foreground sm:gap-2',
      showAttachmentSlot
        ? 'grid-cols-[2.75rem_3.25rem_1.25rem_1rem] sm:grid-cols-[3.5rem_4.75rem_1.25rem_1rem]'
        : 'grid-cols-[3.25rem_1.25rem_1rem] sm:grid-cols-[4.75rem_1.25rem_1rem]',
    )}>
      {showAttachmentSlot && (
        <div className="relative z-10 justify-self-end">
          {node && <AttachmentListBadge node={node} />}
        </div>
      )}
      <span className="justify-self-end whitespace-nowrap text-right text-xs tabular-nums">
        {duration !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Clock className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
            {formatDuration(duration)}
          </span>
        )}
      </span>
      <span className="justify-self-center">
        {status && <StatusBadge status={status} size={statusSize} />}
      </span>
      {canDrillDown ? (
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
