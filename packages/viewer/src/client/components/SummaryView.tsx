import { Run } from '../store';
import { StatsBar } from './StatsBar';
import { useStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { StatusBadge } from './StatusBadge';
import { Clock, Calendar, Globe, Zap, Folder, ArrowRight, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { subtreeHasMatch } from '../lib/filter-utils';
import { buildGroupedNavTree, NavItem } from '../lib/nav-tree';

interface SummaryViewProps {
  run: Run;
}

export function SummaryView({ run }: SummaryViewProps) {
  const { navigate, filterText, filterTags } = useStore();
  
  const summary = run.summary;
  const duration = run.duration;
  const status = run.status;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const navTree = buildGroupedNavTree(run.documents ?? []);
  const rootGroup = navTree.find((i) => i.kind === 'Group' && i.id === 'group:/') as (NavItem & { kind: 'Group' }) | undefined;

  const topGroups = (rootGroup?.children ?? []).filter((c) => c.kind === 'Group') as Array<NavItem & { kind: 'Group' }>;

  const countContainers = (group: NavItem & { kind: 'Group' }): number => {
    let count = 0;
    const stack: NavItem[] = [...group.children];
    while (stack.length > 0) {
      const item = stack.pop();
      if (!item) continue;
      if (item.kind === 'Group') stack.push(...item.children);
      else count += 1;
    }
    return count;
  };

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

  const visibleTopGroups = topGroups.filter((g) => groupHasMatch(g));

  const failingContainers = (() => {
    const docs = run.documents ?? [];
    const failed = docs.filter((n) => String((n as any).execution?.status ?? '') === 'failed');
    const filtered = (!hasText && !hasTags) ? failed : failed.filter((n) => subtreeHasMatch(n as any, textLower, filterTags));
    return filtered;
  })();

  const ruleViolationItems = (() => {
    const nodes = Object.values((run as any).nodeMap ?? {}) as any[];
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

  const mostRecentFailure = failingContainers[0];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="rounded-full px-3 py-1 border-primary/20 bg-primary/5 text-primary font-bold tracking-wider uppercase text-[10px]">
              {run.framework || 'LiveDoc'}
            </Badge>
            <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Last verified {new Date(run.timestamp).toLocaleString()}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            {run.project || 'Test Results'}
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
              <Badge variant="secondary" className="font-bold">{run.environment || 'Default'}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Last verified</span>
              <span className="text-sm font-bold">{new Date(run.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Duration</span>
              <span className="text-sm font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(duration)}
              </span>
            </div>
            <Separator />
            <div className="pt-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Quick Links
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-between text-[10px] font-bold uppercase tracking-wider"
                  onClick={() => navigate('group', 'group:/')}
                >
                  Open Root Folder
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-between text-[10px] font-bold uppercase tracking-wider"
                  onClick={() => {
                    document.getElementById('dashboard-failures')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  View Failing Tests
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!mostRecentFailure}
                  className="justify-between text-[10px] font-bold uppercase tracking-wider"
                  onClick={() => {
                    if (mostRecentFailure) navigate('node', mostRecentFailure.id);
                  }}
                >
                  Jump To Recent Failure
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization / grouping health */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Organization</h2>
            <p className="text-sm text-muted-foreground font-medium">Top-level groupings and roll-up health</p>
          </div>
        </div>

        {visibleTopGroups.length === 0 ? (
          <Card className="border-muted/50">
            <CardContent className="py-6 text-sm text-muted-foreground">
              No top-level folders found for this run.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTopGroups.map((g) => (
              <Card
                key={g.id}
                className="cursor-pointer hover:shadow-xl hover:scale-[1.01] transition-all duration-300 border-muted/50"
                onClick={() => navigate('group', g.id)}
              >
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Folder className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{g.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {countContainers(g)} container{countContainers(g) === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {g.status && <StatusBadge status={g.status as any} size="sm" />}
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Failures */}
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

        {failingContainers.length === 0 ? (
          <Card className="border-muted/50">
            <CardContent className="py-8 text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground/60" />
              No failing containers in this run.
            </CardContent>
          </Card>
        ) : (
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
        )}
      </div>

      {/* Rule Violations */}
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

        {ruleViolationItems.items.length === 0 ? (
          <Card className="border-muted/50">
            <CardContent className="py-8 text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground/60" />
              No rule violations in this run.
            </CardContent>
          </Card>
        ) : (
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
        )}
      </div>
    </div>
  );
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
