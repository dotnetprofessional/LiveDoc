import type { AnyTest, Status } from '@livedoc/schema';
import { ChevronRight, FileText } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { subtreeHasMatch } from '../../lib/filter-utils';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { shouldAllowDrillDown } from '../../lib/status-utils';

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
        <div className="divide-y">
          {visibleChildren.map((child: any) => {
            const kind = String(child.kind ?? '');
            const status = child.execution?.status as Status | undefined;
            const canDrillDown = shouldAllowDrillDown(kind, status);
            return (
            <div
              key={child.id}
              onClick={canDrillDown ? () => navigate('node', child.id) : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group",
                canDrillDown && "hover:bg-muted/50 cursor-pointer",
                !canDrillDown && "cursor-default"
              )}
              role={canDrillDown ? "button" : undefined}
              tabIndex={canDrillDown ? 0 : undefined}
              onKeyDown={canDrillDown ? (e) => { if (e.key === 'Enter' || e.key === ' ') navigate('node', child.id); } : undefined}
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium truncate group-hover:text-primary transition-colors">
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

              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {child.execution?.duration !== undefined && child.execution.duration < 1000
                  ? `${Math.floor(child.execution.duration)}ms`
                  : child.execution?.duration !== undefined
                    ? `${(child.execution.duration / 1000).toFixed(2)}s`
                    : ''}
              </span>
              <StatusBadge status={child.execution?.status} size="sm" />
              {canDrillDown && (
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              )}
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}
