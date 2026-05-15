import * as React from "react"
import { useStore, type Run, type RunGroup } from '../store';
import { StatusBadge } from './StatusBadge';
import type { AnyTest, TestCase } from '@swedevtools/livedoc-schema';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type NavKind = 'Group' | ContainerKind;

type ProjectEntry =
  | {
      kind: 'group';
      key: string;
      label: string;
      environment: string;
      group: RunGroup;
      timestamp: string;
    }
  | {
      kind: 'project';
      key: string;
      label: string;
      project: string;
      environment: string;
      run: Run;
      timestamp: string;
      grouped: boolean;
    };

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

function timestampMs(value: string | undefined): number {
  const ms = Date.parse(value ?? '');
  return Number.isFinite(ms) ? ms : 0;
}

function latestRun(runs: Run[]): Run | undefined {
  return runs
    .slice()
    .sort((a, b) => timestampMs(b.run.timestamp) - timestampMs(a.run.timestamp))[0];
}

function latestGroup(groups: RunGroup[]): RunGroup | undefined {
  return groups
    .slice()
    .sort((a, b) => timestampMs(b.run.timestamp) - timestampMs(a.run.timestamp))[0];
}

function latestProjectEntries(
  runs: Run[],
  groupedRunIds: Set<string>,
  groupedProjectEnvKeys: Set<string>,
  hideGroupedSourceProjects: boolean
): ProjectEntry[] {
  const latestByProjectEnv = new Map<string, ProjectEntry & { kind: 'project' }>();

  for (const run of runs) {
    const key = `${run.run.project}/${run.run.environment}`;
    const grouped = groupedRunIds.has(run.run.runId) || groupedProjectEnvKeys.has(key);
    if (hideGroupedSourceProjects && groupedProjectEnvKeys.has(key)) continue;

    const existing = latestByProjectEnv.get(key);
    if (existing && timestampMs(existing.timestamp) >= timestampMs(run.run.timestamp)) continue;

    latestByProjectEnv.set(key, {
      kind: 'project',
      key,
      label: run.run.project,
      project: run.run.project,
      environment: run.run.environment,
      run,
      timestamp: run.run.timestamp,
      grouped,
    });
  }

  return Array.from(latestByProjectEnv.values());
}

