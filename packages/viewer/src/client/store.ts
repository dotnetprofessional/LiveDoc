import { create } from 'zustand';

export type StepType = 'Given' | 'When' | 'Then' | 'And' | 'But';

export interface Step {
  type: StepType;
  title: string;
  description?: string;
  status?: 'pass' | 'fail' | 'skip' | 'pending';
  docString?: string;
  dataTable?: { rows: string[][] };
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    diff?: { expected?: string; actual?: string };
    filename?: string;
  };
}

export interface Scenario {
  id: string;
  title: string;
  description?: string;
  status: 'pass' | 'fail' | 'skip' | 'pending';
  duration?: number;
  steps: Step[];
  tags?: string[];
  type?: string; // 'Scenario', 'ScenarioOutline', 'Background'
  // For ScenarioOutline examples
  outlineId?: string;
  exampleValues?: Record<string, string>;
  exampleIndex?: number;
}

export interface ScenarioOutline {
  id: string;
  title: string;
  description?: string;
  templateSteps: Step[];
  examples: Scenario[];
  tags?: string[];
}

export interface Background {
  id: string;
  title: string;
  description?: string;
  steps: Step[];
}

export interface Feature {
  id: string;
  title: string;
  description?: string;
  filename?: string;
  /** Optional folder/grouping path (relative, no filename) */
  path?: string;
  status: 'pass' | 'fail' | 'skip' | 'pending';
  background?: Background;
  scenarios: Scenario[];
  scenarioOutlines?: ScenarioOutline[];
  tags?: string[];
  duration?: number;
}

export interface Project {
  id: string;
  name: string;
  environment?: string;
  framework?: string;
  features: Feature[];
  timestamp: number;
  status?: 'running' | 'completed' | 'failed' | 'pending';
  duration?: number;
}

export interface Run {
  runId: string;
  project?: string;
  environment?: string;
  framework?: string;
  projects: Project[];
  timestamp: number;
  status?: 'running' | 'completed' | 'failed' | 'pending';
  features?: Feature[];
  summary?: { total: number; passed: number; failed: number; pending: number; duration: number };
  duration?: number;
}

// Project hierarchy for navigation
export interface HistoryRun {
  runId: string;
  timestamp: string;
  status: string;
  summary?: Run['summary'];
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

// Navigation view types
export type ViewType = 'summary' | 'group' | 'feature' | 'scenario' | 'outline';

export interface CurrentView {
  type: ViewType;
  groupName?: string;
  featureId?: string;
  scenarioId?: string;
  outlineId?: string;
}

interface AppState {
  // Data
  runs: Run[];
  projectHierarchy: ProjectNode[];
  
  // Selection
  selectedRunId: string | null;
  selectedProjectId: string | null;
  selectedFeatureId: string | null;
  
  // Navigation
  currentView: CurrentView;
  
  // UI State
  connectionStatus: ConnectionStatus;
  viewMode: ViewMode;
  theme: Theme;
  sidebarWidth: number;
  expandedItems: Set<string>;
  
  // Actions
  setRuns: (runs: Run[]) => void;
  addRun: (run: Run) => void;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  removeRun: (runId: string) => void;
  setProjectHierarchy: (hierarchy: ProjectNode[]) => void;
  
  selectRun: (runId: string | null) => void;
  selectProject: (projectId: string | null) => void;
  selectFeature: (featureId: string | null) => void;
  
  // Navigation actions
  navigate: (type: ViewType, groupName?: string, featureId?: string, scenarioId?: string, outlineId?: string) => void;
  
  setConnectionStatus: (status: ConnectionStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleTheme: () => void;
  setSidebarWidth: (width: number) => void;
  toggleExpanded: (itemId: string) => void;
  
  // Real-time updates
  updateFeature: (projectId: string, feature: Feature) => void;
  updateScenario: (projectId: string, featureId: string, scenario: Scenario) => void;
  
  // Computed selectors
  getCurrentRun: () => Run | undefined;
  getCurrentProject: () => Project | undefined;
  getCurrentFeature: () => Feature | undefined;
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  runs: [],
  projectHierarchy: [],
  selectedRunId: null,
  selectedProjectId: null,
  selectedFeatureId: null,
  currentView: { type: 'summary' },
  connectionStatus: 'connecting',
  viewMode: 'tree',
  theme: 'dark',
  sidebarWidth: 280,
  expandedItems: new Set<string>(),
  
  // Data actions
  setRuns: (runs) => set({ runs }),
  
  addRun: (run) => set((state) => ({
    runs: [run, ...state.runs],
    // Auto-select if first run
    selectedRunId: state.selectedRunId ?? run.runId,
  })),
  
  updateRun: (runId, updates) => set((state) => ({
    runs: state.runs.map((r) =>
      r.runId === runId ? { ...r, ...updates } : r
    ),
  })),
  
  removeRun: (runId) => set((state) => {
    const newRuns = state.runs.filter(r => r.runId !== runId);
    // If we removed the selected run, select another
    let newSelectedRunId = state.selectedRunId;
    if (state.selectedRunId === runId) {
      newSelectedRunId = newRuns.length > 0 ? newRuns[0].runId : null;
    }
    return { 
      runs: newRuns,
      selectedRunId: newSelectedRunId,
      currentView: newSelectedRunId ? state.currentView : { type: 'summary' }
    };
  }),
  
  setProjectHierarchy: (hierarchy) => set({ projectHierarchy: hierarchy }),
  
  // Selection actions
  selectRun: (runId) => set({
    selectedRunId: runId,
    selectedProjectId: null,
    selectedFeatureId: null,
    currentView: { type: 'summary' },
  }),
  
  selectProject: (projectId) => set({
    selectedProjectId: projectId,
    selectedFeatureId: null,
  }),
  
  selectFeature: (featureId) => set({
    selectedFeatureId: featureId,
  }),
  
  // Navigation actions
  navigate: (type, groupName, featureId, scenarioId, outlineId) => set({
    currentView: { type, groupName, featureId, scenarioId, outlineId },
    selectedFeatureId: featureId ?? null,
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
  
  // Real-time update handlers
  updateFeature: (projectId, feature) => set((state) => {
    const run = state.runs.find((r) => r.runId === state.selectedRunId);
    if (!run) return state;
    
    const updatedProjects = run.projects.map((p) => {
      if (p.id !== projectId) return p;
      
      const existingIndex = p.features.findIndex((f) => f.id === feature.id);
      if (existingIndex >= 0) {
        const updatedFeatures = [...p.features];
        updatedFeatures[existingIndex] = feature;
        return { ...p, features: updatedFeatures };
      }
      return { ...p, features: [...p.features, feature] };
    });
    
    return {
      runs: state.runs.map((r) =>
        r.runId === run.runId ? { ...r, projects: updatedProjects } : r
      ),
    };
  }),
  
  updateScenario: (projectId, featureId, scenario) => set((state) => {
    // Implementation for updating individual scenarios
    return state;
  }),
  
  // Computed selectors
  getCurrentRun: () => {
    const state = get();
    return state.runs.find((r) => r.runId === state.selectedRunId);
  },
  
  getCurrentProject: () => {
    const state = get();
    const run = get().getCurrentRun();
    return run?.projects.find((p) => p.id === state.selectedProjectId);
  },
  
  getCurrentFeature: () => {
    const state = get();
    const project = get().getCurrentProject();
    return project?.features.find((f) => f.id === state.selectedFeatureId);
  },
}));
