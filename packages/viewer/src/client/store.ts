import { create } from 'zustand';
import { Node, Statistics, Status } from '@livedoc/schema';

export interface Run {
  runId: string;
  project?: string;
  environment?: string;
  framework?: string;
  timestamp: number;
  status: Status;
  summary: Statistics;
  duration: number;
  documents: Node[];
  nodeMap: Record<string, Node>;
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

// Navigation view types
export type ViewType = 'summary' | 'node';

export interface CurrentView {
  type: ViewType;
  nodeId?: string;
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
  sidebarWidth: number;
  expandedItems: Set<string>;
  
  // Actions
  setRuns: (runs: Run[]) => void;
  addRun: (run: Run) => void;
  updateRun: (runId: string, updates: Partial<Run>) => void;
  removeRun: (runId: string) => void;
  setProjectHierarchy: (hierarchy: ProjectNode[]) => void;
  
  selectRun: (runId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  
  // Navigation actions
  navigate: (type: ViewType, nodeId?: string) => void;
  
  setConnectionStatus: (status: ConnectionStatus) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleTheme: () => void;
  setSidebarWidth: (width: number) => void;
  toggleExpanded: (itemId: string) => void;
  
  // Real-time updates
  addOrUpdateNode: (runId: string, parentId: string | undefined, node: Node) => void;
  
  // Computed selectors
  getCurrentRun: () => Run | undefined;
  getCurrentNode: () => Node | undefined;
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
    selectedNodeId: null,
    currentView: { type: 'summary' },
  }),
  
  selectNode: (nodeId) => set({
    selectedNodeId: nodeId,
  }),
  
  // Navigation actions
  navigate: (type, nodeId) => set({
    currentView: { type, nodeId },
    selectedNodeId: nodeId ?? null,
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
  addOrUpdateNode: (runId, parentId, node) => set((state) => {
    const runIndex = state.runs.findIndex(r => r.runId === runId);
    if (runIndex === -1) return state;

    const run = state.runs[runIndex];
    const newNodeMap = { ...run.nodeMap, [node.id]: node };
    let newDocuments = [...run.documents];

    if (parentId) {
      // Child node - we know the parent, so update it directly
      const updateNodeInTree = (nodes: Node[]): Node[] => {
        return nodes.map(n => {
          if (n.id === parentId) {
            const children = (n as any).children || [];
            const existingIndex = children.findIndex((c: Node) => c.id === node.id);
            const newChildren = [...children];
            if (existingIndex >= 0) {
              newChildren[existingIndex] = node;
            } else {
              newChildren.push(node);
            }
            return { ...n, children: newChildren };
          }
          if ((n as any).children) {
            return { ...n, children: updateNodeInTree((n as any).children) };
          }
          return n;
        });
      };
      newDocuments = updateNodeInTree(newDocuments);
    } else {
      // No parentId - could be a root node OR an update to an existing node anywhere
      const existingRootIndex = newDocuments.findIndex(n => n.id === node.id);
      if (existingRootIndex >= 0) {
        newDocuments[existingRootIndex] = node;
      } else {
        // Search and update in tree
        let found = false;
        const updateInTree = (nodes: Node[]): Node[] => {
          return nodes.map(n => {
            if (n.id === node.id) {
              found = true;
              return node;
            }
            if ((n as any).children) {
              const updatedChildren = updateInTree((n as any).children);
              if (found) {
                return { ...n, children: updatedChildren };
              }
            }
            return n;
          });
        };
        
        const updatedDocuments = updateInTree(newDocuments);
        if (found) {
          newDocuments = updatedDocuments;
        } else {
          // Truly a new root node
          newDocuments.push(node);
        }
      }
    }

    const newRuns = [...state.runs];
    newRuns[runIndex] = {
      ...run,
      documents: newDocuments,
      nodeMap: newNodeMap
    };

    return { runs: newRuns };
  }),
  
  // Computed selectors
  getCurrentRun: () => {
    const state = get();
    return state.runs.find((r) => r.runId === state.selectedRunId);
  },
  
  getCurrentNode: () => {
    const state = get();
    const run = get().getCurrentRun();
    if (!run || !state.selectedNodeId) return undefined;
    return run.nodeMap[state.selectedNodeId];
  },
}));
