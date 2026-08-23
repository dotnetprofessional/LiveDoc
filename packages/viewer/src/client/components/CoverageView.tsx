import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, FileCode2, Folder, Gauge, Layers3 } from 'lucide-react';
import type { CoverageMetricName } from '@swedevtools/livedoc-schema';
import type { RunLike } from '../store';
import {
  buildCoverageTree,
  coverageMetricNames,
  CoverageSource,
  coverageToneStyles,
  CoverageTreeNode,
  formatCount,
  formatPct,
  getCoverageSources,
  getMetric,
  hasCoverageDetails,
  metricTone,
} from '../lib/coverage-utils';
import { cn } from '../lib/utils';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

const metricLabels: Record<CoverageMetricName, string> = {
  lines: 'Lines',
  branches: 'Branches',
  functions: 'Functions',
  statements: 'Statements',
};

export function CoverageView({ run }: { run: RunLike }) {
  const sources = getCoverageSources(run);
  const detailSources = sources.filter(hasCoverageDetails);
  const moduleSources = detailSources.filter((source) => source.scope === 'module');
  const overallSource = detailSources.find((source) => source.scope === 'overall') ?? detailSources[0];

  if (detailSources.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              No coverage details available
            </CardTitle>
            <CardDescription>
              This run has no file-level coverage data. Enable coverage in the test runner or configure a supported artifact path.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (moduleSources.length === 0 && detailSources.length === 1) {
    return <CoverageSourceExplorer source={detailSources[0]!} grouped={false} />;
  }

  if (moduleSources.length > 0 && overallSource) {
    return <CoverageModuleExplorer overall={overallSource} modules={moduleSources} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="mb-3 rounded-full border-primary/30 bg-primary/5 text-primary">
          GROUPED COVERAGE
        </Badge>
        <h1 className="text-3xl font-black tracking-tight">
          Coverage by source project
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          LiveDoc keeps grouped project coverage separated so shared source files are not double-counted.
        </p>
      </div>

      {detailSources.map((source) => (
        <CoverageSourceExplorer key={source.id} source={source} grouped />
      ))}
    </div>
  );
}

function CoverageSummaryCard({ source, title }: { source: CoverageSource; title: string }) {
  const lineMetric = getMetric(source.coverage?.summary, 'lines');
  return (
    <Card className="border-muted/60 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gauge className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <CardDescription>
          {source.coverage?.provenance
            ? `${source.coverage.provenance.format} · ${source.coverage.provenance.detected}`
            : 'Normalized coverage metrics'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-5xl font-black tracking-tight">
          <span className={coverageToneStyles[metricTone(lineMetric)].textClass}>{formatPct(lineMetric?.pct)}</span>
        </div>
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {formatCount(lineMetric)} lines covered
        </p>
        <Progress value={lineMetric?.pct ?? 0} className="mt-5" />
      </CardContent>
    </Card>
  );
}

function MetricBreakdown({ source }: { source: CoverageSource }) {
  return (
    <Card className="border-muted/60">
      <CardHeader>
        <CardTitle className="text-lg">Metric breakdown</CardTitle>
        <CardDescription>Coverage metrics as reported by the source tool.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {coverageMetricNames.map((metricName) => {
          const metric = getMetric(source.coverage?.summary, metricName);
          return (
            <div key={metricName} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {metricLabels[metricName]}
                </span>
                <span className={cn('text-lg font-black', coverageToneStyles[metricTone(metric)].textClass)}>
                  {formatPct(metric?.pct)}
                </span>
              </div>
              <Progress value={metric?.pct ?? 0} className="mt-3 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">{formatCount(metric)}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CoverageModuleExplorer({ overall, modules }: { overall: CoverageSource; modules: CoverageSource[] }) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set());
  const overallLines = getMetric(overall.coverage?.summary, 'lines');

  const toggleModule = (id: string) => {
    setExpandedModules((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="mb-3 rounded-full border-primary/30 bg-primary/5 text-primary">
          MODULE COVERAGE
        </Badge>
        <h1 className="text-3xl font-black tracking-tight">Coverage by project hierarchy</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Assemblies lead the hierarchy, followed by their source folders and files.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <CoverageSummaryCard source={overall} title="All modules" />
        <MetricBreakdown source={overall} />
      </div>

      <Card className="overflow-hidden border-muted/60">
        <CardHeader className="border-b bg-muted/15">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers3 className="h-5 w-5 text-primary" />
            Project hierarchy
          </CardTitle>
          <CardDescription>
            {modules.length} modules · {overall.coverage?.files?.length ?? 0} files · {formatPct(overallLines?.pct)} line coverage
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {modules.map((module) => (
              <CoverageModuleSection
                key={module.id}
                source={module}
                open={expandedModules.has(module.id)}
                onToggle={() => toggleModule(module.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CoverageModuleSection({
  source,
  open,
  onToggle,
}: {
  source: CoverageSource;
  open: boolean;
  onToggle: () => void;
}) {
  const tree = useMemo(() => buildCoverageTree(source.coverage?.files ?? []), [source.coverage?.files]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));
  const lines = getMetric(source.coverage?.summary, 'lines');
  const branches = getMetric(source.coverage?.summary, 'branches');
  const fileCount = source.coverage?.files?.length ?? 0;
  const tone = metricTone(lines);

  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_auto]"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="flex min-w-0 items-center gap-3">
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', coverageToneStyles[tone].dotClass)} />
          <Layers3 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{source.label}</span>
            <span className="block text-xs text-muted-foreground">
              {fileCount} {fileCount === 1 ? 'file' : 'files'} · {formatCount(lines)} lines
            </span>
          </span>
        </span>
        <span className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-auto sm:flex-nowrap">
          <MetricPill label="lines" metric={lines} />
          {branches && <MetricPill label="branches" metric={branches} />}
        </span>
      </button>
      {open && (
        <div className="border-t bg-muted/10 pl-4 sm:pl-8">
          {tree.map((node) => (
            <CoverageTreeRow key={node.path} node={node} depth={0} expanded={expanded} onToggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function CoverageSourceExplorer({ source, grouped }: { source: CoverageSource; grouped: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));
  const tree = useMemo(() => buildCoverageTree(source.coverage?.files ?? []), [source.coverage?.files]);

  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <CoverageSummaryCard source={source} title={grouped ? source.label : 'Coverage summary'} />
        <MetricBreakdown source={source} />
      </div>

      {(source.coverage?.diagnostics?.length ?? 0) > 0 && (
        <div className="space-y-2">
          {source.coverage!.diagnostics!.map((diagnostic, index) => (
            <div key={`${diagnostic.code}:${index}`} className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{diagnostic.message}</p>
                  {diagnostic.path && <p className="mt-1 break-all font-mono text-xs opacity-80">{diagnostic.path}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden border-none shadow-xl">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCode2 className="h-5 w-5 text-primary" />
            File coverage
          </CardTitle>
          <CardDescription>Folders are rolled up from their child files.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {tree.map((node) => (
              <CoverageTreeRow key={node.path} node={node} depth={0} expanded={expanded} onToggle={toggle} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CoverageTreeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: CoverageTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}) {
  const lines = getMetric(node.summary, 'lines');
  const branches = getMetric(node.summary, 'branches');
  const isFolder = node.type === 'folder';
  const isOpen = expanded.has(node.path);
  const Icon = isFolder ? Folder : FileCode2;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        onClick={() => isFolder && onToggle(node.path)}
      >
        <span style={{ width: depth * 18 }} className="shrink-0" />
        {isFolder ? (
          isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <span className="h-4 w-4" />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', isFolder ? 'text-primary' : 'text-muted-foreground')} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{node.name}</div>
          {node.path !== node.name && (
            <div className="truncate text-[11px] text-muted-foreground">{node.path}</div>
          )}
        </div>
        <MetricPill label="lines" metric={lines} />
        <MetricPill label="branches" metric={branches} className="hidden xl:block" />
      </button>

      {isFolder && isOpen && node.children.map((child) => (
        <CoverageTreeRow key={child.path} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </div>
  );
}

function MetricPill({ label, metric, className }: { label: string; metric: ReturnType<typeof getMetric>; className?: string }) {
  return (
    <div className={cn('w-24 shrink-0 rounded-full border bg-background px-3 py-1 text-right', className)}>
      <div className={cn('text-xs font-black leading-none', coverageToneStyles[metricTone(metric)].textClass)}>{formatPct(metric?.pct)}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
