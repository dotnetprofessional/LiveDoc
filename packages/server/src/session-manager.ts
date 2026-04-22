import type {
  SessionV1,
  SessionRunInfo,
  TestRunV1,
  Statistics,
  Status,
  TestCase,
} from '@swedevtools/livedoc-schema';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

interface ActiveSession {
  session: SessionV1;
  timer?: NodeJS.Timeout;
  runIds: Set<string>;
  sealed: boolean;
}

const SESSION_GAP_MS = 10_000; // 10 seconds

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
}

function emptyStats(): Statistics {
  return { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 };
}

function addStats(a: Statistics, b: Statistics): Statistics {
  return {
    total: a.total + b.total,
    passed: a.passed + b.passed,
    failed: a.failed + b.failed,
    pending: a.pending + b.pending,
    skipped: a.skipped + b.skipped,
  };
}

function worstStatus(...statuses: Status[]): Status {
  const priority: Status[] = ['failed', 'timedOut', 'cancelled', 'pending', 'running', 'passed', 'skipped'];
  for (const status of priority) {
    if (statuses.includes(status)) return status;
  }
  return 'pending';
}

export class SessionManager {
  private activeSessions: Map<string, ActiveSession> = new Map();
  private sessionsByKey: Map<string, string> = new Map(); // "project/environment" -> sessionId
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), '.livedoc', 'data');
  }

  private getProjectEnvDir(project: string, environment: string): string {
    return path.join(this.dataDir, sanitizeName(project), sanitizeName(environment));
  }

  private getLastSessionPath(project: string, environment: string): string {
    return path.join(this.getProjectEnvDir(project, environment), 'lastsession.json');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });

      let projects: string[] = [];
      try {
        projects = await fs.readdir(this.dataDir);
      } catch {
        // empty
      }

      for (const project of projects) {
        const projectDir = path.join(this.dataDir, project);
        const stat = await fs.stat(projectDir).catch(() => null);
        if (!stat?.isDirectory()) continue;

        const environments = await fs.readdir(projectDir);
        for (const environment of environments) {
          const envDir = path.join(projectDir, environment);
          const envStat = await fs.stat(envDir).catch(() => null);
          if (!envStat?.isDirectory()) continue;

          const lastSessionPath = this.getLastSessionPath(project, environment);
          try {
            const data = await fs.readFile(lastSessionPath, 'utf-8');
            const session: SessionV1 = JSON.parse(data);
            
            // Restore as sealed session (completed)
            const activeSession: ActiveSession = {
              session,
              runIds: new Set(session.runs.map((r) => r.runId)),
              sealed: true,
            };
            
            this.activeSessions.set(session.sessionId, activeSession);
            this.sessionsByKey.set(`${project}/${environment}`, session.sessionId);
          } catch {
            // No session to restore
          }
        }
      }
    } catch (err) {
      console.error('Error initializing SessionManager:', err);
    }
  }

  assignSession(project: string, environment: string, runId: string, timestamp: string): string {
    const key = `${project}/${environment}`;
    const existingSessionId = this.sessionsByKey.get(key);

    // Check if there's an active unsealed session
    if (existingSessionId) {
      const activeSession = this.activeSessions.get(existingSessionId);
      if (activeSession && !activeSession.sealed) {
        // Clear the grace timer since a new run is joining
        if (activeSession.timer) {
          clearTimeout(activeSession.timer);
          activeSession.timer = undefined;
        }
        activeSession.runIds.add(runId);
        return existingSessionId;
      }
    }

    // Create new session
    const sessionId = randomUUID();
    const session: SessionV1 = {
      sessionId,
      project,
      environment,
      status: 'running',
      timestamp,
      duration: 0,
      summary: emptyStats(),
      runs: [],
      documents: [],
    };

    const activeSession: ActiveSession = {
      session,
      runIds: new Set([runId]),
      sealed: false,
    };

    this.activeSessions.set(sessionId, activeSession);
    this.sessionsByKey.set(key, sessionId);

    return sessionId;
  }

  onRunCompleted(sessionId: string, run: TestRunV1, allSessionRuns: TestRunV1[]): void {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession || activeSession.sealed) return;

    // Rebuild the session aggregate
    this.rebuildSession(sessionId, run);

    // Check if all runs are complete
    const allRunsComplete = this.areAllRunsComplete(allSessionRuns);
    
    if (allRunsComplete) {
      // Start grace timer
      if (activeSession.timer) {
        clearTimeout(activeSession.timer);
      }
      
      activeSession.timer = setTimeout(() => {
        this.sealSession(sessionId);
      }, SESSION_GAP_MS);
    }
  }

  private areAllRunsComplete(runs: TestRunV1[]): boolean {
    if (runs.length === 0) return false;
    
    // All runs must have a terminal status (not 'pending' or 'running')
    return runs.every((run) => {
      return run.status !== 'pending' && run.status !== 'running';
    });
  }

  private rebuildSession(sessionId: string, latestRun: TestRunV1): void {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) return;

    const session = activeSession.session;
    
    // Build runInfo for the latest run
    const runInfo: SessionRunInfo = {
      runId: latestRun.runId,
      framework: latestRun.framework,
      status: latestRun.status,
      timestamp: latestRun.timestamp,
      duration: latestRun.duration,
      summary: latestRun.summary,
      documentCount: latestRun.documents.length,
    };

    // Update or add the run
    const existingIdx = session.runs.findIndex((r) => r.runId === latestRun.runId);
    if (existingIdx >= 0) {
      session.runs[existingIdx] = runInfo;
    } else {
      session.runs.push(runInfo);
    }

    // Recompute aggregates
    this.computeAggregates(session);

    // Save to disk
    void this.saveSession(session);
  }

  rebuildSessionFromRuns(sessionId: string, runs: TestRunV1[]): void {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) return;

    const session = activeSession.session;
    session.runs = [];

    // Sync runIds to match the provided runs
    activeSession.runIds = new Set(runs.map((r) => r.runId));

    for (const run of runs) {
      const runInfo: SessionRunInfo = {
        runId: run.runId,
        framework: run.framework,
        status: run.status,
        timestamp: run.timestamp,
        duration: run.duration,
        summary: run.summary,
        documentCount: run.documents.length,
      };
      session.runs.push(runInfo);
    }

    this.computeAggregates(session);
    this.mergeDocuments(session, runs);
    void this.saveSession(session);
  }

  private computeAggregates(session: SessionV1): void {
    if (session.runs.length === 0) {
      session.status = 'pending';
      session.timestamp = new Date().toISOString();
      session.duration = 0;
      session.summary = emptyStats();
      session.documents = [];
      return;
    }

    // Status: worst of all runs
    session.status = worstStatus(...session.runs.map((r) => r.status));

    // Timestamp: earliest run
    const timestamps = session.runs.map((r) => new Date(r.timestamp).getTime());
    session.timestamp = new Date(Math.min(...timestamps)).toISOString();

    // Duration: wall-clock (latest end - earliest start)
    const endTimes = session.runs.map((r) => {
      const start = new Date(r.timestamp).getTime();
      return start + r.duration;
    });
    const earliestStart = Math.min(...timestamps);
    const latestEnd = Math.max(...endTimes);
    session.duration = latestEnd - earliestStart;

    // Summary: sum of all run summaries
    session.summary = session.runs.reduce((acc, r) => addStats(acc, r.summary), emptyStats());

    // Documents: union with last-writer-wins
    // We need access to the actual runs to get documents
    // For now, we'll update this when rebuildSessionFromRuns is called
  }

  mergeDocuments(session: SessionV1, runs: TestRunV1[]): void {
    const docMap = new Map<string, { doc: TestCase; timestamp: string }>();

    // Sort runs by timestamp
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Merge documents with last-writer-wins
    for (const run of sortedRuns) {
      for (const doc of run.documents) {
        const existing = docMap.get(doc.id);
        if (!existing || new Date(run.timestamp) > new Date(existing.timestamp)) {
          docMap.set(doc.id, { doc, timestamp: run.timestamp });
        }
      }
    }

    session.documents = Array.from(docMap.values()).map((entry) => entry.doc);
  }

  private sealSession(sessionId: string): void {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) return;

    activeSession.sealed = true;
    if (activeSession.timer) {
      clearTimeout(activeSession.timer);
      activeSession.timer = undefined;
    }

    void this.saveSession(activeSession.session);
  }

  private async saveSession(session: SessionV1): Promise<void> {
    try {
      const sessionPath = this.getLastSessionPath(session.project, session.environment);
      await fs.mkdir(path.dirname(sessionPath), { recursive: true });
      await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving session:', err);
    }
  }

  getSession(sessionId: string): SessionV1 | undefined {
    return this.activeSessions.get(sessionId)?.session;
  }

  listSessions(project: string, environment: string): SessionV1[] {
    const sessions: SessionV1[] = [];
    for (const activeSession of this.activeSessions.values()) {
      const session = activeSession.session;
      if (session.project === project && session.environment === environment) {
        sessions.push(session);
      }
    }
    return sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getLatestSession(project: string, environment: string): SessionV1 | undefined {
    const sessions = this.listSessions(project, environment);
    return sessions[0];
  }

  getSessionIdForRun(runId: string): string | undefined {
    for (const [sessionId, activeSession] of this.activeSessions.entries()) {
      if (activeSession.runIds.has(runId)) {
        return sessionId;
      }
    }
    return undefined;
  }

  /**
   * Clear all pending seal/grace timers. Used during shutdown to prevent
   * timers from firing after the server has stopped.
   */
  clearTimers(): void {
    for (const activeSession of this.activeSessions.values()) {
      if (activeSession.timer) {
        clearTimeout(activeSession.timer);
        activeSession.timer = undefined;
      }
    }
  }
}

export const sessionManager = new SessionManager();
