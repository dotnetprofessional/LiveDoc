import type { AnyTest, Status } from '@swedevtools/livedoc-schema';
import { FileText } from 'lucide-react';
import { subtreeHasMatch } from '../../lib/filter-utils';
import { Badge } from '../ui/badge';
import { shouldAllowDrillDown } from '../../lib/status-utils';
import { ListRowMetadata } from '../ListRowMetadata';
import { cn } from '../../lib/utils';

export interface ChildrenListProps {
  children: AnyTest[] | undefined;
  showCards: boolean;
  filterText: string;
  filterTags: string[];
  navigate: (kind: 'group' | 'node', id: string) => void;
  isSpecificationContainer: boolean;
}

export function ChildrenList({
  children,
  showCards,
  filterText,
  filterTags,
  navigate,
  isSpecificationContainer,
}: ChildrenListProps) {
  if (!showCards || !children || children.length === 0) return null;

  const textLower = filterText.trim().toLowerCase();
  const hasText = textLower.length > 0;
  const hasTags = filterTags.length > 0;
  const visibleChildren = (!hasText && !hasTags)
    ? (children as any[])
    : (children as any[]).filter((child: any) => subtreeHasMatch(child as any, textLower, filterTags));

  if (visibleChildren.length === 0) return null;

  const Icon = FileText;
  const childrenLabel = isSpecificationContainer ? 'Rules' : 'Scenarios';

  const getOutlineCount = (child: any): number | undefined => {
    const statsTotal = child?.statistics?.total;
    if (typeof statsTotal === 'number' && statsTotal > 0) return statsTotal;

    const examples = Array.isArray(child?.examples) ? child.examples : [];
    if (examples.length === 0) return undefined;
    const total = examples.reduce((sum: number, t: any) => sum + (Array.isArray(t?.rows) ? t.rows.length : 0), 0);
    return total > 0 ? total : undefined;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground tracking-tight flex-1">{childrenLabel}</h3>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {visibleChildren.length}
        </span>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="divide-y" role="list">
          {visibleChildren.map((child: any) => {
            const kind = String(child.kind ?? '');
            const status = child.execution?.status as Status | undefined;
            const canDrillDown = shouldAllowDrillDown(kind, status);
            const content = (
              <>
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium transition-colors group-hover:text-primary">
                  {child.title}
                </span>

                {(child?.kind === 'ScenarioOutline' || child?.kind === 'RuleOutline') && (
                  <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                    Outline{(() => {
                      const count = getOutlineCount(child);
                      return typeof count === 'number' ? ` (${count})` : '';
                    })()}
                  </Badge>
                )}

              </>
            );
            return (
            <div key={child.id} role="listitem" className={cn(
              'relative flex items-center gap-2 px-4 py-3 group',
              canDrillDown && 'transition-colors hover:bg-muted/50',
            )}>
              {canDrillDown ? (
                <button
                  type="button"
                  onClick={() => navigate('node', child.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left before:absolute before:inset-0 focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-inset focus-visible:before:ring-ring"
                >
                  {content}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {content}
                </div>
              )}
              <ListRowMetadata
                node={child}
                duration={child.execution?.duration}
                status={status}
                canDrillDown={canDrillDown}
                showAttachmentSlot
                statusSize="sm"
              />
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}
