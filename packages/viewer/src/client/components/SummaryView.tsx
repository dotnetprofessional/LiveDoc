import { Run } from '../store';
import { StatsBar } from './StatsBar';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { StatusBadge } from './StatusBadge';
import { Clock, Calendar, Globe, Zap, ArrowRight } from 'lucide-react';
import { subtreeHasMatch } from '../lib/filter-utils';
import { NavItem } from '../lib/nav-tree';

interface SummaryViewProps {
  run: Run;
}

export function SummaryView({ run }: SummaryViewProps) {
  const { navigate, filterText, filterTags } = useStore();

  const acceptableSlowMs = 1000;

  const runModel = run.run;
  const documents = runModel.documents ?? [];
  
  const summary = runModel.summary;
  const duration = runModel.duration;
  const status = runModel.status;

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
            Latest execution health and organization overview.
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

      <Separator className="opacity-50" />

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Stats Card */}
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-xl bg-linear-to-br from-card to-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Execution Summary
            </CardTitle>
            <CardDescription>Real-time metrics from the latest test run</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <StatsBar summary={summary} duration={duration} ruleViolations={ruleViolationItems.totalViolations} size="lg" />
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
              <span className="text-sm font-medium text-muted-foreground">Duration</span>
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

      {/* Failures */}
      {hasFailures ? (
        <div id="dashboard-failures" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Failures</h2>
              <p className="text-sm text-muted-foreground font-medium">Most useful starting points when something broke</p>
            </div>
            <Badge variant="secondary" className="font-bold">
              {failingContainers.length}
            </Badge>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="divide-y">
              {failingContainers.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => navigate('node', n.id)}
                >
                  <StatusBadge status={(n as any).execution?.status} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                      {String((n as any).kind ?? '')}
                    </div>
                    <div className="text-sm font-semibold truncate">{String((n as any).title ?? '')}</div>
                  </div>
                  <div className="text-xs font-bold text-muted-foreground/70">
                    {(n as any).execution?.duration ? `${(n as any).execution.duration}ms` : ''}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Rule Violations */}
      {hasRuleViolations ? (
        <div id="dashboard-rule-violations" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Rule Violations</h2>
              <p className="text-sm text-muted-foreground font-medium">Non-fatal warnings that may indicate weak specs or unclear intent</p>
            </div>
            <Badge variant="secondary" className="font-bold">
              {ruleViolationItems.totalViolations}
            </Badge>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="divide-y">
              {ruleViolationItems.items.slice(0, 10).map((x) => {
                const first = x.violations?.[0];
                const detail = first
                  ? `${String(first.rule || 'Rule')}: ${String(first.message || '')}`
                  : '';

                return (
                  <button
                    key={x.node.id}
                    type="button"
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-muted/40 transition-colors"
                    onClick={() => navigate('node', x.node.id)}
                  >
                    <StatusBadge status={(x.node as any).execution?.status} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                        {String((x.node as any).kind ?? '')}
                      </div>
                      <div className="text-sm font-semibold truncate">{String((x.node as any).title ?? '')}</div>
                      {detail ? (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {detail}{x.violations.length > 1 ? ` (+${x.violations.length - 1} more)` : ''}
                        </div>
                      ) : null}
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
