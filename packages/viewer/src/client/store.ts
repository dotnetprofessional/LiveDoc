import { create } from 'zustand';
import type { AnyTest, ExecutionResult, Statistics, Status, TestCase, TestRunV1, SessionV1 } from '@swedevtools/livedoc-schema';

function getInitialAudienceMode(): 'business' | 'developer' {
  try {
    const stored = localStorage.getItem('livedoc.viewer.audienceMode');
    if (stored === 'business' || stored === 'developer') return stored;
  } catch {
    // ignore (e.g. storage unavailable)
  }
  return 'business';
}

export interface Run {
  run: TestRunV1;
  /** Index for fast lookup by id (TestCase/Test/Step/etc) */
  itemById: Record<string, TestCase | AnyTest>;
}

/** Session aggregate - has the same document shape as a Run, so most rendering code can reuse */
export interface Session {
  session: SessionV1;
  /** Index for fast lookup by id (TestCase/Test/Step/etc) */
  itemById: Record<string, TestCase | AnyTest>;
}

/** Common view data type - either a Run or a Session, both expose documents/summary/status */
export type ViewData = Run | Session;

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
  };
  itemById: Record<string, TestCase | AnyTest>;
}

// Project hierarchy for navigation
export interface HistoryRun {
  runId: string;
  timestamp: string;
  status: Status;
  summary: Statistics;
}

export interface Environment {
  name: string;
  latestRun?: Run;
  latestSession?: Session;
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

// Navigation view types
export type ViewType = 'summary' | 'node' | 'group';

export interface CurrentView {
  type: ViewType;
  id?: string;
}

interface AppState {
  // Data
  runs: Run[];
  sessions: Session[];
  projectHierarchy: ProjectNode[];
  
  // Selection
  selectedRunId: string | null;
  selectedSessionId: string | null;
  selectedNodeId: string | null;
  
  // Navigation
  currentView: CurrentView;
  
  // UI State
  connectionStatus: ConnectionStatus;
  viewMode: ViewMode;
  theme: Theme;
  audienceMode: AudienceMode;
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
  
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  
  setProjectHierarchy: (hierarchy: ProjectNode[]) => void;
  
  selectRun: (runId: string | null) => void;
  selectSession: (sessionId: string | null) => void;
  
  // Navigation actions
  navigate: (type: ViewType, id?: string) => void;
  
