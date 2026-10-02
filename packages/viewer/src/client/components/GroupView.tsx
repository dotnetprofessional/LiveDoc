import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';
import { RunLike, useStore } from '../store';
import { buildGroupedNavTree, findNavItemById, NavItem, navItemPath, projectNavTree } from '../lib/nav-tree';
import { StatusBadge } from './StatusBadge';
import { cn } from '../lib/utils';
import { subtreeHasMatch } from '../lib/filter-utils';
import { Badge } from './ui/badge';
import type { AnyTest, Status, TestCase } from '@swedevtools/livedoc-schema';
import { Markdown } from './Markdown';
import { TagChips } from './TagChips';
import { shouldAllowDrillDown } from '../lib/status-utils';
import { ListRowMetadata } from './ListRowMetadata';
import { getKindPresentation, isNativeTestKind } from '../lib/kind-presentation';

type ListItem = 
  | { type: 'navItem'; item: NavItem }
  | { type: 'node'; node: AnyTest };

function getIconForKind(kind: string) {
  return getKindPresentation(kind).icon;
}

export function GroupView({ run, groupId }: { run: RunLike; groupId: string }) {
  const { navigate, filterText, filterTags } = useStore();

  const documents = run.run.documents ?? [];
  const navTree = useMemo(() => buildGroupedNavTree(documents), [documents]);
  const projection = useMemo(() => projectNavTree(navTree), [navTree]);
  
  // 1. Resolve what we are viewing
  const viewData = useMemo(() => {
    // Check if it's a virtual group folder
    if (groupId.startsWith('group:')) {
      const item = findNavItemById(navTree, groupId);
      if (item && item.kind === 'Group') {
        return { kind: 'folder' as const, item };
      }
    }
    
    // Check if it's a container node (TestCase)
    const testCase = documents.find((d) => d.id === groupId);
    if (testCase) {
      return { kind: 'container' as const, node: testCase };
    }

    // Fallback: check nav tree anyway
    const item = findNavItemById(navTree, groupId);
    if (item) {
          if (item.kind === 'Group') return { kind: 'folder' as const, item };
          return { kind: 'container' as const, node: item.node };
    }
    
    return undefined;
        }, [groupId, navTree, documents]);

  // 2. Derive list items
  const children = useMemo<ListItem[]>(() => {
    if (!viewData) return [];
    
    if (viewData.kind === 'folder') {
      return projection.childrenOf(viewData.item).map(child => ({ type: 'navItem', item: child }));
    } else {
      // Container (TestCase)
      const testCase = viewData.node as TestCase;
      const tests = (testCase.tests ?? []) as AnyTest[];
      return tests.map((t) => ({ type: 'node', node: t }));
    }
  }, [viewData, projection]);

  // 3. Filter
  const filteredChildren = useMemo(() => {
    const textLower = filterText.trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;

    if (!hasText && !hasTags) return children;

    return children.filter(child => {
      if (child.type === 'navItem') {
         const hasMatch = (item: NavItem): boolean => {
              if (item.kind === 'Group') return item.children.some(hasMatch);
              return subtreeHasMatch(item.node, textLower, filterTags);
           };
          if (child.item.kind === 'Group') return hasMatch(child.item);
          return subtreeHasMatch(child.item.node, textLower, filterTags);
      } else {
        return subtreeHasMatch(child.node, textLower, filterTags);
      }
    });
  }, [children, filterTags, filterText]);

  const groupedChildren = useMemo(() => {
    const groups: Record<string, ListItem[]> = {};
    for (const child of filteredChildren) {
        let kind = child.type === 'navItem' ? child.item.kind : String(child.node.kind);
        // Group variations together
        if (kind === 'ScenarioOutline') kind = 'Scenario';
        if (kind === 'RuleOutline') kind = 'Rule';
        
        if (!groups[kind]) groups[kind] = [];
        groups[kind].push(child);
    }
    return groups;
  }, [filteredChildren]);

  const sortedGroupKeys = useMemo(() => {
    const order = ['Group', 'Feature', 'Specification', 'Container', 'Standard', 'Scenario', 'Rule', 'Test'] as string[];
    return Object.keys(groupedChildren).sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });
  }, [groupedChildren]);

  // When current folder has no matches, compute global results for helpful navigation
  const globalResultInfo = useMemo(() => {
    const textLower = filterText.trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;
    if (!hasText && !hasTags) return { count: 0, items: [] as any[] };
    if (filteredChildren.length > 0) return { count: 0, items: [] as any[] };

    const allItems = Object.values(run.itemById ?? {}) as any[];
    const matches = allItems
      .filter((n: any) => n && typeof n === 'object' && typeof n.kind === 'string')
      .filter((n: any) => subtreeHasMatch(n, textLower, filterTags));

    return { count: matches.length, items: matches.slice(0, 5) };
  }, [filterText, filterTags, filteredChildren.length, run.itemById]);

  const breadcrumbs = useMemo(() => {
    return projection.breadcrumbs(groupId);
  }, [projection, groupId]);

  const breadcrumbsToRender = useMemo(() => {
    // On list/container pages, the last breadcrumb is the current page. Omit it.
    return breadcrumbs.length > 1 ? breadcrumbs.slice(0, -1) : breadcrumbs;
  }, [breadcrumbs]);

  if (!viewData) {
    return (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          This item is no longer available in the latest run.
        </div>
    );
  }

  const title = viewData.kind === 'folder' ? viewData.item.title : viewData.node.title;
  const description = viewData.kind === 'container' ? viewData.node.description : undefined;
  const tags = viewData.kind === 'container' ? (viewData.node.tags || []) : [];
  
  let status: Status | undefined;
  if (viewData.kind === 'folder') {
      status = viewData.item.status as Status;
  } else {
      const tc = viewData.node as TestCase;
      if ((tc.statistics?.failed ?? 0) > 0) status = 'failed';
      else if ((tc.statistics?.pending ?? 0) > 0) status = 'pending';
      else if ((tc.statistics?.skipped ?? 0) > 0 && (tc.statistics?.total ?? 0) === (tc.statistics?.skipped ?? 0)) status = 'skipped';
      else if ((tc.statistics?.passed ?? 0) > 0 && (tc.statistics?.total ?? 0) === (tc.statistics?.passed ?? 0)) status = 'passed';
      else status = 'pending';
  }

    const environment = run.run.environment || 'local';

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground mb-2 overflow-x-auto">
           {breadcrumbsToRender.length > 0 ? (
             breadcrumbsToRender.map((item, index) => {
                    const isRoot = item.title === 'Root' && index === 0;
                    
                    return (
                        <div key={item.id} className="flex items-center gap-1 shrink-0">
                            {index > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
                            <button 
                                title={navItemPath(item)}
                                aria-label={isRoot ? 'Root' : undefined}
                    onClick={() => navigate('group', item.id)}
                                className={cn(
                                    "flex items-center gap-1.5 hover:text-foreground transition-colors truncate px-1 py-0.5 rounded-md hover:bg-muted/50",
                      ""
                                )}
                            >
                                {isRoot ? <Home className="w-3.5 h-3.5" /> : item.title}
                            </button>
                        </div>
                    );
                 })
             ) : (
                // Fallback if not in nav tree (e.g. nested suites)
                 <div className="flex items-center gap-1 shrink-0">
                    <button 
                         onClick={() => navigate('group', 'group:/')}
                         className="flex items-center gap-1.5 hover:text-foreground transition-colors px-1 py-0.5 rounded-md hover:bg-muted/50"
                    >
                        <Home className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                    <span className="font-medium text-foreground px-1 py-0.5">{title}</span>
                 </div>
             )}
        </nav>
        
        <div className="flex items-start justify-between gap-4">
            <h1 title={viewData.kind === 'folder' ? navItemPath(viewData.item) : viewData.node.path} className="min-w-0 break-words text-2xl font-bold tracking-tight">{title}</h1>
            <div className="flex items-center gap-3">
                 {environment && <Badge variant="outline" className="text-muted-foreground font-normal border-border bg-muted/20">{environment}</Badge>}
                 {status && <StatusBadge status={status} size="lg" showLabel />}
            </div>
        </div>
        
        {description && (
             <Markdown content={description} className="max-w-3xl" />
        )}

        <TagChips tags={tags} className="pt-1" />
      </div>

      <div className="space-y-8">
         {filteredChildren.length === 0 ? (
              (filterText || filterTags.length > 0) ? (
                globalResultInfo.count > 0 ? (
                  <div className="rounded-xl border bg-card p-6 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      No matches in this folder — <strong className="text-foreground">{globalResultInfo.count}</strong> result{globalResultInfo.count !== 1 ? 's' : ''} found elsewhere:
                    </p>
                    <div className="rounded-lg border overflow-hidden divide-y">
                      {globalResultInfo.items.map((item: any) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                          onClick={() => navigate('node', item.id)}
                        >
                          <StatusBadge status={item.execution?.status} size="xs" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                              {getKindPresentation(String(item.kind ?? '')).label}
                            </div>
                            <div className="text-sm font-medium truncate">{item.title}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {globalResultInfo.count > 5 && (
                      <p className="text-xs text-muted-foreground">
                        …and {globalResultInfo.count - 5} more. Click the search field to browse all results.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                    No matching results.
                  </div>
                )
              ) : (
                <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                  This folder is empty.
                </div>
              )
         ) : (
            sortedGroupKeys.map(kind => {
                const Icon = getIconForKind(kind);
                return (
                    <div key={kind} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-sm font-semibold text-foreground tracking-tight flex-1">
                                {getKindPresentation(kind).plural}
                            </h3>
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                {groupedChildren[kind].length}
                            </span>
                        </div>
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="divide-y" role="list">
                                {groupedChildren[kind].map((child) => {
                                    const key = child.type === 'navItem' ? child.item.id : child.node.id;
                                    return <GroupRow 
                                            key={key} 
                                            child={child} 
                                            navigate={navigate} 
                                            hideKindLabel={true}
                                            />;
                                })}
                            </div>
                        </div>
                    </div>
                );
            })
         )}
      </div>
    </div>
  );
}

function GroupRow({ child, navigate, hideKindLabel }: { child: ListItem, navigate: any, hideKindLabel?: boolean }) {
    let title = '';
    let kind = '';
    let status: Status | undefined;
    let duration: number | undefined;
    let tags: string[] = [];
    let nodeId = '';
    let navType: 'group' | 'node' = 'node';

    if (child.type === 'navItem') {
        title = child.item.title;
        kind = child.item.kind;
        status = child.item.status as Status;
        nodeId = child.item.id;
        navType = 'group';
        if (child.item.kind !== 'Group') {
          tags = child.item.node.tags || [];
        }
    } else {
        // Node
        title = child.node.title;
        kind = String(child.node.kind);
        status = child.node.execution?.status;
        duration = child.node.execution?.duration;
        tags = child.node.tags || [];
        nodeId = child.node.id;
        navType = 'node';
    }

    const canDrillDown = shouldAllowDrillDown(kind, status, child.type === 'node' ? child.node : undefined);
    const onClick = canDrillDown ? () => navigate(navType, nodeId) : undefined;
    const Icon = getIconForKind(kind);
    const showAttachmentSlot = isNativeTestKind(kind) || kind === 'Rule' || kind === 'RuleOutline' || kind === 'Scenario' || kind === 'ScenarioOutline';

    const contents = (
        <>
            <div className={cn("p-2 rounded-lg bg-muted/40 group-hover:bg-background transition-colors", 
                status === 'failed' && "bg-destructive/10 text-destructive",
                status === 'passed' && "bg-pass/10 text-pass"
            )}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 min-w-0">
                    {!hideKindLabel && (
                        <span className="font-semibold text-sm capitalize text-muted-foreground mr-1">{getKindPresentation(kind).label}:</span>
                    )}
                    <span className="font-medium truncate text-foreground">{title}</span>
                </div>
                <TagChips
                  tags={tags}
                  className="mt-1.5 overflow-hidden"
                  chipClassName="text-[10px] font-medium px-1.5 py-0.5"
                />
            </div>

        </>
    );

    return (
        <div role="listitem" className={cn(
            'relative flex items-center gap-2 px-4 py-3 group',
            canDrillDown && 'transition-colors hover:bg-muted/50',
        )}>
            {canDrillDown ? (
                <button
                    type="button"
                    title={child.type === 'navItem' ? navItemPath(child.item) : undefined}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left before:absolute before:inset-0 focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-inset focus-visible:before:ring-ring"
                    onClick={onClick}
                >
                    {contents}
                </button>
            ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    {contents}
                </div>
            )}
            <ListRowMetadata
                node={child.type === 'node' ? child.node : undefined}
                duration={duration}
                status={status}
                canDrillDown={canDrillDown}
                showAttachmentSlot={showAttachmentSlot}
                statusSize="xs"
            />
        </div>
    );
}
