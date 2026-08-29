import { create } from 'zustand';
import type { AnyTest, CoverageReport, ExecutionResult, RunType, Statistics, Status, TestCase, TestRunV1 } from '@swedevtools/livedoc-schema';
import {
  buildLogicalRunGroups,
  DEFAULT_PROJECT_GROUPING_WINDOW_MS,
  findContainingGroup,
  type LogicalRunGroup,
  type ProjectGroupingSettings,
} from './lib/run-grouping';

export const PROJECT_GROUPING_ENABLED_KEY = 'livedoc.viewer.projectGrouping.enabled';
export const PROJECT_GROUPING_HIDE_SOURCE_PROJECTS_KEY = 'livedoc.viewer.projectGrouping.hideSourceProjects';
export const PROJECT_GROUPING_ONBOARDING_SEEN_KEY = 'livedoc.viewer.projectGrouping.onboarding.seen';
export const FOLLOW_LATEST_RUN_KEY = 'livedoc.viewer.runs.followLatest';

function getInitialAudienceMode(): 'business' | 'developer' {
  try {
    const stored = localStorage.getItem('livedoc.viewer.audienceMode');
    if (stored === 'business' || stored === 'developer') return stored;
  } catch {
    // ignore (e.g. storage unavailable)
  }
  return 'business';
}

function getInitialProjectGroupingSettings(): ProjectGroupingSettings {
  let enabled = false;
  let hideSourceProjects = true;

  try {
    const stored = localStorage.getItem(PROJECT_GROUPING_ENABLED_KEY);
    if (stored === 'true') enabled = true;
    if (stored === 'false') enabled = false;

    const storedHide = localStorage.getItem(PROJECT_GROUPING_HIDE_SOURCE_PROJECTS_KEY);
    if (storedHide === 'true') hideSourceProjects = true;
    if (storedHide === 'false') hideSourceProjects = false;
  } catch {
    // ignore (e.g. storage unavailable)
  }

  return { enabled, hideSourceProjects, windowMs: DEFAULT_PROJECT_GROUPING_WINDOW_MS };
}

