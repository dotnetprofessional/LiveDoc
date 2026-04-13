import * as React from "react"
import { useStore, makeSessionState, type Session } from '../store';
import { getApiBaseUrl } from '../config';
import { StatusBadge } from './StatusBadge';
import type { AnyTest, TestCase, SessionV1 } from '@swedevtools/livedoc-schema';
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
    getCurrentSession,
    getCurrentView,
    runs,
    sessions,
    projectHierarchy,
    selectRun,
    selectSession,
    addSession,
    filterText,
    filterTags,
  } = useStore();

  const currentRun = getCurrentRun();
  const currentSession = getCurrentSession();
  const currentViewData = getCurrentView();

  const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
  const [envMenuOpen, setEnvMenuOpen] = React.useState(false);
  const [runMenuOpen, setRunMenuOpen] = React.useState(false);

  const projectNames = React.useMemo(() => {
    const fromHierarchy = (projectHierarchy ?? [])
      .map((p) => p?.name)
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
    if (fromHierarchy.length > 0) return fromHierarchy;

    // Fallback: extract from sessions and runs
    const fromSessions = (sessions ?? []).map((s) => s?.session?.project);
    const fromRuns = (runs ?? []).map((r) => r?.run?.project);
    const uniq = new Set([...fromSessions, ...fromRuns].filter((n): n is string => typeof n === 'string' && n.trim().length > 0));
    return Array.from(uniq);
  }, [projectHierarchy, runs, sessions]);

  const currentProject = currentSession?.session.project ?? currentRun?.run.project ?? projectNames[0] ?? '';

  const environmentNames = React.useMemo(() => {
    const projectFromHierarchy = (projectHierarchy ?? []).find((p) => p.name === currentProject);
    const fromHierarchy = (projectFromHierarchy?.environments ?? [])
      .map((e) => e?.name)
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0);

    if (fromHierarchy.length > 0) return fromHierarchy;

    // Fallback: extract from sessions and runs
    const fromSessions = (sessions ?? []).filter((s) => s?.session?.project === currentProject).map((s) => s?.session?.environment);
    const fromRuns = (runs ?? []).filter((r) => r?.run?.project === currentProject).map((r) => r?.run?.environment);
    const uniq = new Set([...fromSessions, ...fromRuns].filter((n): n is string => typeof n === 'string' && n.trim().length > 0));
    return Array.from(uniq);
  }, [currentProject, projectHierarchy, runs, sessions]);

  const currentEnvironment = currentSession?.session.environment ?? currentRun?.run.environment ?? environmentNames[0] ?? 'default';

  const selectProject = React.useCallback(async (project: string) => {
    if (!project) return;

    // Prefer: latest session for this project
    const sessionCandidates = (sessions ?? []).filter((s) => s.session.project === project);
    if (sessionCandidates.length > 0) {
      const latestSession = sessionCandidates
        .slice()
        .sort((a, b) => (Date.parse(b.session.timestamp) || 0) - (Date.parse(a.session.timestamp) || 0))[0];
      selectSession(latestSession.session.sessionId);
      return;
    }

    // Fallback: latest run in the currently-selected environment (if present)
    const currentEnv = currentSession?.session.environment ?? currentRun?.run.environment;
    const runCandidates = (runs ?? []).filter((r) => r.run.project === project);

    const candidateInSameEnv = currentEnv
      ? runCandidates.filter((r) => r.run.environment === currentEnv)
      : [];

    const pickLatest = (arr: typeof runCandidates) => {
      return arr
        .slice()
        .sort((a, b) => (Date.parse(b.run.timestamp) || 0) - (Date.parse(a.run.timestamp) || 0))[0];
    };

    const chosen = pickLatest(candidateInSameEnv.length > 0 ? candidateInSameEnv : runCandidates);
    if (chosen) {
      selectRun(chosen.run.runId);
      return;
    }

    // Fallback: if we have hierarchy but no loaded data, try latestSession/latestRun
    const proj = (projectHierarchy ?? []).find((p) => p.name === project);
    const latestSession = proj?.environments
      ?.map((e) => e.latestSession)
      .filter(Boolean)[0];
    if (latestSession && (sessions ?? []).some((s) => s.session.sessionId === latestSession.session.sessionId)) {
      selectSession(latestSession.session.sessionId);
      return;
    }

    const latestFromHierarchy = proj?.environments
      ?.map((e) => e.latestRun)
      .filter(Boolean)
      .sort((a, b) => (Date.parse(b!.run.timestamp) || 0) - (Date.parse(a!.run.timestamp) || 0))[0];

    const runId = latestFromHierarchy?.run.runId;
    if (runId && (runs ?? []).some((r) => r.run.runId === runId)) {
      selectRun(runId);
      return;
    }

    // Bug 4 fix: No local data found — fetch from server
    const env = proj?.environments?.[0]?.name || 'local';
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/sessions?project=${encodeURIComponent(project)}&environment=${encodeURIComponent(env)}`,
        { cache: 'no-store' }
      );
      if (response.ok) {
        const payload = await response.json();
        const sessionsList = payload.sessions || [];
        if (sessionsList.length > 0) {
          const sessionId = sessionsList[0].sessionId;
          if (sessionId) {
            const sessionResponse = await fetch(
              `${getApiBaseUrl()}/api/v1/sessions/${sessionId}`,
              { cache: 'no-store' }
            );
            if (sessionResponse.ok) {
              const fullSessionData = (await sessionResponse.json()) as SessionV1;
              const fullSession = makeSessionState(fullSessionData);
              addSession(fullSession);
              selectSession(fullSession.session.sessionId);
              return;
            }
          }
        }
      }
    } catch (e) {
      console.debug('Failed to fetch session for project:', e);
    }
  }, [addSession, currentRun?.run.environment, currentSession?.session.environment, projectHierarchy, runs, sessions, selectRun, selectSession]);

  const selectEnvironment = React.useCallback((environment: string) => {
    if (!environment || !currentProject) return;

    // Prefer: latest session for this project+environment
    const sessionCandidates = (sessions ?? []).filter(
      (s) => s.session.project === currentProject && s.session.environment === environment
    );

    if (sessionCandidates.length > 0) {
      const chosen = sessionCandidates
        .slice()
        .sort((a, b) => (Date.parse(b.session.timestamp) || 0) - (Date.parse(a.session.timestamp) || 0))[0];
      selectSession(chosen.session.sessionId);
      return;
    }

    // Fallback: latest run for this project+environment
    const runCandidates = (runs ?? []).filter(
      (r) => r.run.project === currentProject && r.run.environment === environment
    );

    const chosen = runCandidates
      .slice()
      .sort((a, b) => (Date.parse(b.run.timestamp) || 0) - (Date.parse(a.run.timestamp) || 0))[0];

    if (chosen) {
      selectRun(chosen.run.runId);
    }
  }, [currentProject, runs, sessions, selectRun, selectSession]);

  const runsForDropdown = React.useMemo(() => {
    // Phase 1: Keep it simple - just show "Latest" which represents the session aggregate
    // Individual run history will come in Phase 2
    return (runs ?? [])
      .filter((r) => r.run.project === currentProject && r.run.environment === currentEnvironment)
      .slice()
      .sort((a, b) => (Date.parse(b.run.timestamp) || 0) - (Date.parse(a.run.timestamp) || 0));
  }, [currentEnvironment, currentProject, runs]);

  // In Phase 1: "Latest" is either the latest session or the latest run
  const latestSessionId = React.useMemo(() => {
    const sessionCandidates = (sessions ?? []).filter(
      (s) => s.session.project === currentProject && s.session.environment === currentEnvironment
    );
    if (sessionCandidates.length === 0) return null;
    return sessionCandidates
      .slice()
      .sort((a, b) => (Date.parse(b.session.timestamp) || 0) - (Date.parse(a.session.timestamp) || 0))[0]
      ?.session.sessionId;
  }, [currentEnvironment, currentProject, sessions]);

  const latestRunId = runsForDropdown[0]?.run.runId;

  const currentRunLabel = React.useMemo(() => {
    // If we're viewing a session and it's the latest, show "Latest"
    if (latestSessionId && currentSession?.session.sessionId === latestSessionId) return 'Latest';
    // If we're viewing a run and it's the latest (and no session), show "Latest"
    if (!latestSessionId && latestRunId && currentRun?.run.runId === latestRunId) return 'Latest';
    // Otherwise show timestamp
    return currentSession?.session.timestamp ?? currentRun?.run.timestamp ?? '—';
  }, [currentRun?.run.runId, currentRun?.run.timestamp, currentSession?.session.sessionId, currentSession?.session.timestamp, latestRunId, latestSessionId]);

  const documents = currentSession?.session.documents ?? currentRun?.run.documents ?? [];
  const navTree = React.useMemo(() => buildGroupedNavTree(documents), [documents]);

  const navTreeForSidebar = React.useMemo(() => {
    // The nav-tree builder always returns a synthetic Root group (group:/) so
    // root-level documents (no path segments) still have a place to live.
    // For the Explorer-like sidebar UX:
    // - hide Root when it has no direct containers
    // - otherwise keep Root visible while also showing descendants at the same level
    //   (no mandatory expand).
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
        <div
          role="button"
          tabIndex={0}
          className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => navigate('summary')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('summary');
            }
          }}
        >
          <div className="text-sm font-bold tracking-tight">LiveDoc</div>
          <div className="mt-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Project</span>
              {projectNames.length > 0 ? (
                <DropdownMenu open={projectMenuOpen} onOpenChange={setProjectMenuOpen}>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select project"
                    >
                      {currentProject}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {projectNames.map((name) => (
                      <DropdownMenuItem
                        key={name}
                        onSelect={() => {
                          selectProject(name);
                          setProjectMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          name === currentProject && "bg-muted"
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
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Environment</span>
              {environmentNames.length > 0 ? (
                <DropdownMenu open={envMenuOpen} onOpenChange={setEnvMenuOpen}>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select environment"
                    >
                      {currentEnvironment}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
              {(runsForDropdown.length > 0 || latestSessionId) ? (
                <DropdownMenu open={runMenuOpen} onOpenChange={setRunMenuOpen}>
                  <DropdownMenuTrigger
                    asChild
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <button
                      type="button"
                      className="text-xs font-medium hover:text-foreground transition-colors"
                      aria-label="Select run"
                    >
                      {currentRunLabel}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    {latestSessionId && (
                      <DropdownMenuItem
                        onSelect={() => {
                          selectSession(latestSessionId);
                          setRunMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          latestSessionId === currentSession?.session.sessionId && "bg-muted"
                        )}
                      >
                        Latest
                      </DropdownMenuItem>
                    )}
                    {!latestSessionId && latestRunId && (
                      <DropdownMenuItem
                        onSelect={() => {
                          selectRun(latestRunId);
                          setRunMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          latestRunId === currentRun?.run.runId && "bg-muted"
                        )}
                      >
                        Latest
                      </DropdownMenuItem>
                    )}
                    {runsForDropdown.map((r) => (
                      <DropdownMenuItem
                        key={r.run.runId}
                        onSelect={() => {
                          selectRun(r.run.runId);
                          setRunMenuOpen(false);
                        }}
                        className={cn(
                          "text-xs",
                          r.run.runId === currentRun?.run.runId && "bg-muted"
                        )}
                      >
                        {r.run.timestamp}
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
                {(currentSession?.session.status === 'running' || currentRun?.run.status === 'running') && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
                {(currentSession?.session.status || currentRun?.run.status) ? (
                  <StatusBadge status={(currentSession?.session.status ?? currentRun?.run.status) as any} size="xs" />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
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