  setConnectionStatus: (status: ConnectionStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleTheme: () => void;
  setAudienceMode: (mode: AudienceMode) => void;
  toggleAudienceMode: () => void;
  setSidebarWidth: (width: number) => void;
  toggleExpanded: (itemId: string) => void;

  setFilterText: (text: string) => void;
  setFilterTags: (tags: string[]) => void;
  
  // Real-time updates
  upsertTestCase: (runId: string, testCase: TestCase) => void;
  upsertTest: (runId: string, testCaseId: string, test: AnyTest) => void;
  patchTestExecution: (runId: string, testId: string, patch: { execution: Partial<ExecutionResult> }) => void;
  upsertOutlineExampleResults: (runId: string, outlineId: string, results: Array<{ testId: string; result: ExecutionResult }>) => void;
  
  // Computed selectors
  getCurrentRun: () => Run | undefined;
  getCurrentSession: () => Session | undefined;
  /** Returns either the current session or current run (session takes priority) */
  getCurrentView: () => { type: 'session'; data: Session } | { type: 'run'; data: Run } | undefined;
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

export function makeSessionState(session: SessionV1): Session {
  // SessionV1 has the same document shape as TestRunV1, so we can reuse the same index builder
  const fakeRun: TestRunV1 = {
    protocolVersion: '1.0',
    runId: session.sessionId,
    project: session.project,
    environment: session.environment,
    framework: 'vitest',
    timestamp: session.timestamp,
    status: session.status,
    duration: session.duration,
    summary: session.summary,
    documents: session.documents,
  };
  return { session, itemById: buildItemIndex(fakeRun) };
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

  // Run is still active — never derive 'passed' until run:v1:completed arrives
  const derivedStatus: Status =
    summary.failed > 0
      ? 'failed'
      : run.status === 'running'
        ? 'running'
        : summary.pending > 0
          ? 'running'
          : summary.total > 0
            ? 'passed'
            : 'pending';

  return { ...run, summary, status: derivedStatus };
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  runs: [],
  sessions: [],
  projectHierarchy: [],
  selectedRunId: null,
  selectedSessionId: null,
  selectedNodeId: null,
  currentView: { type: 'summary' },
  connectionStatus: 'connecting',
  viewMode: 'tree',
  theme: 'dark',
  audienceMode: getInitialAudienceMode(),
  sidebarWidth: 280,
  expandedItems: new Set<string>(),

  filterText: '',
  filterTags: [],
  
  // Data actions
  setRuns: (runs) => set({ runs }),
  
  addRun: (run) => set((state) => ({
    runs: [run, ...state.runs],
    // Auto-select if first run and no session selected
    selectedRunId: (!state.selectedSessionId && !state.selectedRunId) ? run.run.runId : state.selectedRunId,
  })),
  
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
    // If we removed the selected run, select another (or fall back to session if available)
    let newSelectedRunId = state.selectedRunId;
    if (state.selectedRunId === runId) {
      newSelectedRunId = newRuns.length > 0 && !state.selectedSessionId ? newRuns[0].run.runId : null;
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
    return { 
      runs: newRuns,
      selectedRunId: newSelectedRunId,
      currentView: (newSelectedRunId || state.selectedSessionId) ? state.currentView : { type: 'summary' },
      expandedItems: newExpandedItems,
    };
  }),
  
  setSessions: (sessions) => set({ sessions }),
  
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions],
    // Auto-select session (takes priority over runs)
    selectedSessionId: session.session.sessionId,
    selectedRunId: null,
  })),
  
  updateSession: (sessionId, updates) => set((state) => ({
    sessions: state.sessions.map((s) =>
      s.session.sessionId === sessionId
        ? (
            updates.session
              ? { ...s, ...updates, itemById: buildItemIndex({ ...s.session, ...updates.session } as any) }
              : { ...s, ...updates }
          )
        : s
    ),
  })),
  
  setProjectHierarchy: (hierarchy) => set({ projectHierarchy: hierarchy }),
  
  // Selection actions
  selectRun: (runId) => set({
    selectedRunId: runId,
    selectedSessionId: null,
    selectedNodeId: null,
    currentView: { type: 'summary' },
  }),
  
  selectSession: (sessionId) => set({
    selectedSessionId: sessionId,
    selectedRunId: null,
    selectedNodeId: null,
    currentView: { type: 'summary' },
  }),
  
  // Navigation actions
  navigate: (type, id) => set({
    currentView: { type, id },
    selectedNodeId: type === 'node' ? (id ?? null) : null,
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
  
  // Real-time update handlers
  upsertTestCase: (runId, testCase) => set((state) => {
    const runIndex = state.runs.findIndex((r) => r.run.runId === runId);
    if (runIndex === -1) return state;

    const existing = state.runs[runIndex];
    const docs = existing.run.documents ?? [];
    const nextDocs = docs.some((d) => d.id === testCase.id)
      ? docs.map((d) => (d.id === testCase.id ? testCase : d))
      : [...docs, testCase];

    const nextRun = withDerivedRunState({ ...existing.run, documents: nextDocs });
    const newRuns = [...state.runs];
    newRuns[runIndex] = makeRunState(nextRun);
    return { runs: newRuns };
  }),

  upsertTest: (runId, testCaseId, test) => set((state) => {
    const runIndex = state.runs.findIndex((r) => r.run.runId === runId);
    if (runIndex === -1) return state;

    const existing = state.runs[runIndex];
    const nextDocs = (existing.run.documents ?? []).map((d) => (d.id === testCaseId ? replaceTestInTestCase(d, test) : d));
    const nextRun = withDerivedRunState({ ...existing.run, documents: nextDocs });

    const newRuns = [...state.runs];
    newRuns[runIndex] = makeRunState(nextRun);
    return { runs: newRuns };
  }),

  patchTestExecution: (runId, testId, patch) => set((state) => {
    const runIndex = state.runs.findIndex((r) => r.run.runId === runId);
    if (runIndex === -1) return state;

    const existing = state.runs[runIndex];
    const ownerId = findTestCaseOwnerId(existing.run, testId);
    if (!ownerId) return state;

    const nextDocs = (existing.run.documents ?? []).map((doc) => {
      if (doc.id !== ownerId) return doc;
      return {
        ...doc,
        background: doc.background ? patchAnyTestExecution(doc.background, testId, patch.execution) : undefined,
        tests: (doc.tests ?? []).map((t) => patchAnyTestExecution(t, testId, patch.execution)),
      };
    });

    const nextRun = withDerivedRunState({ ...existing.run, documents: nextDocs });
    const newRuns = [...state.runs];
    newRuns[runIndex] = makeRunState(nextRun);
    return { runs: newRuns };
  }),

  upsertOutlineExampleResults: (runId, outlineId, results) => set((state) => {
    const runIndex = state.runs.findIndex((r) => r.run.runId === runId);
    if (runIndex === -1) return state;

    const existing = state.runs[runIndex];
    const ownerId = findTestCaseOwnerId(existing.run, outlineId);
    if (!ownerId) return state;

    const nextDocs = (existing.run.documents ?? []).map((doc) => {
      if (doc.id !== ownerId) return doc;
      return {
        ...doc,
        background: doc.background ? patchOutlineExampleResults(doc.background, outlineId, results) : undefined,
        tests: (doc.tests ?? []).map((t) => patchOutlineExampleResults(t, outlineId, results)),
      };
    });

    const nextRun = withDerivedRunState({ ...existing.run, documents: nextDocs });
    const newRuns = [...state.runs];
    newRuns[runIndex] = makeRunState(nextRun);
    return { runs: newRuns };
  }),
  
  // Computed selectors
  getCurrentRun: () => {
    const state = get();
    return state.runs.find((r) => r.run.runId === state.selectedRunId);
  },
  
  getCurrentSession: () => {
    const state = get();
    return state.sessions.find((s) => s.session.sessionId === state.selectedSessionId);
  },
  
  getCurrentView: () => {
    const state = get();
    // Session takes priority
    if (state.selectedSessionId) {
      const session = state.sessions.find((s) => s.session.sessionId === state.selectedSessionId);
      if (session) return { type: 'session' as const, data: session };
    }
    // Fall back to run
    if (state.selectedRunId) {
      const run = state.runs.find((r) => r.run.runId === state.selectedRunId);
      if (run) return { type: 'run' as const, data: run };
    }
    return undefined;
  },
  
  getCurrentViewData: () => {
    const state = get();
    // Session takes priority
    if (state.selectedSessionId) {
      const session = state.sessions.find((s) => s.session.sessionId === state.selectedSessionId);
      if (session) {
        return {
          run: {
            documents: session.session.documents,
            summary: session.session.summary,
            status: session.session.status,
            timestamp: session.session.timestamp,
            duration: session.session.duration,
            project: session.session.project,
            environment: session.session.environment,
            framework: 'vitest',
          },
          itemById: session.itemById,
        };
      }
    }
    // Fall back to run
    if (state.selectedRunId) {
      const run = state.runs.find((r) => r.run.runId === state.selectedRunId);
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
          },
          itemById: run.itemById,
        };
      }
    }
    return undefined;
  },
  
  getCurrentNode: () => {
    const state = get();
    // Check session first (takes priority)
    if (state.selectedSessionId) {
      const session = state.sessions.find((s) => s.session.sessionId === state.selectedSessionId);
      if (session && state.selectedNodeId) return session.itemById[state.selectedNodeId];
    }
    // Fall back to run
    const run = state.runs.find((r) => r.run.runId === state.selectedRunId);
    if (!run || !state.selectedNodeId) return undefined;
    return run.itemById[state.selectedNodeId];
  },
}));
