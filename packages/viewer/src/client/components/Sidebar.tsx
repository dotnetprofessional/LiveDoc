import * as React from "react"
import { useStore } from '../store';
import { StatusBadge } from './StatusBadge';
import type { AnyTest, TestCase } from '@livedoc/schema';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder,
  FileText,
  Loader2,
} from "lucide-react"
import { cn } from "../lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { buildGroupedNavTree, ContainerKind, NavItem } from '../lib/nav-tree';
import { subtreeHasMatch } from '../lib/filter-utils';

type NavKind = 'Group' | ContainerKind;

function getContainerIcon(kind: ContainerKind) {
  switch (kind) {
    case 'Feature':
      return FileText;
    case 'Specification':
      return FileText;
    case 'Container':
      return Folder;
    default:
      return FileText;
  }
}

function getNavIcon(kind: NavKind) {
  if (kind === 'Group') return Folder;
  return getContainerIcon(kind);
}

export function Sidebar() {
  const { 
    currentView,
    sidebarWidth,
    expandedItems,
    navigate,
    toggleExpanded,
    getCurrentRun,
    filterText,
    filterTags,
  } = useStore();

  const currentRun = getCurrentRun();

  const documents = currentRun?.run.documents ?? [];
  const navTree = React.useMemo(() => buildGroupedNavTree(documents), [documents]);

  const navTreeForSidebar = React.useMemo(() => {
    // The nav-tree builder always returns a synthetic Root group (group:/) so
    // root-level documents (no path segments) still have a place to live.
    // For the Explorer-like sidebar UX, keep Root visible (so users can open it)
    // while also showing its descendants at the same level (no mandatory expand).
    const maybeRoot = navTree.length === 1 && navTree[0]?.kind === 'Group' && navTree[0]?.id === 'group:/'
      ? navTree[0]
      : undefined;

    if (!maybeRoot) return navTree;

    return [maybeRoot, ...maybeRoot.children];
  }, [navTree]);

  const renderNavTree = React.useCallback((items: NavItem[], level = 0): React.ReactNode => {
    const textQueryLower = filterText.trim().toLowerCase();
    const hasText = textQueryLower.length > 0;
    const hasTags = filterTags.length > 0;

    const nodeMatchesText = (node: TestCase | AnyTest) => subtreeHasMatch(node as any, textQueryLower, []);
    const nodeMatchesTags = (node: TestCase | AnyTest) => subtreeHasMatch(node as any, '', filterTags);

    const groupHasNodeMatch = (group: NavItem & { kind: 'Group' }, predicate: (n: TestCase | AnyTest) => boolean): boolean => {
      const stack: NavItem[] = [...group.children];
      while (stack.length > 0) {
        const item = stack.pop();
        if (!item) continue;
        if (item.kind === 'Group') {
          stack.push(...item.children);
          continue;
        }
        if (predicate(item.node)) return true;
      }
      return false;
    };

    const itemVisible = (item: NavItem): boolean => {
      if (!hasText && !hasTags) return true;

      const titleOk = !hasText || item.title.toLowerCase().includes(textQueryLower);

      if (item.kind === 'Group') {
        const textOk = titleOk || (hasText ? groupHasNodeMatch(item, nodeMatchesText) : true);
        const tagsOk = !hasTags || groupHasNodeMatch(item, nodeMatchesTags);
        return textOk && tagsOk;
      }

      return subtreeHasMatch(item.node, textQueryLower, filterTags);
    };

    return items.map((item) => {
      if (item.kind !== 'Group') return null;

      // Root is shown as a top-level entry, but its child folders are already
      // rendered at the same level. Suppress Root's nested rendering to avoid
      // duplicates while still allowing filter visibility to consider descendants.
      const suppressChildren = level === 0 && item.id === 'group:/';

      const isExpanded = expandedItems.has(item.id);
      const isSelected = currentView.type === 'group' && currentView.id === item.id;

      const renderedChildren = renderNavTree(item.children, level + 1);
      const hasRenderedChild = React.Children.toArray(renderedChildren).length > 0;

      if (!itemVisible(item) && !hasRenderedChild) return null;

      const hasChildren = !suppressChildren && item.children.some((c) => c.kind === 'Group');
      const Icon = getNavIcon(item.kind);

        return (
          <div key={item.id} className="select-none">
            <div
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 transition-all rounded-md mx-2 mb-0.5 group",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              style={{ paddingLeft: `${(level * 12) + 8}px` }}
            >
              <button
                type="button"
                className={cn(
                  "w-4 h-4 flex items-center justify-center shrink-0 rounded-sm",
                  hasChildren ? "hover:bg-muted-foreground/10" : "pointer-events-none"
                )}
                aria-label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) toggleExpanded(item.id);
                }}
              >
                {hasChildren ? (
                  isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <div className="w-1 h-1 rounded-full bg-current opacity-20" />
                )}
              </button>

              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isSelected ? "text-primary-foreground" : "text-muted-foreground/60"
                )}
              />

              <button
                type="button"
                className={cn(
                  "flex items-center gap-2 min-w-0 flex-1 text-left",
                  isSelected ? "text-primary-foreground" : "text-foreground"
                )}
                onClick={() => {
                  navigate('group', item.id);
                }}
              >
                <span className="text-sm truncate flex-1">{item.title}</span>
              </button>

              {item.status && (
                <StatusBadge status={item.status as any} size="xs" />
              )}
            </div>

            <AnimatePresence initial={false}>
              {hasChildren && isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {renderedChildren}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      });
  }, [currentView.id, currentView.type, expandedItems, filterTags, filterText, navigate, toggleExpanded]);

  return (
    <aside 
      className="flex flex-col bg-card border-r shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
      style={{ width: sidebarWidth }}
    >
      {/* Left Nav Header (BRD) */}
      <div className="border-b shrink-0 bg-muted/30">
        <button
          type="button"
          className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
          onClick={() => navigate('summary')}
        >
          <div className="text-sm font-bold tracking-tight">LiveDoc</div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Environment</span>
              <span className="text-xs font-medium">{currentRun?.run.environment ?? 'default'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Run</span>
              <span className="text-xs font-medium">Latest</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
              <div className="flex items-center gap-2">
                {currentRun?.run.status === 'running' && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
                {currentRun?.run.status ? (
                  <StatusBadge status={currentRun.run.status} size="xs" />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Containers */}
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
          <span>Containers</span>
          <span className="bg-muted px-1.5 py-0.5 rounded text-[9px]">{documents.length}</span>
        </div>

        <div className="mt-1">
          {navTreeForSidebar.length > 0 ? (
            renderNavTree(navTreeForSidebar)
          ) : (
            <div className="px-4 py-3 text-xs text-muted-foreground">No containers yet</div>
          )}
        </div>
      </div>
    </aside>
  );
}
