import * as React from 'react';
import { useStore } from '../store';
import { Loader2, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { findLiveRunTarget, resolveLiveRunTarget } from '../lib/live-run';
import { Button } from './ui/button';

type BannerPhase = 'idle' | 'running' | 'completing' | 'done';

/**
 * Prominent animated banner indicating a test run is in progress.
 * Shows live stats, transitions to a brief "complete" flash, then hides.
 */
export function RunProgressBanner() {
  const {
    runs,
    physicalRuns,
    selectedRunId,
    selectedRunGroupId,
    getRunGroups,
    selectRun,
    selectRunGroup,
  } = useStore();
  const groups = getRunGroups();
  const liveState = { runs, physicalRuns, groups, selectedRunId, selectedRunGroupId };
  const activeTarget = findLiveRunTarget(liveState);
  const trackedTargetKeyRef = React.useRef<string | undefined>(undefined);
  if (activeTarget) trackedTargetKeyRef.current = activeTarget.key;
  const displayTarget = activeTarget ?? resolveLiveRunTarget(trackedTargetKeyRef.current, liveState);
  const runStatus = displayTarget?.run.run.status;
  const summary = displayTarget?.run.run.summary;

  const [phase, setPhase] = React.useState<BannerPhase>('idle');
  const previouslyActiveRef = React.useRef(false);
  const dismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const wasActive = previouslyActiveRef.current;
    previouslyActiveRef.current = Boolean(activeTarget);

    if (activeTarget) {
      setPhase('running');
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    } else if (wasActive && displayTarget) {
      // Transition from running → terminal
      setPhase('completing');
      dismissTimerRef.current = setTimeout(() => {
        setPhase('done');
        dismissTimerRef.current = setTimeout(() => setPhase('idle'), 400);
      }, 2800);
    } else {
      setPhase((current) => current === 'completing' || current === 'done' ? current : 'idle');
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [activeTarget?.key, displayTarget?.key, runStatus]);

  if (phase === 'idle') return null;

  const isRunning = phase === 'running';
  const isCompleting = phase === 'completing';
  const isDone = phase === 'done';

  const passed = summary?.passed ?? 0;
  const failed = summary?.failed ?? 0;
  const skipped = summary?.skipped ?? 0;
  const total = summary?.total ?? 0;
  const hasFailed = failed > 0;

  const completedStatus = runStatus === 'failed' || hasFailed ? 'failed' : 'passed';
  const viewLiveRun = () => {
    if (!displayTarget) return;
    if (displayTarget.kind === 'group' && displayTarget.runGroupId) {
      selectRunGroup(displayTarget.runGroupId);
    } else if (displayTarget.runId) {
      selectRun(displayTarget.runId, displayTarget.view);
    }
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden transition-all duration-400 ease-out',
        isDone && 'opacity-0 max-h-0',
        !isDone && 'opacity-100 max-h-16',
      )}
    >
      {/* Animated shimmer background for running state */}
      {isRunning && (
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'linear-gradient(90deg, transparent 0%, var(--primary) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-slide 2s ease-in-out infinite',
          }}
        />
      )}

      <div
        className={cn(
          'relative flex items-center justify-between gap-4 px-6 py-2.5 border-b transition-colors duration-500',
          isRunning && 'bg-primary/[0.04] border-primary/10',
          isCompleting && completedStatus === 'passed' && 'bg-pass/[0.06] border-pass/15',
          isCompleting && completedStatus === 'failed' && 'bg-fail/[0.06] border-fail/15',
        )}
      >
        {/* Left: Status indicator + label */}
        <div className="flex items-center gap-3 min-w-0">
          {isRunning && (
            <>
              <div className="relative flex items-center justify-center w-5 h-5">
                <span className="absolute inset-0 rounded-full bg-primary/15 animate-ping" style={{ animationDuration: '2s' }} />
                <Loader2 className="w-4 h-4 text-primary animate-spin" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-semibold text-foreground tracking-tight">
                Live update in progress
              </span>
              <Activity className="w-3.5 h-3.5 text-muted-foreground/50 animate-pulse" />
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {displayTarget?.run.run.project}
              </span>
            </>
          )}

          {isCompleting && completedStatus === 'passed' && (
            <>
              <CheckCircle2 className="w-5 h-5 text-pass animate-in zoom-in-50 duration-300" strokeWidth={2.5} />
              <span className="text-sm font-semibold text-pass tracking-tight animate-in fade-in duration-300">
                Live update complete — all tests passed
              </span>
            </>
          )}

          {isCompleting && completedStatus === 'failed' && (
            <>
              <XCircle className="w-5 h-5 text-fail animate-in zoom-in-50 duration-300" strokeWidth={2.5} />
              <span className="text-sm font-semibold text-fail tracking-tight animate-in fade-in duration-300">
                Live update complete — {failed} {failed === 1 ? 'failure' : 'failures'} detected
              </span>
            </>
          )}
        </div>

        {/* Right: Live stats */}
        <div className="flex items-center gap-4 text-xs font-medium shrink-0">
          {isRunning && displayTarget && !displayTarget.isSelected && (
            <Button variant="outline" size="sm" className="h-7" onClick={viewLiveRun}>
              View live run
            </Button>
          )}
          {total > 0 && (
            <>
              <span className="text-muted-foreground tabular-nums">
                {total} {total === 1 ? 'test' : 'tests'}
              </span>
              {passed > 0 && (
                <span className="text-pass tabular-nums font-semibold">{passed} passed</span>
              )}
              {failed > 0 && (
                <span className="text-fail tabular-nums font-semibold">{failed} failed</span>
              )}
              {skipped > 0 && (
                <span className="text-muted-foreground/60 tabular-nums">{skipped} skipped</span>
              )}
            </>
          )}
          {isRunning && total === 0 && (
            <span className="text-muted-foreground/60 italic">Waiting for results…</span>
          )}
        </div>
      </div>

      {/* Bottom edge accent line */}
      {isRunning && (
        <div className="absolute bottom-0 left-0 right-0 h-px">
          <div
            className="h-full bg-primary/30"
            style={{
              backgroundImage: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
              backgroundSize: '40% 100%',
              animation: 'shimmer-slide 1.5s ease-in-out infinite',
            }}
          />
        </div>
      )}
    </div>
  );
}
