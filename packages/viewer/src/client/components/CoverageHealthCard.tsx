import { ArrowRight, Gauge, Layers3 } from 'lucide-react';
import { RunLike, useStore } from '../store';
import {
  formatPct,
  getCoverageSources,
  getMetric,
  hasCoverageDetails,
  metricTone,
  coverageToneStyles,
} from '../lib/coverage-utils';
import { cn } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

export function CoverageHealthCard({ run }: { run: RunLike }) {
  const { navigate } = useStore();
  const sources = getCoverageSources(run);
  const withCoverage = sources.filter((source) =>
    (source.coverage?.status === 'available' || source.coverage?.status === 'partial') &&
    hasCoverageDetails(source)
  );
  const modules = withCoverage.filter((source) => source.scope === 'module');
  const rows = modules.length > 0 ? modules : withCoverage;

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden border-muted/60 bg-card">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <Gauge className="h-5 w-5 text-primary" />
              Code Coverage
            </CardTitle>
            <CardDescription className="mt-1">Coverage was collected for this run.</CardDescription>
          </div>
          <button
            type="button"
            onClick={() => navigate('coverage')}
            className="inline-flex min-h-10 items-center gap-2 self-start rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View coverage explorer
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="hidden grid-cols-[minmax(0,1fr)_8rem_6rem] border-b bg-muted/20 px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:grid">
          <span>Module</span>
          <span className="text-right">Coverage</span>
          <span className="text-right">Files</span>
        </div>
        <div className="divide-y">
          {rows.map((source) => {
            const lines = getMetric(source.coverage?.summary, 'lines');
            const tone = metricTone(lines);
            return (
              <button
                key={source.id}
                type="button"
                onClick={() => navigate('coverage')}
                className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_8rem_6rem]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', coverageToneStyles[tone].dotClass)} />
                  <Layers3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">{source.label}</span>
                </span>
                <span className={cn('text-right text-sm font-black', coverageToneStyles[tone].textClass)}>
                  {formatPct(lines?.pct)}
                </span>
                <span className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
                  {source.coverage?.files?.length ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
