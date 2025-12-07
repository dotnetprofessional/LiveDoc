import type { TestRun, Feature, Scenario, Step, Statistics, TestStatus } from '../shared/schema';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Sanitize a string for use as a folder/file name
 */
function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
}

/**
 * Format timestamp for history filename
 */
function formatHistoryFilename(timestamp: string, runId: string): string {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${dateStr}_${runId.slice(-8)}`;
}

/**
 * Persistent store for test runs
 * Stores data in folder structure:
 *   [project]/[environment]/lastrun.json
 *   [project]/[environment]/history/<timestamp>.json
 */
export class RunStore {
  private runs: Map<string, TestRun> = new Map();
  private runsByProject: Map<string, string[]> = new Map(); // "project/env" -> runIds (newest first)
  
  private historyLimit: number;
  private dataDir: string;
  private initialized: boolean = false;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private pendingSave: boolean = false;
  
  constructor(historyLimit: number = 50, dataDir?: string) {
    this.historyLimit = historyLimit;
    
    // Default data directory: .livedoc in current working directory
    this.dataDir = dataDir || path.join(process.cwd(), '.livedoc', 'data');
  }
  
  /**
   * Get folder path for a project/environment
   */
  private getProjectEnvDir(project: string, environment: string): string {
    return path.join(this.dataDir, sanitizeName(project), sanitizeName(environment));
  }
  
  /**
   * Get path to lastrun.json for a project/environment
   */
  private getLastRunPath(project: string, environment: string): string {
    return path.join(this.getProjectEnvDir(project, environment), 'lastrun.json');
  }
  
  /**
   * Get history directory for a project/environment
   */
  private getHistoryDir(project: string, environment: string): string {
    return path.join(this.getProjectEnvDir(project, environment), 'history');
  }
  
  /**
   * Initialize the store - load existing data from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Ensure data directory exists
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Scan for projects
      let projects: string[] = [];
      try {
        projects = await fs.readdir(this.dataDir);
      } catch {
        // Empty data directory
      }
      
      for (const project of projects) {
        const projectDir = path.join(this.dataDir, project);
        const stat = await fs.stat(projectDir).catch(() => null);
        if (!stat?.isDirectory()) continue;
        
        // Scan for environments
        const environments = await fs.readdir(projectDir);
        
        for (const environment of environments) {
          const envDir = path.join(projectDir, environment);
          const envStat = await fs.stat(envDir).catch(() => null);
          if (!envStat?.isDirectory()) continue;
          
          const key = `${project}/${environment}`;
          const runIds: string[] = [];
          
          // Load lastrun.json
          const lastRunPath = path.join(envDir, 'lastrun.json');
          try {
            const content = await fs.readFile(lastRunPath, 'utf-8');
            const run = JSON.parse(content) as TestRun;
            this.runs.set(run.runId, run);
            runIds.push(run.runId);
          } catch {
            // No lastrun.json
          }
          
          // Load history
          const historyDir = path.join(envDir, 'history');
          try {
            const historyFiles = await fs.readdir(historyDir);
            // Sort by filename (which includes timestamp) descending
            historyFiles.sort().reverse();
            
            for (const file of historyFiles) {
              if (!file.endsWith('.json')) continue;
              try {
                const content = await fs.readFile(path.join(historyDir, file), 'utf-8');
                const run = JSON.parse(content) as TestRun;
                // Don't add duplicates (lastrun might be same as latest history)
                if (!this.runs.has(run.runId)) {
                  this.runs.set(run.runId, run);
                  runIds.push(run.runId);
                }
              } catch {
                // Skip corrupted files
              }
            }
          } catch {
            // No history directory
          }
          
          if (runIds.length > 0) {
            this.runsByProject.set(key, runIds);
          }
        }
      }
      
      console.log(`📂 Loaded ${this.runs.size} runs from ${this.dataDir}`);
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize store:', err);
      this.initialized = true; // Continue with in-memory only
    }
  }
  
  /**
   * Save a run to disk in the appropriate location
   */
  private async saveRun(run: TestRun, isLatest: boolean = false): Promise<void> {
    try {
      const envDir = this.getProjectEnvDir(run.project, run.environment);
      await fs.mkdir(envDir, { recursive: true });
      
      if (isLatest) {
        // Save as lastrun.json
        const lastRunPath = this.getLastRunPath(run.project, run.environment);
        await fs.writeFile(lastRunPath, JSON.stringify(run, null, 2), 'utf-8');
      }
      
      // Also save to history if completed
      if (run.status === 'passed' || run.status === 'failed' || run.status === 'completed') {
        const historyDir = this.getHistoryDir(run.project, run.environment);
        await fs.mkdir(historyDir, { recursive: true });
        
        const filename = formatHistoryFilename(run.timestamp, run.runId);
        const historyPath = path.join(historyDir, `${filename}.json`);
        await fs.writeFile(historyPath, JSON.stringify(run, null, 2), 'utf-8');
      }
    } catch (err) {
      console.error(`Failed to save run ${run.runId}:`, err);
    }
  }
  
  /**
   * Delete a run from disk and memory
   */
  async deleteRun(runId: string): Promise<boolean> {
    const run = this.runs.get(runId);
    if (!run) return false;
    
    const key = `${run.project}/${run.environment}`;
    const projectRuns = this.runsByProject.get(key) || [];
    
    // Remove from memory
    this.runs.delete(runId);
    const newProjectRuns = projectRuns.filter(id => id !== runId);
    
    if (newProjectRuns.length === 0) {
      this.runsByProject.delete(key);
    } else {
      this.runsByProject.set(key, newProjectRuns);
    }
    
    // Delete from disk
    try {
      const historyDir = this.getHistoryDir(run.project, run.environment);
      const historyFiles = await fs.readdir(historyDir).catch(() => []);
      
      for (const file of historyFiles) {
        if (file.includes(runId.slice(-8))) {
          await fs.unlink(path.join(historyDir, file)).catch(() => {});
        }
      }
      
      // If this was the latest run, update lastrun.json
      const latestRunPath = this.getLastRunPath(run.project, run.environment);
      try {
        const lastRunContent = await fs.readFile(latestRunPath, 'utf-8');
        const lastRun = JSON.parse(lastRunContent) as TestRun;
        if (lastRun.runId === runId) {
          // Replace with next most recent
          if (newProjectRuns.length > 0) {
            const nextRun = this.runs.get(newProjectRuns[0]);
            if (nextRun) {
              await fs.writeFile(latestRunPath, JSON.stringify(nextRun, null, 2), 'utf-8');
            }
          } else {
            // No more runs - delete lastrun.json
            await fs.unlink(latestRunPath).catch(() => {});
          }
        }
      } catch {
        // lastrun.json doesn't exist
      }
      
      // Clean up empty directories
      const envDir = this.getProjectEnvDir(run.project, run.environment);
      try {
        const envContents = await fs.readdir(envDir);
        if (envContents.length === 0 || (envContents.length === 1 && envContents[0] === 'history')) {
          const historyContents = await fs.readdir(historyDir).catch(() => []);
          if (historyContents.length === 0) {
            await fs.rmdir(historyDir).catch(() => {});
            await fs.rmdir(envDir).catch(() => {});
            
            // Try to clean up project dir if empty
            const projectDir = path.join(this.dataDir, sanitizeName(run.project));
            const projectContents = await fs.readdir(projectDir).catch(() => ['dummy']);
            if (projectContents.length === 0) {
              await fs.rmdir(projectDir).catch(() => {});
            }
          }
        }
      } catch {
        // Ignore cleanup errors
      }
      
      return true;
    } catch (err) {
      console.error(`Failed to delete run ${runId} from disk:`, err);
      return true; // Still removed from memory
    }
  }
  
  /**
   * Enforce history limit for a project/environment
   */
  private async enforceHistoryLimit(project: string, environment: string): Promise<void> {
    const key = `${project}/${environment}`;
    const projectRuns = this.runsByProject.get(key) || [];
    
    while (projectRuns.length > this.historyLimit) {
      const oldRunId = projectRuns.pop()!;
      const oldRun = this.runs.get(oldRunId);
      
      if (oldRun) {
        // Delete from history directory
        const historyDir = this.getHistoryDir(project, environment);
        try {
          const historyFiles = await fs.readdir(historyDir);
          for (const file of historyFiles) {
            if (file.includes(oldRunId.slice(-8))) {
              await fs.unlink(path.join(historyDir, file)).catch(() => {});
            }
          }
        } catch {
          // Ignore errors
        }
      }
      
      this.runs.delete(oldRunId);
    }
    
    this.runsByProject.set(key, projectRuns);
  }
  
  /**
   * Debounced run save to avoid excessive writes during streaming updates
   */
  private runSaveTimers: Map<string, NodeJS.Timeout> = new Map();
  
  private scheduleSaveRun(run: TestRun): void {
    const existing = this.runSaveTimers.get(run.runId);
    if (existing) {
      clearTimeout(existing);
    }
    
    const timer = setTimeout(() => {
      this.saveRun(run, true); // Save as latest during streaming
      this.runSaveTimers.delete(run.runId);
    }, 500); // Debounce 500ms for streaming updates
    
    this.runSaveTimers.set(run.runId, timer);
  }
  
  /**
   * Create a new run
   */
  createRun(runId: string, project: string, environment: string, framework: string, timestamp: string): TestRun {
    const run: TestRun = {
      version: '1.0',
      runId,
      project,
      environment,
      framework: framework as TestRun['framework'],
      timestamp,
      duration: 0,
      status: 'running',
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        duration: 0
      },
      features: [],
      suites: []
    };
    
    this.runs.set(runId, run);
    
    // Track by project/env
    const key = `${project}/${environment}`;
    const projectRuns = this.runsByProject.get(key) || [];
    projectRuns.unshift(runId); // Add to front (newest first)
    this.runsByProject.set(key, projectRuns);
    
    // Save to disk as latest
    this.saveRun(run, true);
    
    // Enforce history limit asynchronously
    this.enforceHistoryLimit(project, environment);
    
    return run;
  }
  
  /**
   * Get all runs
   */
  getAllRuns(): TestRun[] {
    return Array.from(this.runs.values());
  }

  /**
   * Get a run by ID
   */
  getRun(runId: string): TestRun | undefined {
    return this.runs.get(runId);
  }
  
  /**
   * Add a feature to a run
   */
  addFeature(runId: string, feature: Feature): void {
    const run = this.runs.get(runId);
    if (!run) return;
    
    // Check if feature already exists
    const existing = run.features.find(f => f.id === feature.id);
    if (existing) {
      Object.assign(existing, feature);
    } else {
      run.features.push(feature);
    }
    
    // Save to disk (debounced)
    this.scheduleSaveRun(run);
  }
  
  /**
   * Update feature status
   */
  updateFeatureStatus(runId: string, featureId: string, status: TestStatus): void {
    const run = this.runs.get(runId);
    if (!run) return;
    
    const feature = run.features.find(f => f.id === featureId);
    if (feature) {
      feature.status = status;
      this.scheduleSaveRun(run);
    }
  }
  
  /**
   * Add or update a scenario
   */
  addScenario(runId: string, featureId: string, scenario: Scenario): void {
    const run = this.runs.get(runId);
    if (!run) return;
    
    const feature = run.features.find(f => f.id === featureId);
    if (!feature) return;
    
    const existing = feature.scenarios.find(s => s.id === scenario.id);
    if (existing) {
      Object.assign(existing, scenario);
    } else {
      feature.scenarios.push(scenario);
    }
    
    this.scheduleSaveRun(run);
  }
  
  /**
   * Update scenario status
   */
  updateScenarioStatus(runId: string, scenarioId: string, status: TestStatus, duration: number): void {
    const run = this.runs.get(runId);
    if (!run) return;
    
    for (const feature of run.features) {
      const scenario = feature.scenarios.find(s => s.id === scenarioId);
      if (scenario && 'steps' in scenario) {
        scenario.status = status;
        scenario.duration = duration;
        this.scheduleSaveRun(run);
        return;
      }
    }
  }
  
  /**
   * Add a step to a scenario
   */
  addStep(runId: string, scenarioId: string, step: Step): void {
    const run = this.runs.get(runId);
    if (!run) return;
    
    for (const feature of run.features) {
      const scenario = feature.scenarios.find(s => s.id === scenarioId);
      if (scenario && 'steps' in scenario) {
        const existing = scenario.steps.find(s => s.id === step.id);
        if (existing) {
          Object.assign(existing, step);
        } else {
          scenario.steps.push(step);
        }
        this.scheduleSaveRun(run);
        return;
      }
    }
  }
  
  /**
   * Complete a run
   */
  completeRun(runId: string, status: TestStatus, duration: number, summary: Statistics): void {
    const run = this.runs.get(runId);
    if (!run) return;
    
    run.status = status;
    run.duration = duration;
    run.summary = summary;
    
    // Immediately save completed runs (to both lastrun.json and history)
    this.saveRun(run, true);
  }
  
  /**
   * Store a complete run (batch mode)
   */
  storeCompleteRun(run: TestRun): void {
    this.runs.set(run.runId, run);
    
    const key = `${run.project}/${run.environment}`;
    const projectRuns = this.runsByProject.get(key) || [];
    projectRuns.unshift(run.runId);
    this.runsByProject.set(key, projectRuns);
    
    // Immediately save complete runs
    this.saveRun(run, true);
    
    // Enforce history limit
    this.enforceHistoryLimit(run.project, run.environment);
  }
  
  /**
   * Get all projects with their environments
   */
  getProjects(): { project: string; environment: string; latestRun?: TestRun; historyCount: number }[] {
    const result: { project: string; environment: string; latestRun?: TestRun; historyCount: number }[] = [];
    
    for (const [key, runIds] of this.runsByProject.entries()) {
      const [project, environment] = key.split('/');
      const latestRunId = runIds[0];
      const latestRun = latestRunId ? this.runs.get(latestRunId) : undefined;
      
      result.push({ 
        project, 
        environment, 
        latestRun,
        historyCount: runIds.length
      });
    }
    
    return result;
  }
  
  /**
   * Get project hierarchy for navigation
   */
  getProjectHierarchy(): { 
    name: string; 
    environments: { 
      name: string; 
      latestRun?: TestRun; 
      historyCount: number;
      history: { runId: string; timestamp: string; status: string; summary?: TestRun['summary'] }[];
    }[] 
  }[] {
    const projectMap = new Map<string, Map<string, string[]>>();
    
    for (const [key, runIds] of this.runsByProject.entries()) {
      const [project, environment] = key.split('/');
      
      if (!projectMap.has(project)) {
        projectMap.set(project, new Map());
      }
      projectMap.get(project)!.set(environment, runIds);
    }
    
    const result: { 
      name: string; 
      environments: { 
        name: string; 
        latestRun?: TestRun; 
        historyCount: number;
        history: { runId: string; timestamp: string; status: string; summary?: TestRun['summary'] }[];
      }[] 
    }[] = [];
    
    for (const [projectName, environments] of projectMap.entries()) {
      const envList: typeof result[0]['environments'] = [];
      
      for (const [envName, runIds] of environments.entries()) {
        const latestRun = runIds[0] ? this.runs.get(runIds[0]) : undefined;
        
        // Get history (excluding latest)
        const history = runIds.slice(1).map(runId => {
          const run = this.runs.get(runId);
          return {
            runId,
            timestamp: run?.timestamp || '',
            status: run?.status || 'unknown',
            summary: run?.summary
          };
        });
        
        envList.push({
          name: envName,
          latestRun,
          historyCount: runIds.length,
          history
        });
      }
      
      result.push({
        name: projectName,
        environments: envList
      });
    }
    
    return result;
  }
  
  /**
   * Get runs for a project/environment
   */
  getRunsForProject(project: string, environment: string): TestRun[] {
    const key = `${project}/${environment}`;
    const runIds = this.runsByProject.get(key) || [];
    
    return runIds
      .map(id => this.runs.get(id))
      .filter((run): run is TestRun => run !== undefined);
  }
  
  /**
   * Get latest run for a project/environment
   */
  getLatestRun(project: string, environment: string): TestRun | undefined {
    const key = `${project}/${environment}`;
    const runIds = this.runsByProject.get(key) || [];
    
    if (runIds.length === 0) return undefined;
    return this.runs.get(runIds[0]);
  }
  
  /**
   * Get the data directory path
   */
  getDataDir(): string {
    return this.dataDir;
  }
  
  /**
   * Flush all pending saves (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    // Clear all debounce timers and save immediately
    for (const [runId, timer] of this.runSaveTimers.entries()) {
      clearTimeout(timer);
      const run = this.runs.get(runId);
      if (run) {
        await this.saveRun(run, true);
      }
    }
    this.runSaveTimers.clear();
    
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
  }
}

// Singleton instance
export const runStore = new RunStore();
