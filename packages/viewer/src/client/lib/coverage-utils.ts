import type {
  CoverageFile,
  CoverageMetric,
  CoverageMetricName,
  CoverageReport,
  CoverageSummary,
} from '@swedevtools/livedoc-schema';
import type { RunLike } from '../store';

export interface CoverageSource {
  id: string;
  label: string;
  scope: 'overall' | 'module' | 'run';
  coverage?: CoverageReport;
}

export interface CoverageTreeNode {
  type: 'folder' | 'file';
  name: string;
  path: string;
  summary: CoverageSummary;
  file?: CoverageFile;
  children: CoverageTreeNode[];
}

export const coverageMetricNames: CoverageMetricName[] = ['lines', 'branches', 'functions', 'statements'];

export function getCoverageSources(run: RunLike): CoverageSource[] {
  const runSources = run.run.sourceRuns && run.run.sourceRuns.length > 0
    ? run.run.sourceRuns.map((source) => ({
      id: source.runId,
      label: source.project,
      coverage: source.coverage,
    }))
    : [{
      id: run.run.project || 'run',
      label: run.run.project || 'Test Results',
      coverage: run.run.coverage,
    }];
  const reports = runSources
    .map((source) => source.coverage)
    .filter((coverage): coverage is CoverageReport => coverage !== undefined);
  const moduleFiles = new Map<string, CoverageFile>();

  for (const report of reports) {
    for (const file of report.files ?? []) {
      if (!file.module) continue;
      const key = `${file.module.toLowerCase()}\u001f${file.path.replace(/\\/g, '/').toLowerCase()}`;
      const existing = moduleFiles.get(key);
      if (!existing || coveredLines(file) > coveredLines(existing)) moduleFiles.set(key, file);
    }
  }

  if (moduleFiles.size === 0) {
    return runSources.map((source) => ({ ...source, scope: 'run' as const }));
  }

  const files = [...moduleFiles.values()];
  const moduleGroups = new Map<string, CoverageFile[]>();
  for (const file of files) {
    const module = file.module!;
    const moduleCoverageFiles = moduleGroups.get(module) ?? [];
    moduleCoverageFiles.push(file);
    moduleGroups.set(module, moduleCoverageFiles);
  }
  const modules = [...moduleGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([module, moduleCoverageFiles]) => ({
      id: `module:${module}`,
      label: module,
      scope: 'module' as const,
      coverage: {
        status: 'available' as const,
        summary: aggregateSummaries(moduleCoverageFiles.map((file) => file.summary)),
        files: moduleCoverageFiles,
        provenance: reports[0]?.provenance,
      },
    }));

  if (modules.length === 1) return modules;

  return [{
    id: 'module:overall',
    label: 'All modules',
    scope: 'overall' as const,
    coverage: {
      status: 'available' as const,
      summary: aggregateSummaries(files.map((file) => file.summary)),
      files,
      diagnostics: reports.flatMap((report) => report.diagnostics ?? []),
      provenance: reports[0]?.provenance,
    },
  }, ...modules];
}

function coveredLines(file: CoverageFile): number {
  return file.summary.lines?.covered ?? 0;
}

export function hasCoverageDetails(source: CoverageSource): boolean {
  return (source.coverage?.files?.length ?? 0) > 0;
}

export function getMetric(summary: CoverageSummary | undefined, metric: CoverageMetricName): CoverageMetric | undefined {
  return summary?.[metric];
}

export function formatPct(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a';
}

export function formatCount(metric: CoverageMetric | undefined): string {
  if (!metric) return 'No data';
  return `${metric.covered}/${metric.total}`;
}

export type CoverageTone = 'healthy' | 'warning' | 'critical' | 'muted';

export const coverageToneThresholds = {
  healthy: 85,
  warning: 50,
} as const;

