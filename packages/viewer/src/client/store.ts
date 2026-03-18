import { create } from 'zustand';
import type { AnyTest, ExecutionResult, Statistics, Status, TestCase, TestRunV3 } from '@swedevtools/livedoc-schema';

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
  run: TestRunV3;
  /** Index for fast lookup by id (TestCase/Test/Step/etc) */
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
  projectHierarchy: ProjectNode[];
  
  // Selection
  selectedRunId: string | null;
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
  setProjectHierarchy: (hierarchy: ProjectNode[]) => void;
  
  selectRun: (runId: string | null) => void;
  
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
  getCurrentNode: () => TestCase | AnyTest | undefined;
}

function buildItemIndex(run: TestRunV3): Record<string, TestCase | AnyTest> {
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

export function makeRunState(run: TestRunV3): Run {
  return { run, itemById: buildItemIndex(run) };
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

function findTestCaseOwnerId(run: TestRunV3, itemId: string): string | undefined {
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

function summarizeRun(run: TestRunV3): Statistics {
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

function withDerivedRunState(run: TestRunV3): TestRunV3 {
  const summary = summarizeRun(run);
  const isTerminal = run.status === 'passed' || run.status === 'failed' || run.status === 'cancelled' || run.status === 'timedOut';

  if (isTerminal) {
    return { ...run, summary, status: run.status };
  }

  // Run is still active — never derive 'passed' until run:v3:completed arrives
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
  projectHierarchy: [],
  selectedRunId: null,
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
    // Auto-select if first run
    selectedRunId: state.selectedRunId ?? run.run.runId,
  })),
  
  updateRun: (runId, updates) => set((state) => ({
    runs: state.runs.map((r) =>
      r.run.runId === runId
        ? (
            updates.run
              ? { ...r, ...updates, itemById: buildItemIndex(updates.run as TestRunV3) }
              : { ...r, ...updates }
          )
        : r
    ),
  })),
  
  removeRun: (runId) => set((state) => {
    const newRuns = state.runs.filter(r => r.run.runId !== runId);
    // If we removed the selected run, select another
    let newSelectedRunId = state.selectedRunId;
    if (state.selectedRunId === runId) {
      newSelectedRunId = newRuns.length > 0 ? newRuns[0].run.runId : null;
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
      currentView: newSelectedRunId ? state.currentView : { type: 'summary' },
      expandedItems: newExpandedItems,
    };
  }),
  
  setProjectHierarchy: (hierarchy) => set({ projectHierarchy: hierarchy }),
  
  // Selection actions
  selectRun: (runId) => set({
    selectedRunId: runId,
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
  
  getCurrentNode: () => {
    const state = get();
    const run = state.runs.find((r) => r.run.runId === state.selectedRunId);
    if (!run || !state.selectedNodeId) return undefined;
    return run.itemById[state.selectedNodeId];
  },
}));