function getInitialFollowLatestRun(): boolean {
  try {
    return localStorage.getItem(FOLLOW_LATEST_RUN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function hasSeenProjectGroupingOnboarding(): boolean {
  try {
    return localStorage.getItem(PROJECT_GROUPING_ONBOARDING_SEEN_KEY) === 'true';
  } catch {
    return true;
  }
}

export function hasProjectGroupingPreference(): boolean {
  try {
    return localStorage.getItem(PROJECT_GROUPING_ENABLED_KEY) !== null;
  } catch {
    return true;
  }
}

export function markProjectGroupingOnboardingSeen(): void {
  try {
    localStorage.setItem(PROJECT_GROUPING_ONBOARDING_SEEN_KEY, 'true');
  } catch {
    // ignore (e.g. storage unavailable)
  }
}

export interface Run {
  run: TestRunV1;
  /** Index for fast lookup by id (TestCase/Test/Step/etc) */
  itemById: Record<string, TestCase | AnyTest>;
}

export interface RunGroup extends Run {
  group: LogicalRunGroup;
}

export type RunView = Run | RunGroup;

/** Which projection of a run is currently selected for display. Full runs have physical === combined. */
export type RunProjection = 'combined' | 'physical';

/** Helper to extract run-like data from ViewData for components that need it */
export interface RunLike {
  run: {
    documents?: TestCase[];
    summary: Statistics;
    status: Status;
    timestamp: string;
    duration: number;
    project: string;
    environment: string;
    framework?: string;
    coverage?: CoverageReport;
    runType?: RunType;
    baselineRunId?: string;
    sourceRuns?: Array<{ runId: string; project: string; timestamp: string; duration: number; summary: Statistics; status: Status; framework: string; documentCount: number; coverage?: CoverageReport }>;
  };
  itemById: Record<string, TestCase | AnyTest>;
}

// Project hierarchy for navigation
export interface HistoryRun {
  runId: string;
  timestamp: string;
  status: Status;
  summary: Statistics;
  /** Missing/undefined means 'full' — history predates partial run support. */
  runType?: RunType;
  baselineRunId?: string;
}

export interface Environment {
  name: string;
  latestRun?: Run;
  historyCount: number;
  history: HistoryRun[];
}

export interface ProjectNode {
  name: string;
  environments: Environment[];
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
export type ViewMode = 'tree' | 'list';
export type Theme = 'dark' | 'light';
export type AudienceMode = 'business' | 'developer';

export interface DataDiagnostic {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  filePath?: string;
  project?: string;
  environment?: string;
  details?: string[];
  /** Run this diagnostic is scoped to, so it can be cleared once that run's projection loads successfully. */
  runId?: string;
}

export interface UnresolvedDeepLink {
  hash: string;
  attemptedAt: number;
}

// Navigation view types
export type ViewType = 'summary' | 'node' | 'group' | 'coverage';

export interface CurrentView {
  type: ViewType;
  id?: string;
}

interface AppState {
  // Data
  runs: Run[];
  /** Physical-projection cache, keyed by runId. Never fed into grouping/logical-run inputs. */
  physicalRuns: Record<string, Run>;
  projectHierarchy: ProjectNode[];

  // Selection
  selectedRunId: string | null;
  selectedRunGroupId: string | null;
  selectedNodeId: string | null;
  /** Which projection of the selected run to display. Irrelevant for full runs (physical === combined). */
  selectedRunView: RunProjection;
  /** Projection key currently being lazily fetched (`runId:view`), if any. */
  pendingRunFetch: string | null;

  // Navigation
  currentView: CurrentView;
  unresolvedDeepLink: UnresolvedDeepLink | null;

  // UI State
  connectionStatus: ConnectionStatus;
  diagnostics: DataDiagnostic[];
  viewMode: ViewMode;
  theme: Theme;
  audienceMode: AudienceMode;
  projectGrouping: ProjectGroupingSettings;
  followLatestRun: boolean;
  sidebarWidth: number;
  expandedItems: Set<string>;

  // Filter (shared across nav + panes)
  filterText: string;
  filterTags: string[];

  // Actions
  setRuns: (runs: Run[]) => void;
  addRun: (run: Run) => void;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  removeRun: (runId: string) => void;

  /** Upsert the physical projection cache for a runId (active partial progress or lazily fetched history). */
  upsertPhysicalRun: (runId: string, run: Run) => void;
  removePhysicalRun: (runId: string) => void;

  setProjectHierarchy: (hierarchy: ProjectNode[]) => void;
  setDiagnostics: (diagnostics: DataDiagnostic[]) => void;
  addDiagnostic: (diagnostic: DataDiagnostic) => void;
  clearRunDiagnostics: (runId: string) => void;

  selectRun: (runId: string | null, view?: RunProjection) => void;
  selectRunGroup: (groupId: string | null) => void;
  /** Toggle projection (Combined | This partial) for the currently selected run without resetting navigation. */
  setRunView: (view: RunProjection) => void;
  setPendingRunFetch: (runId: string | null) => void;

  // Navigation actions
  navigate: (type: ViewType, id?: string) => void;
  setUnresolvedDeepLink: (hash: string) => void;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleTheme: () => void;
  setAudienceMode: (mode: AudienceMode) => void;
  toggleAudienceMode: () => void;
  setProjectGroupingEnabled: (enabled: boolean) => void;
  setProjectGroupingHideSourceProjects: (hidden: boolean) => void;
  setFollowLatestRun: (enabled: boolean) => void;
  followRunIfEnabled: (runId: string, view?: RunProjection) => void;
  setSidebarWidth: (width: number) => void;
  toggleExpanded: (itemId: string) => void;

  setFilterText: (text: string) => void;
  setFilterTags: (tags: string[]) => void;

  // Real-time updates
  upsertTestCase: (runId: string, testCase: TestCase) => void;
  upsertTest: (runId: string, testCaseId: string, test: AnyTest) => void;
  patchTestExecution: (runId: string, testId: string, patch: { execution: Partial<ExecutionResult> }) => void;
  upsertOutlineExampleResults: (runId: string, outlineId: string, results: Array<{ testId: string; result: ExecutionResult }>) => void;
  attachCoverage: (runId: string, coverage: CoverageReport) => void;

  // Computed selectors
  getRunGroups: () => RunGroup[];
  getDetectedRunGroups: () => RunGroup[];
  getCurrentRun: () => RunView | undefined;
  getCurrentRunGroup: () => RunGroup | undefined;
  /** Returns either the current logical group or current run (group takes priority) */
  getCurrentView: () => { type: 'grouped-run'; data: RunGroup } | { type: 'run'; data: Run } | undefined;
  /** Returns a RunLike object (normalized view) for components */
  getCurrentViewData: () => RunLike | undefined;
  getCurrentNode: () => TestCase | AnyTest | undefined;
}

function buildItemIndex(run: TestRunV1): Record<string, TestCase | AnyTest> {
  const itemById: Record<string, TestCase | AnyTest> = {};

  const addTest = (test: AnyTest) => {
    itemById[test.id] = test;

    if (String((test as any)?.kind) === 'Scenario' && Array.isArray((test as any).steps)) {
      for (const step of (test as any).steps as AnyTest[]) addTest(step);
    }

    const kind = String((test as any)?.kind);
    if ((kind === 'ScenarioOutline' || kind === 'RuleOutline') && Array.isArray((test as any).steps)) {
      for (const step of (test as any).steps as AnyTest[]) addTest(step);
    }
  };

  for (const doc of run.documents ?? []) {
    itemById[doc.id] = doc;
    if (doc.background) addTest(doc.background);
    for (const t of doc.tests ?? []) addTest(t);
  }

  return itemById;
}

export function makeRunState(run: TestRunV1): Run {
  return { run, itemById: buildItemIndex(run) };
}

export function makeRunGroupState(group: LogicalRunGroup): RunGroup {
  return { group, run: group.run, itemById: buildItemIndex(group.run) };
}

function mergeExecution(existing: ExecutionResult, patch: Partial<ExecutionResult>): ExecutionResult {
  const out: any = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) {
      delete out[k];
      continue;
    }
    out[k] = v;
  }
  return out as ExecutionResult;
}

function findTestCaseOwnerId(run: TestRunV1, itemId: string): string | undefined {
  for (const doc of run.documents ?? []) {
    if (doc.id === itemId) return doc.id;

    const stack: AnyTest[] = [];
    if (doc.background) stack.push(doc.background);
    stack.push(...(doc.tests ?? []));

    while (stack.length > 0) {
      const t = stack.pop();
      if (!t) continue;
      if (t.id === itemId) return doc.id;

      if (String((t as any)?.kind) === 'Scenario' && Array.isArray((t as any).steps)) {
        stack.push(...((t as any).steps as AnyTest[]));
      }

      const kind = String((t as any)?.kind);
      if ((kind === 'ScenarioOutline' || kind === 'RuleOutline') && Array.isArray((t as any).steps)) {
        stack.push(...((t as any).steps as AnyTest[]));
      }
    }
  }
  return undefined;
}

function replaceTestInTestCase(testCase: TestCase, test: AnyTest): TestCase {
  const existing = testCase.tests ?? [];
  const replaced = existing.map((t) => (t.id === test.id ? test : t));
  if (!replaced.some((t) => t.id === test.id)) replaced.push(test);
  return { ...testCase, tests: replaced };
}

function patchAnyTestExecution(test: AnyTest, testId: string, patch: Partial<ExecutionResult>): AnyTest {
  if (test.id === testId) {
    const existingExecution = (test as any).execution as ExecutionResult | undefined;
    const base: ExecutionResult = existingExecution ?? { status: 'pending', duration: 0 };
    return { ...(test as any), execution: mergeExecution(base, patch) } as AnyTest;
  }

  if (String((test as any)?.kind) === 'Scenario' && Array.isArray((test as any).steps)) {
    return { ...(test as any), steps: ((test as any).steps as AnyTest[]).map((s) => patchAnyTestExecution(s, testId, patch)) } as AnyTest;
  }

  const kind = String((test as any)?.kind);
  if ((kind === 'ScenarioOutline' || kind === 'RuleOutline') && Array.isArray((test as any).steps)) {
    return { ...(test as any), steps: ((test as any).steps as AnyTest[]).map((s) => patchAnyTestExecution(s, testId, patch)) } as AnyTest;
  }

  return test;
}

function patchOutlineExampleResults(test: AnyTest, outlineId: string, results: Array<{ testId: string; result: ExecutionResult }>): AnyTest {
  if (test.id === outlineId) {
    return { ...(test as any), exampleResults: results } as AnyTest;
  }

  if (String((test as any)?.kind) === 'Scenario' && Array.isArray((test as any).steps)) {
    return { ...(test as any), steps: ((test as any).steps as AnyTest[]).map((s) => patchOutlineExampleResults(s, outlineId, results)) } as AnyTest;
  }

  const kind = String((test as any)?.kind);
  if ((kind === 'ScenarioOutline' || kind === 'RuleOutline') && Array.isArray((test as any).steps)) {
    return { ...(test as any), steps: ((test as any).steps as AnyTest[]).map((s) => patchOutlineExampleResults(s, outlineId, results)) } as AnyTest;
  }

  return test;
}

function emptyStatistics(): Statistics {
  return { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
}

function summarizeRun(run: TestRunV1): Statistics {
  const summary = emptyStatistics();

  const addStatus = (status: Status) => {
    summary.total += 1;
    if (status === 'passed') summary.passed += 1;
    else if (status === 'failed' || status === 'timedOut') summary.failed += 1;
    else if (status === 'skipped' || status === 'cancelled') summary.skipped += 1;
    else summary.pending += 1;
  };

  for (const doc of run.documents ?? []) {
    const stats = (doc as any).statistics as Statistics | undefined;
    if (stats) {
      summary.total += Number(stats.total) || 0;
      summary.passed += Number(stats.passed) || 0;
      summary.failed += Number(stats.failed) || 0;
      summary.pending += Number(stats.pending) || 0;
      summary.skipped += Number(stats.skipped) || 0;
      continue;
    }

    for (const test of doc.tests ?? []) {
      addStatus(((test as any)?.execution?.status ?? 'pending') as Status);
    }
  }

  return summary;
}

function withDerivedRunState(run: TestRunV1): TestRunV1 {
  const summary = summarizeRun(run);
  const isTerminal = run.status === 'passed' || run.status === 'failed' || run.status === 'cancelled' || run.status === 'timedOut';

  if (isTerminal) {
    return { ...run, summary, status: run.status };
  }

  // Test outcomes do not end an invocation. Preserve an explicit running
  // lifecycle status until run:v1:completed supplies the terminal status.
  const derivedStatus: Status =
    run.status === 'running'
      ? 'running'
      : summary.pending > 0 || summary.total > 0
        ? 'running'
        : 'pending';

  return { ...run, summary, status: derivedStatus };
}

function sortRunsNewestFirst(runs: Run[]): Run[] {
  return runs.slice().sort((a, b) => (Date.parse(b.run.timestamp) || 0) - (Date.parse(a.run.timestamp) || 0));
}

function latestRunFromGroup(group: RunGroup): TestRunV1 | undefined {
  return group.group.runs
    .slice()
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))[0];
}

/**
 * Applies a real-time TestRunV1 mutation to whichever collection currently holds `runId`:
 * the combined `runs` cache (full runs, and previously-combined partials) or the `physicalRuns`
 * cache (active partials still in progress). Never creates a new entry — the run must already
 * be tracked via addRun/upsertPhysicalRun (e.g. from run:v1:started).
 */
function applyRunMutation(
  state: Pick<AppState, 'runs' | 'physicalRuns'>,
  runId: string,
  updater: (run: TestRunV1) => TestRunV1
): Partial<AppState> | null {
  const physical = state.physicalRuns[runId];
  if (physical?.run.runType === 'partial') {
    const nextRun = withDerivedRunState(updater(physical.run));
    return { physicalRuns: { ...state.physicalRuns, [runId]: makeRunState(nextRun) } };
  }

  const runIndex = state.runs.findIndex((r) => r.run.runId === runId);
  if (runIndex !== -1) {
    const nextRun = withDerivedRunState(updater(state.runs[runIndex]!.run));
    const newRuns = [...state.runs];
    newRuns[runIndex] = makeRunState(nextRun);
    const cachedPhysical = state.physicalRuns[runId];
    if (!cachedPhysical) return { runs: newRuns };

    return {
      runs: newRuns,
      physicalRuns: {
        ...state.physicalRuns,
        [runId]: makeRunState(withDerivedRunState(updater(cachedPhysical.run))),
      },
    };
  }

  if (physical) {
    const nextRun = withDerivedRunState(updater(physical.run));
    return { physicalRuns: { ...state.physicalRuns, [runId]: makeRunState(nextRun) } };
  }

  return null;
}

/**
 * Resolves the plain (non-grouped) selected run using the requested projection.
 * - `combined` prefers `runs`, falling back to `physicalRuns` (e.g. an active partial with no
 *   combined snapshot yet).
 * - `physical` prefers `physicalRuns`, falling back to `runs` (e.g. a full run, where
 *   physical === combined and only `runs` ever holds it).
 * Grouping never sees `physicalRuns` — this helper is only used for the ungrouped selection path.
 */
function resolveSelectedRun(
  state: Pick<AppState, 'selectedRunId' | 'selectedRunView' | 'runs' | 'physicalRuns'>
): Run | undefined {
  if (!state.selectedRunId) return undefined;

  const combined = state.runs.find((r) => r.run.runId === state.selectedRunId);
  const physical = state.physicalRuns[state.selectedRunId];

  if (state.selectedRunView === 'physical') return physical ?? combined;
  if (combined) return combined;
  return physical?.run.status === 'running' ? physical : undefined;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  runs: [],
  physicalRuns: {},
  projectHierarchy: [],
  selectedRunId: null,
  selectedRunGroupId: null,
  selectedNodeId: null,
  selectedRunView: 'combined',
  pendingRunFetch: null,
  currentView: { type: 'summary' },
  unresolvedDeepLink: null,
  connectionStatus: 'connecting',
  diagnostics: [],
  viewMode: 'tree',
  theme: 'dark',
  audienceMode: getInitialAudienceMode(),
  projectGrouping: getInitialProjectGroupingSettings(),
  followLatestRun: getInitialFollowLatestRun(),
  sidebarWidth: 280,
  expandedItems: new Set<string>(),

  filterText: '',
  filterTags: [],

  // Data actions
  setRuns: (runs) => set({ runs: sortRunsNewestFirst(runs) }),

  addRun: (run) => set((state) => {
    const idx = state.runs.findIndex((r) => r.run.runId === run.run.runId);
    if (idx >= 0) {
      // Upsert: replace existing run data
      const newRuns = [...state.runs];
      newRuns[idx] = run;
      return { runs: sortRunsNewestFirst(newRuns) };
    }
    return {
      runs: sortRunsNewestFirst([run, ...state.runs]),
      // Auto-select if first run and no grouped run selected
      selectedRunId: (!state.selectedRunGroupId && !state.selectedRunId) ? run.run.runId : state.selectedRunId,
    };
  }),

  updateRun: (runId, updates) => set((state) => ({
    runs: state.runs.map((r) =>
      r.run.runId === runId
        ? (
            updates.run
              ? { ...r, ...updates, itemById: buildItemIndex(updates.run as TestRunV1) }
              : { ...r, ...updates }
          )
        : r
    ),
  })),

  removeRun: (runId) => set((state) => {
    const newRuns = state.runs.filter(r => r.run.runId !== runId);
    // If we removed the selected run, select another raw run if available.
    let newSelectedRunId = state.selectedRunId;
    if (state.selectedRunId === runId) {
      newSelectedRunId = newRuns.length > 0 && !state.selectedRunGroupId ? newRuns[0].run.runId : null;
    }
    // Clean up expandedItems for the removed run to prevent memory leak
    const removedRun = state.runs.find(r => r.run.runId === runId);
    let newExpandedItems = state.expandedItems;
    if (removedRun) {
      const idsToRemove = new Set(Object.keys(removedRun.itemById));
      if (idsToRemove.size > 0) {
        newExpandedItems = new Set([...state.expandedItems].filter(id => !idsToRemove.has(id)));
      }
    }
    const newPhysicalRuns = state.physicalRuns[runId]
      ? Object.fromEntries(Object.entries(state.physicalRuns).filter(([id]) => id !== runId))
      : state.physicalRuns;
    return {
      runs: newRuns,
      physicalRuns: newPhysicalRuns,
      selectedRunId: newSelectedRunId,
      selectedRunView: newSelectedRunId === state.selectedRunId ? state.selectedRunView : 'combined',
      currentView: (newSelectedRunId || state.selectedRunGroupId) ? state.currentView : { type: 'summary' },
      expandedItems: newExpandedItems,
    };
  }),

  upsertPhysicalRun: (runId, run) => set((state) => ({
    physicalRuns: { ...state.physicalRuns, [runId]: run },
  })),

  removePhysicalRun: (runId) => set((state) => {
    if (!state.physicalRuns[runId]) return state;
    const newPhysicalRuns = { ...state.physicalRuns };
    delete newPhysicalRuns[runId];
    return { physicalRuns: newPhysicalRuns };
  }),

  setProjectHierarchy: (hierarchy) => set({ projectHierarchy: hierarchy }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),

  addDiagnostic: (diagnostic) => set((state) => ({
    diagnostics: [
      ...state.diagnostics.filter((d) => !(d.code === diagnostic.code && d.runId === diagnostic.runId)),
      diagnostic,
    ],
  })),

  clearRunDiagnostics: (runId) => set((state) => ({
    diagnostics: state.diagnostics.filter((d) => d.runId !== runId),
  })),

  // Selection actions
  selectRun: (runId, view = 'combined') => set({
    selectedRunId: runId,
    selectedRunGroupId: null,
    selectedNodeId: null,
    currentView: { type: 'summary' },
    unresolvedDeepLink: null,
    selectedRunView: runId ? view : 'combined',
  }),

  setRunView: (view) => set({ selectedRunView: view }),
  setPendingRunFetch: (runId) => set({ pendingRunFetch: runId }),

  selectRunGroup: (groupId) => set({
    selectedRunGroupId: groupId,
    selectedRunId: null,
    selectedNodeId: null,
    currentView: { type: 'summary' },
    unresolvedDeepLink: null,
    selectedRunView: 'combined',
  }),

  // Navigation actions
  navigate: (type, id) => set({
    currentView: { type, id },
    selectedNodeId: type === 'node' ? (id ?? null) : null,
    unresolvedDeepLink: null,
  }),

  setUnresolvedDeepLink: (hash) => set({
    currentView: { type: 'summary' },
    selectedNodeId: null,
    unresolvedDeepLink: {
      hash,
      attemptedAt: Date.now(),
    },
  }),

  // UI actions
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    // Apply theme to document
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    return { theme: newTheme };
  }),
  setAudienceMode: (mode) => {
    try {
      localStorage.setItem('livedoc.viewer.audienceMode', mode);
    } catch {
      // ignore (e.g. storage unavailable)
    }
    set({ audienceMode: mode });
  },
  toggleAudienceMode: () => set((state) => {
    const next = state.audienceMode === 'business' ? 'developer' : 'business';
    try {
      localStorage.setItem('livedoc.viewer.audienceMode', next);
    } catch {
      // ignore
    }
    return { audienceMode: next };
  }),
  setProjectGroupingEnabled: (enabled) => set((state) => {
    try {
      localStorage.setItem(PROJECT_GROUPING_ENABLED_KEY, String(enabled));
    } catch {
      // ignore
    }

    const nextSettings = { ...state.projectGrouping, enabled };

    if (enabled && state.selectedRunId) {
      const groups = buildLogicalRunGroups(
        state.runs.map((run) => run.run),
        nextSettings
      );
      const containingGroup = findContainingGroup(groups, state.selectedRunId);
      if (containingGroup) {
        return {
          projectGrouping: nextSettings,
          selectedRunGroupId: containingGroup.id,
          selectedRunId: null,
          selectedNodeId: null,
          currentView: { type: 'summary' as const },
        };
      }
    }

    if (!enabled && state.selectedRunGroupId) {
      const groups = buildLogicalRunGroups(
        state.runs.map((run) => run.run),
        state.projectGrouping
      ).map(makeRunGroupState);
      const selectedGroup = groups.find((group) => group.group.id === state.selectedRunGroupId);
      const latest = selectedGroup ? latestRunFromGroup(selectedGroup) : undefined;
      return {
        projectGrouping: nextSettings,
        selectedRunGroupId: null,
        selectedRunId: latest?.runId ?? state.runs[0]?.run.runId ?? null,
        selectedNodeId: null,
        currentView: { type: 'summary' as const },
      };
    }

    return { projectGrouping: nextSettings };
  }),
  setProjectGroupingHideSourceProjects: (hidden) => {
    try {
      localStorage.setItem(PROJECT_GROUPING_HIDE_SOURCE_PROJECTS_KEY, String(hidden));
    } catch {
      // ignore
    }

    set((state) => ({
      projectGrouping: { ...state.projectGrouping, hideSourceProjects: hidden },
    }));
  },
  setFollowLatestRun: (enabled) => {
    try {
      localStorage.setItem(FOLLOW_LATEST_RUN_KEY, String(enabled));
    } catch {
      // ignore (e.g. storage unavailable)
    }
    set({ followLatestRun: enabled });
  },
  followRunIfEnabled: (runId, view = 'combined') => {
    const state = get();
    if (!state.followLatestRun) return;

    if (state.projectGrouping.enabled) {
      const containingGroup = findContainingGroup(
        buildLogicalRunGroups(state.runs.map((run) => run.run), state.projectGrouping),
        runId
      );
      if (containingGroup) {
        state.selectRunGroup(containingGroup.id);
        return;
      }
    }

    state.selectRun(runId, view);
  },
  setSidebarWidth: (width) => set({ sidebarWidth: width }),

  toggleExpanded: (itemId) => set((state) => {
    const newExpanded = new Set(state.expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    return { expandedItems: newExpanded };
  }),

  setFilterText: (text) => set({ filterText: text }),
  setFilterTags: (tags) => set({ filterTags: tags }),

  // Real-time update handlers — route to whichever collection (runs or physicalRuns) tracks runId.
  upsertTestCase: (runId, testCase) => set((state) => {
    const patch = applyRunMutation(state, runId, (run) => {
      const docs = run.documents ?? [];
      const nextDocs = docs.some((d) => d.id === testCase.id)
        ? docs.map((d) => (d.id === testCase.id ? testCase : d))
        : [...docs, testCase];
      return { ...run, documents: nextDocs };
    });
    return patch ?? state;
  }),

  upsertTest: (runId, testCaseId, test) => set((state) => {
    const patch = applyRunMutation(state, runId, (run) => {
      const nextDocs = (run.documents ?? []).map((d) => (d.id === testCaseId ? replaceTestInTestCase(d, test) : d));
      return { ...run, documents: nextDocs };
    });
    return patch ?? state;
  }),

  patchTestExecution: (runId, testId, patch) => set((state) => {
    const result = applyRunMutation(state, runId, (run) => {
      const ownerId = findTestCaseOwnerId(run, testId);
      if (!ownerId) return run;

      const nextDocs = (run.documents ?? []).map((doc) => {
        if (doc.id !== ownerId) return doc;
        return {
          ...doc,
          background: doc.background ? patchAnyTestExecution(doc.background, testId, patch.execution) : undefined,
          tests: (doc.tests ?? []).map((t) => patchAnyTestExecution(t, testId, patch.execution)),
        };
      });

      return { ...run, documents: nextDocs };
    });
    return result ?? state;
  }),

  upsertOutlineExampleResults: (runId, outlineId, results) => set((state) => {
    const patch = applyRunMutation(state, runId, (run) => {
      const ownerId = findTestCaseOwnerId(run, outlineId);
      if (!ownerId) return run;

      const nextDocs = (run.documents ?? []).map((doc) => {
        if (doc.id !== ownerId) return doc;
        return {
          ...doc,
          background: doc.background ? patchOutlineExampleResults(doc.background, outlineId, results) : undefined,
          tests: (doc.tests ?? []).map((t) => patchOutlineExampleResults(t, outlineId, results)),
        };
      });

      return { ...run, documents: nextDocs };
    });
    return patch ?? state;
  }),

  attachCoverage: (runId, coverage) => set((state) => {
    const physical = state.physicalRuns[runId];
    if (physical?.run.runType === 'partial') {
      const nextRun = { ...physical.run, coverage };
      return {
        physicalRuns: {
          ...state.physicalRuns,
          [runId]: makeRunState(nextRun),
        },
      };
    }

    const runIndex = state.runs.findIndex((r) => r.run.runId === runId);
    if (runIndex === -1) return state;
    if (state.runs[runIndex]?.run.runType === 'partial') return state;

    const existing = state.runs[runIndex];
    const nextRun = { ...existing.run, coverage };
    const newRuns = [...state.runs];
    newRuns[runIndex] = makeRunState(nextRun);
    const cachedPhysical = state.physicalRuns[runId];
    if (!cachedPhysical) return { runs: newRuns };

    return {
      runs: newRuns,
      physicalRuns: {
        ...state.physicalRuns,
        [runId]: makeRunState({ ...cachedPhysical.run, coverage }),
      },
    };
  }),

  // Computed selectors
  getRunGroups: () => {
    const state = get();
    return buildLogicalRunGroups(
      state.runs.map((run) => run.run),
      state.projectGrouping
    ).map(makeRunGroupState);
  },

  getDetectedRunGroups: () => {
    const state = get();
    return buildLogicalRunGroups(
      state.runs.map((run) => run.run),
      { ...state.projectGrouping, enabled: true }
    ).map(makeRunGroupState);
  },

  getCurrentRun: () => {
    const state = get();
    if (state.selectedRunGroupId) {
      const group = state.getRunGroups().find((candidate) => candidate.group.id === state.selectedRunGroupId);
      if (group) return group;
    }

    return resolveSelectedRun(state);
  },

  getCurrentRunGroup: () => {
    const state = get();
    if (!state.selectedRunGroupId) return undefined;
    return state.getRunGroups().find((group) => group.group.id === state.selectedRunGroupId);
  },

  getCurrentView: () => {
    const state = get();
    if (state.selectedRunGroupId) {
      const group = state.getRunGroups().find((candidate) => candidate.group.id === state.selectedRunGroupId);
      if (group) return { type: 'grouped-run' as const, data: group };
    }

    const run = resolveSelectedRun(state);
    if (run) return { type: 'run' as const, data: run };
    return undefined;
  },

  getCurrentViewData: () => {
    const state = get();
    if (state.selectedRunGroupId) {
      const group = state.getRunGroups().find((candidate) => candidate.group.id === state.selectedRunGroupId);
      if (group) return {
        run: {
          documents: group.run.documents,
          summary: group.run.summary,
          status: group.run.status,
          timestamp: group.run.timestamp,
          duration: group.run.duration,
          project: group.run.project,
          environment: group.run.environment,
          framework: group.run.framework,
          sourceRuns: group.group.runs.map((run) => ({
            runId: run.runId,
            project: run.project,
            timestamp: run.timestamp,
            duration: run.duration,
            summary: run.summary,
            status: run.status,
            framework: run.framework,
            documentCount: run.documents.length,
            coverage: run.coverage,
          })),
        },
        itemById: group.itemById,
      };
    }

    const run = resolveSelectedRun(state);
    if (run) {
      return {
        run: {
          documents: run.run.documents,
          summary: run.run.summary,
          status: run.run.status,
          timestamp: run.run.timestamp,
          duration: run.run.duration,
          project: run.run.project,
          environment: run.run.environment,
          framework: run.run.framework,
          coverage: run.run.coverage,
          runType: run.run.runType,
          baselineRunId: run.run.baselineRunId,
        },
        itemById: run.itemById,
      };
    }
    return undefined;
  },

  getCurrentNode: () => {
    const state = get();
    if (state.selectedRunGroupId) {
      const group = state.getRunGroups().find((candidate) => candidate.group.id === state.selectedRunGroupId);
      if (group && state.selectedNodeId) return group.itemById[state.selectedNodeId];
    }

    const run = resolveSelectedRun(state);
    if (!run || !state.selectedNodeId) return undefined;
    return run.itemById[state.selectedNodeId];
  },
}));