export const coverageToneStyles: Record<CoverageTone, {
  textClass: string;
  dotClass: string;
  signalTone: 'pass' | 'warn' | 'fail' | 'neutral';
}> = {
  healthy: {
    textClass: 'text-pass',
    dotClass: 'bg-pass',
    signalTone: 'pass',
  },
  warning: {
    textClass: 'text-amber-500',
    dotClass: 'bg-amber-500',
    signalTone: 'warn',
  },
  critical: {
    textClass: 'text-fail',
    dotClass: 'bg-fail',
    signalTone: 'fail',
  },
  muted: {
    textClass: 'text-muted-foreground',
    dotClass: 'bg-muted-foreground',
    signalTone: 'neutral',
  },
};

export function metricTone(metric: CoverageMetric | undefined): CoverageTone {
  const pct = metric?.pct;
  if (pct === null || pct === undefined) return 'muted';
  if (pct >= coverageToneThresholds.healthy) return 'healthy';
  if (pct >= coverageToneThresholds.warning) return 'warning';
  return 'critical';
}

export function coverageHasWarnings(coverage: CoverageReport | undefined): boolean {
  return (coverage?.diagnostics ?? []).some((diagnostic) => diagnostic.severity === 'warning' || diagnostic.severity === 'error') ||
    (coverage?.thresholds ?? []).some((threshold) => threshold.status === 'warning');
}

export function buildCoverageTree(files: CoverageFile[]): CoverageTreeNode[] {
  const root: CoverageTreeNode = { type: 'folder', name: 'root', path: '', summary: {}, children: [] };
  const fileParts = files.map((file) => file.path.split(/[\\/]/).filter(Boolean));
  const commonDirectoryPrefixLength = getCommonDirectoryPrefixLength(fileParts);

  const findOrCreateFolder = (parent: CoverageTreeNode, name: string, path: string) => {
    let folder = parent.children.find((child) => child.type === 'folder' && child.name === name);
    if (!folder) {
      folder = { type: 'folder', name, path, summary: {}, children: [] };
      parent.children.push(folder);
    }
    return folder;
  };

  for (const [index, file] of files.entries()) {
    const parts = fileParts[index]!.slice(commonDirectoryPrefixLength);
    if (parts.length === 0) continue;
    let current = root;
    let currentPath = '';
    for (const part of parts.slice(0, -1)) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      current = findOrCreateFolder(current, part, currentPath);
    }

    const fileName = parts[parts.length - 1]!;
    const filePath = parts.join('/');
    current.children.push({
      type: 'file',
      name: fileName,
      path: filePath,
      summary: file.summary,
      file,
      children: [],
    });
  }

  const compute = (node: CoverageTreeNode): CoverageSummary => {
    if (node.type === 'file') return node.summary;
    for (const child of node.children) compute(child);
    node.summary = aggregateSummaries(node.children.map((child) => child.summary));
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return node.summary;
  };

  compute(root);
  return root.children;
}

function getCommonDirectoryPrefixLength(paths: string[][]): number {
  if (paths.length === 0) return 0;

  const firstDirectory = paths[0]!.slice(0, -1);
  let commonLength = firstDirectory.length;

  for (const path of paths.slice(1)) {
    const directory = path.slice(0, -1);
    commonLength = Math.min(commonLength, directory.length);
    for (let index = 0; index < commonLength; index += 1) {
      if (firstDirectory[index]!.toLocaleLowerCase() !== directory[index]!.toLocaleLowerCase()) {
        commonLength = index;
        break;
      }
    }
  }

  return commonLength;
}

export function aggregateSummaries(summaries: CoverageSummary[]): CoverageSummary {
  const output: CoverageSummary = {};
  for (const metricName of coverageMetricNames) {
    let covered = 0;
    let total = 0;
    let skipped = 0;
    let found = false;
    for (const summary of summaries) {
      const metric = summary[metricName];
      if (!metric) continue;
      covered += metric.covered;
      total += metric.total;
      skipped += metric.skipped ?? 0;
      found = true;
    }
    if (found) {
      output[metricName] = {
        covered,
        total,
        skipped: skipped > 0 ? skipped : undefined,
        pct: total > 0 ? Math.round((covered / total) * 1000) / 10 : null,
      };
    }
  }
  return output;
}
