import type { AnyTest } from '@livedoc/schema';
import { ChevronRight, FileText } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { subtreeHasMatch } from '../../lib/filter-utils';

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
          {visibleChildren.map((child: any) => (
            <button
              key={child.id}
              onClick={() => navigate('node', child.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
            >
              <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-sm font-medium truncate group-hover:text-primary transition-colors">
                {child.title}
              </span>
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {child.execution?.duration !== undefined && child.execution.duration < 1000
                  ? `${Math.floor(child.execution.duration)}ms`
                  : child.execution?.duration !== undefined
                    ? `${(child.execution.duration / 1000).toFixed(2)}s`
                    : ''}
              </span>
              <StatusBadge status={child.execution?.status} size="sm" />
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
