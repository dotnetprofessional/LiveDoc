import * as React from "react"
import { useStore, type Run, type RunGroup } from '../store';
import { StatusBadge } from './StatusBadge';
import type { AnyTest, Status, TestCase } from '@swedevtools/livedoc-schema';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Gauge,
} from "lucide-react"
import { cn } from "../lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { buildGroupedNavTree, ContainerKind, NavItem } from '../lib/nav-tree';
import { subtreeHasMatch } from '../lib/filter-utils';
import { deriveRunBadges, formatRunBadge, mergeRunHistoryEntries, type RunHistoryEntry } from '../lib/run-history';
import { latestLogicalRunGroups } from '../lib/run-grouping';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

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
  hideGroupedSourceProjects: boolean
): ProjectEntry[] {
  const latestByProjectEnv = new Map<string, ProjectEntry & { kind: 'project' }>();

  for (const run of runs) {
    const key = `${run.run.project}/${run.run.environment}`;
    const grouped = groupedRunIds.has(run.run.runId);

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

  return Array.from(latestByProjectEnv.values())
    .filter((entry) => !(hideGroupedSourceProjects && entry.grouped));
}

export function Sidebar({ fullWidth = false }: { fullWidth?: boolean } = {}) {
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
    physicalRuns,
    projectHierarchy,
    projectGrouping,
    audienceMode,
    selectedRunId,
    selectedRunView,
    selectRun,
    selectRunGroup,
    setRunView,
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
      const latestGroupIds = new Set(
        latestLogicalRunGroups(groups.map((group) => group.group)).map((group) => group.id)
      );
      const groupEntries: ProjectEntry[] = groups
        .filter((group) => latestGroupIds.has(group.group.id))
        .map((group) => ({
          kind: 'group',
          key: group.group.id,
          label: group.group.name,
          environment: group.group.environment,
          group,
          timestamp: group.run.timestamp,
        }));

      const rawEntries = latestProjectEntries(runs, groupedRunIds, projectGrouping.hideSourceProjects);

      return [...groupEntries, ...rawEntries]
        .sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp));
    }

    const latestByProjectEnv = new Map<string, Run>();
    for (const project of projectHierarchy ?? []) {
      for (const env of project.environments ?? []) {
        if (!env.latestRun) continue;
        latestByProjectEnv.set(`${project.name}/${env.name}`, env.latestRun);
      }
    }

    for (const run of runs) {
      const key = `${run.run.project}/${run.run.environment}`;
      const existing = latestByProjectEnv.get(key);
      if (!existing || (run.run.status === 'running' && existing.run.status !== 'running')) {
        latestByProjectEnv.set(key, run);
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
      return projectEntries.find((entry) =>
        entry.kind === 'group' &&
        entry.group.group.name === currentGroup.group.name &&
        entry.group.group.environment === currentGroup.group.environment
      );
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
    const active = candidates.find((run) => run.run.status === 'running');
    if (active) {
      selectRun(active.run.runId);
      return;
    }

    const hierarchyLatest = (projectHierarchy ?? [])
      .find((project) => project.name === selectedProjectEntry.project)
      ?.environments.find((env) => env.name === environment)
      ?.latestRun;
    if (hierarchyLatest) {
      selectRun(hierarchyLatest.run.runId);
      return;
    }

    const chosen = latestRun(candidates);
    if (chosen) selectRun(chosen.run.runId);
  }, [groups, projectHierarchy, runs, selectRun, selectRunGroup, selectedProjectEntry]);

  const runHistoryEntriesForSelection = React.useMemo<RunHistoryEntry[]>(() => {
    if (selectedProjectEntry?.kind !== 'project') return [];

    const { project, environment } = selectedProjectEntry;
    const toEntry = (run: Run['run']): RunHistoryEntry => ({
      runId: run.runId,
      timestamp: run.timestamp,
      status: run.status,
      summary: run.summary,
      runType: run.runType,
      baselineRunId: run.baselineRunId,
    });

    const historyFromHierarchy: RunHistoryEntry[] = (projectHierarchy ?? [])
      .find((p) => p.name === project)
      ?.environments.find((e) => e.name === environment)
      ?.history.map((h) => ({
        runId: h.runId,
        timestamp: h.timestamp,
        status: h.status as Status,
        summary: h.summary as any,
        runType: h.runType,
        baselineRunId: h.baselineRunId,
      })) ?? [];

    const liveEntries: RunHistoryEntry[] = [
      ...runs
        .filter((r) => r.run.project === project && r.run.environment === environment)
        .map((r) => toEntry(r.run)),
      ...Object.values(physicalRuns)
        .filter((r) => r.run.project === project && r.run.environment === environment)
        .map((r) => toEntry(r.run)),
    ];

    return mergeRunHistoryEntries(historyFromHierarchy, liveEntries);
  }, [physicalRuns, projectHierarchy, runs, selectedProjectEntry]);

  const badgedRunEntries = React.useMemo(
    () => deriveRunBadges(runHistoryEntriesForSelection),
    [runHistoryEntriesForSelection]
  );

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
          badgeLabel: undefined as string | undefined,
        }));
    }

    if (selectedProjectEntry?.kind === 'project') {
      return badgedRunEntries
        .map((entry, index) => ({
          kind: 'run' as const,
          id: entry.runId,
          label: index === 0 ? 'Latest' : entry.timestamp,
          timestamp: entry.timestamp,
          badgeLabel: formatRunBadge(entry.badge),
        }));
    }

    return [];
  }, [badgedRunEntries, groups, selectedProjectEntry]);

  /** Selects a run entry from the chronological list, defaulting to Combined unless it's an
   *  active partial only tracked in the physical cache (no combined snapshot yet). */
  const selectRunEntry = React.useCallback((runId: string) => {
    const hasCombinedLoaded = runs.some((r) => r.run.runId === runId);
    const isActivePhysicalOnly =
      !hasCombinedLoaded &&
      physicalRuns[runId]?.run.status === 'running';
    selectRun(runId, isActivePhysicalOnly ? 'physical' : 'combined');
  }, [physicalRuns, runs, selectRun]);

  const currentRunLabel = React.useMemo(() => {
    if (currentGroup) {
      const match = runMenuEntries.find((entry) => entry.kind === 'group' && entry.id === currentGroup.group.id);
      return match?.label ?? 'Latest set';
    }

    const activeRunId = currentRun?.run.runId ?? selectedRunId;
    if (activeRunId) {
      const match = runMenuEntries.find((entry) => entry.kind === 'run' && entry.id === activeRunId);
      return match?.label ?? currentRun?.run.timestamp ?? '—';
    }

    return '—';
  }, [currentGroup, currentRun, runMenuEntries, selectedRunId]);

  const selectedRunBadge = React.useMemo(() => {
    const activeRunId = currentRun?.run.runId ?? selectedRunId;
    if (!activeRunId) return undefined;
    return badgedRunEntries.find((entry) => entry.runId === activeRunId)?.badge;
  }, [badgedRunEntries, currentRun, selectedRunId]);

  const showRunProjectionToggle =
    !currentGroup &&
    selectedRunBadge?.kind === 'partial' &&
    currentRun?.run.status !== 'running';

  const documents = currentRun?.run.documents ?? [];
  const hasCoverageDetails = currentGroup
    ? currentGroup.group.runs.some((run) => (run.coverage?.files?.length ?? 0) > 0)
    : (currentRun?.run.coverage?.files?.length ?? 0) > 0;
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
      style={{ width: fullWidth ? '100%' : sidebarWidth }}
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
                      className="flex items-center gap-1.5 text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select run"
                    >
                      {currentRunLabel}
                      {selectedRunBadge && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                            selectedRunBadge.kind === 'partial'
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {formatRunBadge(selectedRunBadge)}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                    {runMenuEntries.map((entry) => (
                      <DropdownMenuItem
                        key={entry.id}
                        onSelect={() => {
                          if (entry.kind === 'group') selectRunGroup(entry.id);
                          else selectRunEntry(entry.id);
                          setRunMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          entry.id === currentGroup?.group.id && "bg-muted",
                          entry.id === (currentRun?.run.runId ?? selectedRunId) && "bg-muted"
                        )}
                      >
                        <span className="truncate flex-1">{entry.label}</span>
                        {entry.badgeLabel && (
                          <span
                            className={cn(
                              "ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0",
                              entry.badgeLabel === 'Full'
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-primary"
                            )}
                          >
                            {entry.badgeLabel}
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

            {showRunProjectionToggle && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">View</span>
                <Tabs
                  value={selectedRunView}
                  onValueChange={(value) => setRunView(value as 'combined' | 'physical')}
                >
                  <TabsList
                    className="h-6 rounded-full bg-muted/40 p-0.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <TabsTrigger value="combined" className="rounded-full px-2 py-0 text-[10px] leading-5">
                      Combined
                    </TabsTrigger>
                    <TabsTrigger value="physical" className="rounded-full px-2 py-0 text-[10px] leading-5">
                      This partial
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
              <div className="flex items-center gap-2">
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
        {audienceMode === 'developer' && hasCoverageDetails && (
          <div className="px-2 pb-2">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                currentView.type === 'coverage'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => navigate('coverage')}
            >
              <Gauge className="h-4 w-4" />
              Coverage
            </button>
          </div>
        )}

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
