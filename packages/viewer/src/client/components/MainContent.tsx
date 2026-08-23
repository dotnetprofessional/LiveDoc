import { useEffect } from 'react';
import { useStore } from '../store';
import { SummaryView } from './SummaryView';
import { NodeView } from './NodeView';
import { GroupView } from './GroupView';
import { CoverageView } from './CoverageView';
import { AlertTriangle, ClipboardList, FileWarning, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { getCoverageSources, hasCoverageDetails } from '../lib/coverage-utils';

export function MainContent() {
  const {
    currentView,
    getCurrentViewData,
    getCurrentNode,
    connectionStatus,
    diagnostics,
    unresolvedDeepLink,
    pendingRunFetch,
    navigate,
  } = useStore();

  const viewData = getCurrentViewData();
  const node = getCurrentNode();
  const blockingDiagnostics = diagnostics.filter((d) => d.severity === 'error');
  const hasDiagnostics = blockingDiagnostics.length > 0;
  const attemptedLink = unresolvedDeepLink?.hash ?? '';
  const isLoadingSelectedRun = Boolean(pendingRunFetch) && !hasDiagnostics;
  const hasCoverage = viewData ? getCoverageSources(viewData).some(hasCoverageDetails) : false;

  useEffect(() => {
    if (currentView.type === 'coverage' && viewData && !hasCoverage) {
      navigate('summary');
    }
  }, [currentView.type, hasCoverage, navigate, viewData]);

  if (unresolvedDeepLink) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center bg-background/50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl px-6 text-center"
        >
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-amber-500/20">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <Badge variant="outline" className="mb-4 rounded-full border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            404 - LINK NOT FOUND
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight mb-3">Could not open this LiveDoc link</h2>
          <p className="text-muted-foreground mb-6">
            The URL points to a folder or test that is not available in the currently loaded results.
          </p>

          <div className="rounded-2xl border border-amber-500/30 bg-card p-5 text-left shadow-sm">
            <p className="text-sm font-semibold text-foreground">No loaded run, folder, or test matches:</p>
            <p className="mt-2 break-all rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              {attemptedLink}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              The report may have changed, the project grouping setting may differ, or the target page may have been renamed.
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => navigate('summary')}>
              Open overview
            </Button>
          </div>
        </motion.div>
      </main>
    );
  }

  if (!viewData) {
    return (
      <main className="flex-1 overflow-auto flex items-center justify-center bg-background/50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl px-6"
        >
          <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            {hasDiagnostics ? (
              <FileWarning className="w-10 h-10 text-destructive" />
            ) : connectionStatus === 'connecting' || isLoadingSelectedRun ? (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            ) : (
              <ClipboardList className="w-10 h-10 text-muted-foreground/50" />
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {hasDiagnostics
              ? 'Could not render this LiveDoc run'
              : isLoadingSelectedRun
                ? 'Loading run…'
                : 'No test results yet'}
          </h2>
          <p className="text-muted-foreground mb-8">
            {hasDiagnostics
              ? 'The viewer found run data, but it could not load it safely. Check the details below and regenerate the report with the current LiveDoc reporter if needed.'
              : connectionStatus === 'connecting'
                ? "Connecting to the LiveDoc server..."
                : isLoadingSelectedRun
                  ? "Fetching the selected run's details from the server..."
                  : "Run your tests with the LiveDoc reporter to see real-time living documentation here."}
          </p>

          {hasDiagnostics ? (
            <div className="space-y-3 text-left">
              {blockingDiagnostics.map((diagnostic, index) => (
                <div key={`${diagnostic.code}:${index}`} className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <Badge variant="destructive" className="rounded-full">{diagnostic.code}</Badge>
                    {(diagnostic.project || diagnostic.environment) && (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {[diagnostic.project, diagnostic.environment].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{diagnostic.message}</p>
                  {diagnostic.filePath && (
                    <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{diagnostic.filePath}</p>
                  )}
                  {diagnostic.details && diagnostic.details.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {diagnostic.details.map((detail, detailIndex) => (
                        <li key={detailIndex} className="break-words">- {detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-card border rounded-xl text-left text-xs font-mono text-muted-foreground">
              <p className="mb-2 text-foreground font-semibold">Quick Start:</p>
              <p>pnpm vitest --reporter @swedevtools/livedoc-vitest</p>
            </div>
          )}
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto bg-background/50">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView.type + (currentView.id || '')}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="p-4 md:p-10"
        >
          {currentView.type === 'summary' && (
            <SummaryView run={viewData} />
          )}

          {currentView.type === 'coverage' && hasCoverage && (
            <CoverageView run={viewData} />
          )}

          {currentView.type === 'node' && node && (
            <NodeView node={node} />
          )}

          {currentView.type === 'group' && currentView.id && (
            <GroupView run={viewData} groupId={currentView.id} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
