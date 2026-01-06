import { Folder, FileText } from 'lucide-react';
import { useMemo } from 'react';
import { Run, useStore } from '../store';
import { buildGroupedNavTree, findNavItemById, NavItem } from '../lib/nav-tree';
import { StatusBadge } from './StatusBadge';
import { cn } from '../lib/utils';
import { subtreeHasMatch } from '../lib/filter-utils';

export function GroupView({ run, groupId }: { run: Run; groupId: string }) {
  const { navigate, filterText, filterTags } = useStore();

  const navTree = useMemo(() => buildGroupedNavTree(run.documents ?? []), [run.documents]);
  const group = useMemo(() => {
    const item = findNavItemById(navTree, groupId);
    return item?.kind === 'Group' ? item : undefined;
  }, [groupId, navTree]);

  const title = group?.title ?? 'Group';
  const children = group?.children ?? [];

  const filteredChildren = useMemo(() => {
    const textLower = filterText.trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;

    if (!hasText && !hasTags) return children;

    const groupHasMatch = (g: NavItem & { kind: 'Group' }): boolean => {
      for (const c of g.children) {
        if (c.kind === 'Group') {
          if (groupHasMatch(c)) return true;
        } else {
          if (subtreeHasMatch(c.node, textLower, filterTags)) return true;
        }
      }
      return false;
    };

    return children.filter((item) => {
      if (item.kind === 'Group') return groupHasMatch(item);
      return subtreeHasMatch(item.node, textLower, filterTags);
    });
  }, [children, filterTags, filterText]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-muted-foreground">Folder</div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>

      {!group && (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          This folder is no longer available in the latest run.
        </div>
      )}

      {group && filteredChildren.length === 0 && (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          No matching results.
        </div>
      )}

      {group && filteredChildren.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y">
            {filteredChildren.map((item) => (
              <GroupRow
                key={item.id}
                item={item}
                onOpen={() => {
                  if (item.kind === 'Group') navigate('group', item.id);
                  else navigate('node', item.id);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRow({ item, onOpen }: { item: NavItem; onOpen: () => void }) {
  const Icon = item.kind === 'Group' ? Folder : FileText;
  const title = item.kind === 'Group' ? item.title : `${item.kind.toUpperCase()}: ${item.title}`;

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
      onClick={onOpen}
    >
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">{title}</span>
        </div>
      </div>

      {item.status && <StatusBadge status={item.status as any} size="xs" />}
    </button>
  );
}
