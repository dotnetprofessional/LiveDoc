import * as React from "react"
import { useStore, type Run, type RunGroup } from '../store';
import { StatusBadge } from './StatusBadge';
import type { AnyTest, Status, TestCase } from '@swedevtools/livedoc-schema';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  Gauge,
  X,
} from "lucide-react"
import { cn } from "../lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { buildGroupedNavTree, ContainerKind, NavItem, navItemPath, projectNavTree } from '../lib/nav-tree';
import { getKindPresentation } from '../lib/kind-presentation';
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
import { isStaticMode } from '../config';
import { deleteStoredResult, refreshStoredResults, sourceProjectsForGroup } from '../lib/delete-results';
import {
  AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription,
  AlertDialogCancel, AlertDialogAction,
} from './ui/alert-dialog';

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

type DeleteTarget =
  | { kind: 'project'; name: string; sources: string[]; runCount: number }
  | { kind: 'run'; name: string; runIds: string[]; group: boolean };

function getContainerIcon(kind: ContainerKind) {
  return getKindPresentation(kind).navIcon;
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
    getVisibleRun,
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

  const currentRun = getVisibleRun();
  const currentGroup = getCurrentRunGroup();
  const groups = getRunGroups();

  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const [envMenuOpen, setEnvMenuOpen] = React.useState(false);
  const [runMenuOpen, setRunMenuOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = React.useState('');
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [refreshNeeded, setRefreshNeeded] = React.useState(false);
  const deletedInBatch = React.useRef(new Set<string>());
  const deleting = React.useRef(false);
  const projectTriggerRef = React.useRef<HTMLButtonElement>(null);
  const runTriggerRef = React.useRef<HTMLButtonElement>(null);
  const returnFocusRef = React.useRef<HTMLButtonElement | null>(null);
  const canDelete = !isStaticMode();

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

  const requestProjectDeletion = (entry: ProjectEntry) => {
    returnFocusRef.current = projectTriggerRef.current;
    const sources = entry.kind === 'group'
      ? sourceProjectsForGroup(entry.label, groups.map((group) => group.group))
      : [entry.project];
    const runCount = (projectHierarchy ?? []).filter((node) => sources.includes(node.name))
      .reduce((count, node) => count + node.environments
        .reduce((total, env) => total + env.history.length, 0), 0);
    deletedInBatch.current.clear();
    setDeleteError('');
    setRefreshNeeded(false);
    setProjectMenuOpen(false);
    setDeleteTarget({ kind: 'project', name: entry.label, sources, runCount });
  };

  const requestRunDeletion = (entry: (typeof runMenuEntries)[number]) => {
    returnFocusRef.current = runTriggerRef.current;
    const group = entry.kind === 'group'
      ? groups.find((item) => item.group.id === entry.id)
      : undefined;
    // A grouped run is synthetic; its ID is never sent to the server.
    const runIds = group
      ? group.group.runs.slice().sort((a, b) =>
        Number(b.runType === 'partial') - Number(a.runType === 'partial')
      ).map((run) => run.runId)
      : [entry.id];
    deletedInBatch.current.clear();
    setDeleteError('');
    setRefreshNeeded(false);
    setRunMenuOpen(false);
    setDeleteTarget({ kind: 'run', name: entry.label, runIds, group: !!group });
  };

  const confirmDeletion = async () => {
    if (!deleteTarget || deleting.current) return;
    deleting.current = true;
    setDeleteBusy(true);
    setDeleteError('');
    let failure = '';
    try {
      if (!refreshNeeded) {
        const ids = deleteTarget.kind === 'project' ? deleteTarget.sources : deleteTarget.runIds;
        for (const id of ids) {
          if (deletedInBatch.current.has(id)) continue;
          try {
            await deleteStoredResult(deleteTarget.kind === 'project' ? 'projects' : 'runs', id);
            deletedInBatch.current.add(id);
            if (deleteTarget.kind === 'project') useStore.getState().recordDeletion({ project: id });
            else useStore.getState().recordDeletion({ runIds: [id] });
          } catch (error) {
            failure = `Could not delete ${deleteTarget.kind === 'project' ? 'source project' : 'run'} "${id}": ${
              error instanceof Error ? error.message : String(error)
            }. ${deletedInBatch.current.size
              ? `${deletedInBatch.current.size} already deleted; remaining items are still visible. ` : ''
            }Retry or cancel.`;
            break;
          }
        }
      }
      if (deletedInBatch.current.size || refreshNeeded) {
        try {
          await refreshStoredResults();
          setRefreshNeeded(false);
        } catch (error) {
          setRefreshNeeded(true);
          setDeleteError(`Deletion was applied, but the updated project and run lists could not be loaded: ${
            error instanceof Error ? error.message : String(error)
          }. Retry refresh or reload the page.`);
          return;
        }
      }
      if (failure) {
        setDeleteError(failure);
        return;
      }
      const remaining = (deleteTarget.kind === 'project' ? deleteTarget.sources : deleteTarget.runIds)
        .filter((id) => !deletedInBatch.current.has(id));
      if (remaining.length > 0) {
        setDeleteError(`Project and run lists are up to date, but ${remaining.length} ${
          deleteTarget.kind === 'project'
            ? `source project${remaining.length === 1 ? '' : 's'}`
            : `run${remaining.length === 1 ? '' : 's'}`
        } still remain. Retry deletion or cancel.`);
        return;
      }
      setDeleteTarget(null);
    } finally {
      deleting.current = false;
      setDeleteBusy(false);
    }
  };

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

  const navTreeForSidebar = React.useMemo(
    () => projectNavTree(navTree).sidebarItems,
    [navTree]
  );

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
      if (item.kind !== 'Group') {
        return level === 0 ? (
          <button
            key={item.id}
            type="button"
            title={navItemPath(item)}
            onClick={() => navigate('group', item.id)}
            className={cn(
              "mx-2 mb-0.5 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              currentView.id === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {React.createElement(getNavIcon(item.kind), { className: 'h-4 w-4 shrink-0 text-muted-foreground' })}
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            {item.status && <StatusBadge status={item.status as Status} size="xs" />}
          </button>
        ) : null;
      }

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
              title={navItemPath(item)}
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
              title={navItemPath(item)}
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
      aria-label="Report navigation"
      className="flex h-full flex-col bg-card shrink-0 overflow-hidden"
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
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select project"
                      ref={projectTriggerRef}
                    >
                      {currentProject}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}
                    onCloseAutoFocus={(event) => { if (deleteTarget) event.preventDefault(); }}>
                    {projectEntries.map((entry) => (
                      <div key={entry.key} className="flex min-w-0 items-center" role="none">
                        <DropdownMenuItem
                          onSelect={() => {
                            selectProjectEntry(entry);
                            setProjectMenuOpen(false);
                          }}
                          className={cn("min-w-0 flex-1 text-xs", entry.key === selectedProjectEntry?.key && "bg-muted")}
                        >
                          <span className="truncate">{entry.label}</span>
                          {entry.kind === 'group' && (
                            <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">Group</span>
                          )}
                          {entry.kind === 'project' && entry.grouped && (
                            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">Source</span>
                          )}
                        </DropdownMenuItem>
                        {canDelete && (
                          <DropdownMenuItem
                            aria-label={`Delete ${entry.kind === 'group' ? 'project group' : 'project'} ${entry.label}`}
                            className="ml-1 shrink-0 rounded-sm p-1.5 text-muted-foreground focus:bg-destructive/10 focus:text-destructive"
                            onSelect={() => requestProjectDeletion(entry)}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </DropdownMenuItem>
                        )}
                      </div>
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
                    onKeyDown={(event) => event.stopPropagation()}
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
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select run"
                      ref={runTriggerRef}
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
                  <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}
                    onCloseAutoFocus={(event) => { if (deleteTarget) event.preventDefault(); }}>
                    {runMenuEntries.map((entry) => (
                      <div key={entry.id} className="flex min-w-0 items-center" role="none">
                        <DropdownMenuItem
                          onSelect={() => {
                            if (entry.kind === 'group') selectRunGroup(entry.id);
                            else selectRunEntry(entry.id);
                            setRunMenuOpen(false);
                          }}
                          className={cn(
                            "min-w-0 flex-1 text-xs",
                            entry.id === currentGroup?.group.id && "bg-muted",
                            entry.id === (currentRun?.run.runId ?? selectedRunId) && "bg-muted"
                          )}
                        >
                          <span className="truncate flex-1">{entry.label}</span>
                          {entry.badgeLabel && (
                            <span className={cn(
                              "ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold shrink-0",
                              entry.badgeLabel === 'Full' ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                            )}>{entry.badgeLabel}</span>
                          )}
                        </DropdownMenuItem>
                        {canDelete && (
                          <DropdownMenuItem
                            aria-label={`Delete ${entry.kind === 'group' ? 'run group' : 'run'} ${entry.label}`}
                            className="ml-1 shrink-0 rounded-sm p-1.5 text-muted-foreground focus:bg-destructive/10 focus:text-destructive"
                            onSelect={() => requestRunDeletion(entry)}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </DropdownMenuItem>
                        )}
                      </div>
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

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => {
        if (!open && !deleteBusy) setDeleteTarget(null);
      }}>
        <AlertDialogContent
          onEscapeKeyDown={(event) => { if (deleteBusy) event.preventDefault(); }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
          aria-describedby="delete-results-description"
        >
          <AlertDialogTitle className="text-lg font-semibold">
            {deleteTarget?.kind === 'project' ? 'Permanently delete project results?' : 'Permanently delete run results?'}
          </AlertDialogTitle>
          <AlertDialogDescription id="delete-results-description" className="space-y-3 text-sm text-muted-foreground">
            {deleteTarget?.kind === 'project' ? (
              <>
                <span className="block">
                  Delete <strong className="text-foreground break-words">{deleteTarget.name}</strong> and all saved runs
                  across every environment for {deleteTarget.sources.length} source {deleteTarget.sources.length === 1 ? 'project' : 'projects'}
                  {deleteTarget.runCount > 0 ? ` (at least ${deleteTarget.runCount} recorded runs)` : ''}.
                </span>
                <span className="block">Source projects:</span>
                <span className="block max-h-32 overflow-y-auto rounded-md bg-muted/50 p-2 text-foreground">
                  {deleteTarget.sources.map((source) => (
                    <span key={source} className="block break-all">{source}{deletedInBatch.current.has(source) ? ' — deleted' : ''}</span>
                  ))}
                </span>
                {deleteTarget.sources.some((source) => /[/\\]/.test(source)) && (
                  <span className="block text-foreground">
                    The server rejects project names containing slashes, even when URL-encoded. That source cannot be removed with this API.
                  </span>
                )}
                <span className="block">This is permanent. Each source is deleted separately; if one fails, remaining sources stay available.</span>
              </>
            ) : deleteTarget ? (
              <>
                <span className="block">
                  {deleteTarget.group
                    ? `This set contains ${deleteTarget.runIds.length} saved source runs. Each exact run below will be permanently deleted.`
                    : 'Only this exact saved run will be permanently deleted; other runs in its project remain.'}
                </span>
                <span className="block max-h-32 overflow-y-auto rounded-md bg-muted/50 p-2 text-foreground">
                  {deleteTarget.runIds.map((id) => (
                    <span key={id} className="block break-all">{id}{deletedInBatch.current.has(id) ? ' — deleted' : ''}</span>
                  ))}
                </span>
                <span className="block">Active runs and runs with dependent partials cannot be deleted. A partial failure leaves the remaining runs available.</span>
              </>
            ) : null}
          </AlertDialogDescription>
          {deleteError && <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-foreground break-words">{deleteError}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy || (deleteTarget?.kind === 'project' && deleteTarget.sources.length === 0)}
              onClick={(event) => { event.preventDefault(); void confirmDeletion(); }}
            >
              {deleteBusy ? 'Deleting…' : refreshNeeded ? 'Retry refresh' : deleteError ? 'Retry deletion' : 'Delete permanently'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