export function Sidebar() {
  const {
    currentView,
    sidebarWidth,
    expandedItems,
    navigate,
    toggleExpanded,
    getCurrentRun,
    getCurrentRunGroup,
    getRunGroups,
    runs,
    projectHierarchy,
    projectGrouping,
    selectRun,
    selectRunGroup,
    filterText,
    filterTags,
  } = useStore();

  const currentRun = getCurrentRun();
  const currentGroup = getCurrentRunGroup();
  const groups = getRunGroups();

  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const [envMenuOpen, setEnvMenuOpen] = React.useState(false);
  const [runMenuOpen, setRunMenuOpen] = React.useState(false);

  const projectEntries = React.useMemo<ProjectEntry[]>(() => {
    if (projectGrouping.enabled && groups.length > 0) {
      const groupedRunIds = new Set(groups.flatMap((group) => group.group.runs.map((run) => run.runId)));
      const groupedProjectEnvKeys = new Set(groups.flatMap((group) =>
        group.group.runs.map((run) => `${run.project}/${run.environment}`)
      ));
      const groupEntries: ProjectEntry[] = groups.map((group) => ({
        kind: 'group',
        key: group.group.id,
        label: group.group.name,
        environment: group.group.environment,
        group,
        timestamp: group.run.timestamp,
      }));

      const rawEntries = latestProjectEntries(runs, groupedRunIds, groupedProjectEnvKeys, projectGrouping.hideSourceProjects);

      return [...groupEntries, ...rawEntries]
        .sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp));
    }

    const latestByProjectEnv = new Map<string, Run>();
    for (const run of runs) {
      const key = `${run.run.project}/${run.run.environment}`;
      const existing = latestByProjectEnv.get(key);
      if (!existing || timestampMs(run.run.timestamp) > timestampMs(existing.run.timestamp)) {
        latestByProjectEnv.set(key, run);
      }
    }

    if (latestByProjectEnv.size === 0) {
      for (const project of projectHierarchy ?? []) {
        for (const env of project.environments ?? []) {
          if (!env.latestRun) continue;
          latestByProjectEnv.set(`${project.name}/${env.name}`, env.latestRun);
        }
      }
    }

    return Array.from(latestByProjectEnv.values())
      .map<ProjectEntry>((run) => ({
        kind: 'project',
        key: `${run.run.project}/${run.run.environment}`,
        label: run.run.project,
        project: run.run.project,
        environment: run.run.environment,
        run,
        timestamp: run.run.timestamp,
        grouped: false,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [groups, projectGrouping.enabled, projectGrouping.hideSourceProjects, projectHierarchy, runs]);

  const selectedProjectEntry = React.useMemo(() => {
    if (currentGroup) {
      return projectEntries.find((entry) => entry.kind === 'group' && entry.group.group.id === currentGroup.group.id);
    }

    if (currentRun) {
      return projectEntries.find((entry) =>
        entry.kind === 'project' &&
        entry.project === currentRun.run.project &&
        entry.environment === currentRun.run.environment
      );
    }

    return projectEntries[0];
  }, [currentGroup, currentRun, projectEntries]);

  const currentProject = selectedProjectEntry?.label ?? currentRun?.run.project ?? '';
  const currentEnvironment = selectedProjectEntry?.environment ?? currentRun?.run.environment ?? 'default';

  const environmentNames = React.useMemo(() => {
    if (selectedProjectEntry?.kind === 'group') return [selectedProjectEntry.environment];

    const selectedProject = selectedProjectEntry?.kind === 'project'
      ? selectedProjectEntry.project
      : currentRun?.run.project;
    if (!selectedProject) return [];

    const fromRuns = runs
      .filter((run) => run.run.project === selectedProject)
      .map((run) => run.run.environment);
    const fromHierarchy = (projectHierarchy ?? [])
      .find((project) => project.name === selectedProject)
      ?.environments
      ?.map((env) => env.name) ?? [];
    return Array.from(new Set([...fromRuns, ...fromHierarchy])).filter(Boolean);
  }, [currentRun?.run.project, projectHierarchy, runs, selectedProjectEntry]);

  const selectProjectEntry = React.useCallback((entry: ProjectEntry) => {
    if (entry.kind === 'group') {
      selectRunGroup(entry.group.group.id);
      return;
    }

    selectRun(entry.run.run.runId);
  }, [selectRun, selectRunGroup]);

  const selectEnvironment = React.useCallback((environment: string) => {
    if (!environment || !selectedProjectEntry) return;

    if (selectedProjectEntry.kind === 'group') {
      const candidates = groups.filter(
        (group) => group.group.name === selectedProjectEntry.label && group.group.environment === environment
      );
      const chosen = latestGroup(candidates);
      if (chosen) selectRunGroup(chosen.group.id);
      return;
    }

    const candidates = runs.filter(
      (run) => run.run.project === selectedProjectEntry.project && run.run.environment === environment
    );
    const chosen = latestRun(candidates);
    if (chosen) selectRun(chosen.run.runId);
  }, [groups, runs, selectRun, selectRunGroup, selectedProjectEntry]);

  const runMenuEntries = React.useMemo(() => {
    if (selectedProjectEntry?.kind === 'group') {
      return groups
        .filter((group) => group.group.name === selectedProjectEntry.label && group.group.environment === selectedProjectEntry.environment)
        .sort((a, b) => timestampMs(b.run.timestamp) - timestampMs(a.run.timestamp))
        .map((group, index) => ({
          kind: 'group' as const,
          id: group.group.id,
          label: index === 0 ? 'Latest set' : group.run.timestamp,
          timestamp: group.run.timestamp,
        }));
    }

    if (selectedProjectEntry?.kind === 'project') {
      return runs
        .filter((run) => run.run.project === selectedProjectEntry.project && run.run.environment === selectedProjectEntry.environment)
        .sort((a, b) => timestampMs(b.run.timestamp) - timestampMs(a.run.timestamp))
        .map((run, index) => ({
          kind: 'run' as const,
          id: run.run.runId,
          label: index === 0 ? 'Latest' : run.run.timestamp,
          timestamp: run.run.timestamp,
        }));
    }

    return [];
  }, [groups, runs, selectedProjectEntry]);

  const currentRunLabel = React.useMemo(() => {
    if (currentGroup) {
      const match = runMenuEntries.find((entry) => entry.kind === 'group' && entry.id === currentGroup.group.id);
      return match?.label ?? 'Latest set';
    }

    if (currentRun) {
      const match = runMenuEntries.find((entry) => entry.kind === 'run' && entry.id === currentRun.run.runId);
      return match?.label ?? currentRun.run.timestamp;
    }

    return '—';
  }, [currentGroup, currentRun, runMenuEntries]);

  const documents = currentRun?.run.documents ?? [];
  const navTree = React.useMemo(() => buildGroupedNavTree(documents), [documents]);

  const navTreeForSidebar = React.useMemo(() => {
    const maybeRoot = navTree.length === 1 && navTree[0]?.kind === 'Group' && navTree[0]?.id === 'group:/'
      ? navTree[0]
      : undefined;

    if (!maybeRoot) return navTree;

    const hasRootLevelContainers = maybeRoot.children.some((child) => child.kind !== 'Group');
    if (!hasRootLevelContainers) return maybeRoot.children;

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

      const suppressChildren = level === 0 && item.id === 'group:/';
      const isExpanded = expandedItems.has(item.id);
      const isSelected = currentView.type === 'group' && currentView.id === item.id;

      const renderedChildren = renderNavTree(item.children, level + 1);
      const hasRenderedChild = React.Children.toArray(renderedChildren).length > 0;

      if (!itemVisible(item) && !hasRenderedChild) return null;

      const hasChildren = !suppressChildren && item.children.some((child) => child.kind === 'Group');
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
              onClick={(event) => {
                event.stopPropagation();
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
              onClick={() => navigate('group', item.id)}
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
      <div className="border-b shrink-0 bg-muted/30">
        <div
          role="button"
          tabIndex={0}
          className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => navigate('summary')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate('summary');
            }
          }}
        >
          <div className="text-sm font-bold tracking-tight">LiveDoc</div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Project</span>
              {projectEntries.length > 0 ? (
                <DropdownMenu open={projectMenuOpen} onOpenChange={setProjectMenuOpen}>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select project"
                    >
                      {currentProject}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    {projectEntries.map((entry) => (
                      <DropdownMenuItem
                        key={entry.key}
                        onSelect={() => {
                          selectProjectEntry(entry);
                          setProjectMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          entry.key === selectedProjectEntry?.key && "bg-muted"
                        )}
                      >
                        <span className="truncate">{entry.label}</span>
                        {entry.kind === 'group' && (
                          <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            Group
                          </span>
                        )}
                        {entry.kind === 'project' && entry.grouped && (
                          <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                            Source
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-xs font-medium">—</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Environment</span>
              {environmentNames.length > 0 ? (
                <DropdownMenu open={envMenuOpen} onOpenChange={setEnvMenuOpen}>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select environment"
                    >
                      {currentEnvironment}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    {environmentNames.map((name) => (
                      <DropdownMenuItem
                        key={name}
                        onSelect={() => {
                          selectEnvironment(name);
                          setEnvMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          name === currentEnvironment && "bg-muted"
                        )}
                      >
                        {name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-xs font-medium">—</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Run</span>
              {runMenuEntries.length > 0 ? (
                <DropdownMenu open={runMenuOpen} onOpenChange={setRunMenuOpen}>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select run"
                    >
                      {currentRunLabel}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    {runMenuEntries.map((entry) => (
                      <DropdownMenuItem
                        key={entry.id}
                        onSelect={() => {
                          if (entry.kind === 'group') selectRunGroup(entry.id);
                          else selectRun(entry.id);
                          setRunMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          entry.id === currentGroup?.group.id && "bg-muted",
                          entry.id === currentRun?.run.runId && "bg-muted"
                        )}
                      >
                        {entry.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-xs font-medium">—</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
              <div className="flex items-center gap-2">
                {currentRun?.run.status === 'running' && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
                {currentRun?.run.status ? (
                  <StatusBadge status={currentRun.run.status as any} size="xs" />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
