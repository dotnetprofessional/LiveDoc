import { RunLike } from '../store';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { StatusBadge } from './StatusBadge';
import { Activity, ArrowRight, Calendar, Clock, Gauge, Globe, ListChecks, ShieldCheck, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AnyTest, RuleViolation, TestCase } from '@swedevtools/livedoc-schema';
import { subtreeHasMatch } from '../lib/filter-utils';
import { NavItem } from '../lib/nav-tree';
import { formatDuration } from '../lib/status-utils';
import { CoverageHealthCard } from './CoverageHealthCard';
import { StatusProgressBar } from './ProgressBar';
import { coverageToneStyles, formatPct, getCoverageSources, getMetric, hasCoverageDetails, metricTone } from '../lib/coverage-utils';
import { cn } from '../lib/utils';

interface SummaryViewProps {
  run: RunLike;
}

export function SummaryView({ run }: SummaryViewProps) {
  const { navigate, filterText, filterTags, selectedRunView } = useStore();

  const acceptableSlowMs = 1000;

  const runModel = run.run;
  const documents = runModel.documents ?? [];

  const latestRunInfo = (runModel.sourceRuns && runModel.sourceRuns.length > 0)
    ? runModel.sourceRuns
        .slice()
        .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))[0]
    : undefined;
  const summary = runModel.summary;
  const duration = runModel.duration;
  const status = runModel.status;
  // Combined view of a partial run reflects the latest partial's own duration, not a total
  // elapsed time — label it accordingly rather than the (potentially misleading) "Duration".
  const isCombinedPartial = runModel.runType === 'partial' && selectedRunView !== 'physical';
  const durationLabel = isCombinedPartial ? 'Latest update' : 'Duration';

  const textLower = filterText.trim().toLowerCase();
  const hasText = textLower.length > 0;
  const hasTags = filterTags.length > 0;

  const groupHasMatch = (group: NavItem & { kind: 'Group' }): boolean => {
    if (!hasText && !hasTags) return true;
    for (const child of group.children) {
      if (child.kind === 'Group') {
        if (groupHasMatch(child)) return true;
      } else {
        if (subtreeHasMatch(child.node, textLower, filterTags)) return true;
      }
    }
    return false;
  };

  const rootContainerByNodeId = (() => {
    const map = new Map<string, any>();
    const docs = documents;

    const getChildren = (node: any): any[] => {
      const out: any[] = [];
      if (Array.isArray(node?.children)) out.push(...node.children);
      if (Array.isArray(node?.examples)) out.push(...node.examples);
      if (node?.template) out.push(node.template);
      if (node?.background) out.push(node.background);
      return out;
    };

    for (const doc of docs as any[]) {
      const rootContainer = doc;
      const stack = [doc];
      while (stack.length > 0) {
        const n = stack.pop();
        if (!n) continue;
        if (n?.id) map.set(String(n.id), rootContainer);
        for (const c of getChildren(n)) stack.push(c);
      }
    }

    return map;
  })();

  const hotspots = (() => {
    const textLower = filterText.trim().toLowerCase();
    const hasText = textLower.length > 0;
    const hasTags = filterTags.length > 0;

    const nodes = Object.values(run.itemById ?? {}) as any[];
    const tests = nodes.filter((n) => {
      const kind = String(n?.kind ?? '');
      return kind === 'Test' || kind === 'Scenario' || kind === 'ScenarioOutline' || kind === 'Rule' || kind === 'RuleOutline';
    });

    const byContainerForSlow = new Map<string, { container: any; maxDuration: number; slowestTest: any }>();
    for (const t of tests) {
      const dur = Number(t?.execution?.duration);
      if (!Number.isFinite(dur) || dur <= 0) continue;
      if (dur < acceptableSlowMs) continue;
      if ((hasText || hasTags) && !subtreeHasMatch(t, textLower, filterTags)) continue;

      const container = rootContainerByNodeId.get(String(t.id)) ?? null;
      if (!container) continue;

      const key = String(container.id);
      const existing = byContainerForSlow.get(key);
      if (!existing || dur > existing.maxDuration) {
        byContainerForSlow.set(key, { container, maxDuration: dur, slowestTest: t });
      }
    }

    const longRunning = Array.from(byContainerForSlow.values())
      .sort((a, b) => b.maxDuration - a.maxDuration)
      .slice(0, 8);

    const byContainerForTimeouts = new Map<string, { container: any; count: number; first: any }>();
    for (const t of tests) {
      const status = String(t?.execution?.status ?? '');
      if (status !== 'timedOut') continue;
      if ((hasText || hasTags) && !subtreeHasMatch(t, textLower, filterTags)) continue;

      const container = rootContainerByNodeId.get(String(t.id)) ?? null;
      if (!container) continue;

      const key = String(container.id);
      const existing = byContainerForTimeouts.get(key);
      if (!existing) byContainerForTimeouts.set(key, { container, count: 1, first: t });
      else existing.count += 1;
    }

    const timeouts = Array.from(byContainerForTimeouts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { longRunning, timeouts };
  })();

  const failingContainers = (() => {
    const failed = documents.filter((d) => (d.statistics?.failed ?? 0) > 0);
    return (!hasText && !hasTags) ? failed : failed.filter((d) => subtreeHasMatch(d as any, textLower, filterTags));
  })();

  const ruleViolationItems = (() => {
    const nodes = Object.values(run.itemById ?? {}) as any[];
    const withViolations = nodes
      .map((n) => {
        const violations = (n as any)?.ruleViolations;
        return Array.isArray(violations) && violations.length > 0 ? { node: n, violations } : null;
      })
      .filter(Boolean) as Array<{ node: any; violations: any[] }>;

    const filtered = (!hasText && !hasTags)
      ? withViolations
      : withViolations.filter((x) => subtreeHasMatch(x.node, textLower, filterTags));

    // Sort most severe/visible first: failing nodes with violations, then by violation count.
    filtered.sort((a, b) => {
      const aFailed = String(a.node?.execution?.status ?? '') === 'failed' ? 1 : 0;
      const bFailed = String(b.node?.execution?.status ?? '') === 'failed' ? 1 : 0;
      if (aFailed !== bFailed) return bFailed - aFailed;
      return (b.violations?.length ?? 0) - (a.violations?.length ?? 0);
    });

    const totalViolations = filtered.reduce((sum, x) => sum + (x.violations?.length ?? 0), 0);
    return { items: filtered, totalViolations };
  })();

  const hasHotspots = hotspots.longRunning.length > 0 || hotspots.timeouts.length > 0;
  const hasFailures = failingContainers.length > 0;
  const hasRuleViolations = ruleViolationItems.totalViolations > 0;
  const coverageSources = getCoverageSources(run);
  const overallCoverageSource = coverageSources.find((source) => source.scope === 'overall')
    ?? coverageSources.find(hasCoverageDetails);
  const coverageLines = getMetric(overallCoverageSource?.coverage?.summary, 'lines');
  const hasCoverage = Boolean(
    overallCoverageSource &&
    (overallCoverageSource.coverage?.status === 'available' || overallCoverageSource.coverage?.status === 'partial') &&
    hasCoverageDetails(overallCoverageSource)
  );

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 border-primary/20 bg-primary/5 text-primary font-bold tracking-wider uppercase text-[10px]">
              {runModel.framework || 'LiveDoc'}
            </Badge>
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Last verified {new Date(runModel.timestamp).toLocaleString()}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            {runModel.project || 'Test Results'}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-lg font-medium leading-relaxed">
            {status === 'running' ? (
              <span className="inline-flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Run in progress — results are updating live
              </span>
            ) : (
              latestRunInfo
                ? `Grouped health across ${runModel.sourceRuns?.length ?? 0} related test projects.`
                : 'Latest execution health and organization overview.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col items-end">
            <StatusBadge status={status as any} showLabel size="lg" className="px-6 py-2 text-sm" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2 mr-1">
              Overall Status
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="overflow-hidden border-muted/60 bg-card lg:col-span-3">
          <CardHeader className="border-b pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Activity className="h-5 w-5 text-primary" />
              Quality Signals
            </CardTitle>
            <CardDescription>Real-time summary from the latest test run</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className={cn(
              'grid gap-px overflow-hidden rounded-lg bg-border',
              hasCoverage ? 'md:grid-cols-2 xl:grid-cols-5' : 'md:grid-cols-2 xl:grid-cols-4'
            )}>
              <QualitySignal
                icon={ListChecks}
                label="Tests"
                value={summary.total}
                detail="total"
                tone="neutral"
              />
              <QualitySignal
                icon={XCircle}
                label="Failed"
                value={summary.failed}
                detail={summary.failed > 0 ? 'failed' : 'no failures'}
                tone={summary.failed > 0 ? 'fail' : 'pass'}
              />
              <QualitySignal
                icon={ShieldCheck}
                label="Rule violations"
                value={ruleViolationItems.totalViolations}
                detail={ruleViolationItems.totalViolations > 0 ? 'review' : 'no violations'}
                tone={ruleViolationItems.totalViolations > 0 ? 'warn' : 'pass'}
              />
              {hasCoverage && (
                <QualitySignal
                  icon={Gauge}
                  label="Coverage"
                  value={formatPct(coverageLines?.pct)}
                  detail="lines"
                  tone={coverageToneStyles[metricTone(coverageLines)].signalTone}
                />
              )}
              <QualitySignal
                icon={Clock}
                label={durationLabel}
                value={formatDuration(duration)}
                detail="run time"
                tone="neutral"
              />
            </div>
            <StatusProgressBar
              passed={summary.passed}
              failed={summary.failed}
              pending={summary.pending}
              skipped={summary.skipped}
              isRunning={status === 'running'}
              size="lg"
            />
          </CardContent>
        </Card>

        {/* Environment Info Card */}
        <Card className="border-none shadow-xl bg-card">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Target</span>
              <Badge variant="secondary" className="font-bold">{runModel.environment || 'Default'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Last verified</span>
              <span className="text-sm font-bold">{new Date(runModel.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{durationLabel}</span>
              <span className="text-sm font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(duration)}
              </span>
            </div>
            <Separator />
          </CardContent>
        </Card>

      </div>

      {/* Hotspots */}
      {hasHotspots ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Hotspots</h2>
              <p className="text-sm text-muted-foreground font-medium">
                Long running (&gt; {formatDuration(acceptableSlowMs)}) and timed-out tests (grouped by parent container)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Long running</CardTitle>
                <CardDescription>
                  Containers where the slowest test took &gt; {formatDuration(acceptableSlowMs)}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {hotspots.longRunning.length === 0 ? null : (
                  <div className="divide-y rounded-xl border bg-card overflow-hidden">
                    {hotspots.longRunning.map((x) => (
                      <button
                        key={String(x.container.id)}
                        type="button"
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
                        onClick={() => navigate('node', String(x.container.id))}
                      >
                        <StatusBadge status={String(x.container?.execution?.status ?? '') as any} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{String(x.container?.title ?? '')}</div>
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            Slowest: {String(x.slowestTest?.title ?? '')}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-muted-foreground/70">{formatDuration(x.maxDuration)}</div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Timeouts</CardTitle>
                <CardDescription>Timed-out tests grouped by container</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {hotspots.timeouts.length === 0 ? null : (
                  <div className="divide-y rounded-xl border bg-card overflow-hidden">
                    {hotspots.timeouts.map((x) => (
                      <button
                        key={String(x.container.id)}
                        type="button"
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
                        onClick={() => navigate('node', String(x.container.id))}
                      >
                        <StatusBadge status={'timedOut' as any} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{String(x.container?.title ?? '')}</div>
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            Example: {String(x.first?.title ?? '')}
                          </div>
                        </div>
                        <Badge variant="destructive" className="font-bold">{x.count} timeout{x.count === 1 ? '' : 's'}</Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {hasFailures && (
        <div className="pt-2">
          <FailureHealthCard
            failures={failingContainers}
            onSelect={(id) => navigate('node', id)}
          />
        </div>
      )}

      {hasCoverage && (
        <div className="pt-2">
          <CoverageHealthCard run={run} />
        </div>
      )}

      {hasRuleViolations && (
        <div className="pt-2">
          <RuleViolationHealthCard
            items={ruleViolationItems.items}
            totalViolations={ruleViolationItems.totalViolations}
            onSelect={(id) => navigate('node', id)}
          />
        </div>
      )}
    </div>
  );
}

function FailureHealthCard({
  failures,
  onSelect,
}: {
  failures: TestCase[];
  onSelect: (id: string) => void;
}) {
  return (
    <Card id="dashboard-failures" className="overflow-hidden border-muted/60 bg-card">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <XCircle className="h-5 w-5 text-fail" />
              Failures
            </CardTitle>
            <CardDescription className="mt-1">Most useful starting points when something broke.</CardDescription>
          </div>
          <Badge variant="secondary" className="font-bold">
            {failures.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {failures.slice(0, 10).map((failure) => (
            <button
              key={failure.id}
              type="button"
              className="flex min-h-14 w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              onClick={() => onSelect(failure.id)}
            >
              <StatusBadge status="failed" size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                  {String(failure.kind ?? '')}
                </span>
                <span className="block truncate text-sm font-semibold">{String(failure.title ?? '')}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RuleViolationHealthCard({
  items,
  totalViolations,
  onSelect,
}: {
  items: Array<{ node: TestCase | AnyTest; violations: RuleViolation[] }>;
  totalViolations: number;
  onSelect: (id: string) => void;
}) {
  return (
    <Card id="dashboard-rule-violations" className="overflow-hidden border-muted/60 bg-card">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Rule Violations
            </CardTitle>
            <CardDescription className="mt-1">
              Non-fatal warnings that may indicate weak specs or unclear intent.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-bold">
            {totalViolations}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {items.slice(0, 10).map(({ node, violations }) => {
            const first = violations[0];
            const detail = first ? `${first.rule || 'Rule'}: ${first.message || ''}` : '';
            const status = 'execution' in node
              ? node.execution.status
              : node.statistics.failed > 0 ? 'failed' : 'passed';

            return (
              <button
                key={node.id}
                type="button"
                className="flex min-h-14 w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onSelect(node.id)}
              >
                <StatusBadge status={status} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                    {node.kind}
                  </span>
                  <span className="block truncate text-sm font-semibold">{node.title}</span>
                  {detail && (
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {detail}{violations.length > 1 ? ` (+${violations.length - 1} more)` : ''}
                    </span>
                  )}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type SignalTone = 'neutral' | 'pass' | 'fail' | 'warn' | 'info';

function QualitySignal({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone: SignalTone;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-card px-3 py-4 sm:block">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className={cn('h-4 w-4', signalToneClass[tone])} />
        <span className="truncate">{label}</span>
      </div>
      <div className={cn('mt-0 text-2xl font-black tabular-nums sm:mt-4 sm:text-3xl', signalToneClass[tone])}>
        {value}
      </div>
      <div className={cn('ml-auto text-[10px] font-bold uppercase tracking-widest sm:ml-0 sm:mt-1', signalToneClass[tone])}>
        {detail}
      </div>
    </div>
  );
}

const signalToneClass: Record<SignalTone, string> = {
  neutral: 'text-foreground',
  pass: 'text-pass',
  fail: 'text-fail',
  warn: 'text-amber-500',
  info: 'text-sky-400',
};
