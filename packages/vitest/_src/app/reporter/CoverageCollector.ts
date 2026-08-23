import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import type {
  CoverageDiagnostic,
  CoverageMetric,
  CoverageMetricName,
  CoverageReport,
  CoverageSummary,
} from '@swedevtools/livedoc-schema';

export interface CoverageCollectionOptions {
  enabled?: boolean;
  coverageMap?: unknown;
  artifactPath?: string;
  rootDir?: string;
  reportsDirectory?: string;
  runStartedAt?: number;
  thresholds?: Partial<Record<CoverageMetricName, number>>;
}

type Candidate = {
  path: string;
  format: 'istanbul-json-summary' | 'lcov' | 'unsupported';
  detected: 'auto' | 'configured';
};

const metricNames: CoverageMetricName[] = ['lines', 'branches', 'functions', 'statements'];

export function collectCoverageReport(options: CoverageCollectionOptions = {}): CoverageReport | undefined {
  const envEnabled = parseBoolean(process.env.LIVEDOC_COVERAGE);
  const configuredPath = firstNonEmpty(options.artifactPath, process.env.LIVEDOC_COVERAGE_PATH);
  const thresholds = resolveThresholds(options.thresholds);
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const reportsDirectory = options.reportsDirectory
    ? resolvePath(rootDir, options.reportsDirectory)
    : undefined;
  const explicit = envEnabled === true || options.enabled === true || !!configuredPath;

  if (options.coverageMap !== undefined) {
    try {
      const report = parseIstanbulCoverageMap(options.coverageMap, rootDir);
      const applied = applyThresholds(report, thresholds);
      return {
        ...applied,
        provenance: {
          tool: 'vitest',
          format: 'istanbul-coverage-map',
          detected: 'auto',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      return diagnosticReport(
        'parse-failed',
        'warning',
        `LiveDoc could not parse Vitest's in-memory coverage map: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const candidates = findCandidates(rootDir, reportsDirectory, configuredPath);
  if (candidates.length === 0) {
    return explicit
      ? diagnosticReport('artifact-missing', 'warning', 'Coverage was enabled, but LiveDoc could not find a supported coverage artifact.')
      : undefined;
  }

  const stale: CoverageDiagnostic[] = [];
  for (const candidate of candidates) {
    if (!existsSync(candidate.path)) continue;

    let fileStats: ReturnType<typeof statSync>;
    try {
      fileStats = statSync(candidate.path);
    } catch (error) {
      return diagnosticReport(
        'parse-failed',
        'warning',
        `LiveDoc could not read the coverage artifact metadata: ${error instanceof Error ? error.message : String(error)}`,
        candidate.path
      );
    }

    const generatedAt = fileStats.mtime.toISOString();
    if (isStale(fileStats, options.runStartedAt)) {
      stale.push({
        severity: 'warning',
        code: 'stale',
        message: 'LiveDoc found a coverage artifact, but it appears older than the current test run.',
        path: candidate.path,
      });
      if (candidate.detected === 'configured') {
        return { status: 'invalid', diagnostics: stale };
      }
      continue;
    }

    if (candidate.format === 'unsupported') {
      return diagnosticReport(
        'unsupported-format',
        'warning',
        `LiveDoc does not support this coverage artifact format yet: ${path.basename(candidate.path)}.`,
        candidate.path
      );
    }

    try {
      const report = candidate.format === 'istanbul-json-summary'
        ? parseIstanbulSummary(candidate.path, rootDir)
        : parseLcov(candidate.path, rootDir);
      const applied = applyThresholds(report, thresholds);
      return {
        ...applied,
        provenance: {
          tool: candidate.format === 'lcov' ? 'lcov' : 'istanbul',
          format: candidate.format,
          path: candidate.path,
          detected: candidate.detected,
          generatedAt,
        },
      };
    } catch (error) {
      return diagnosticReport(
        'parse-failed',
        'warning',
        `LiveDoc could not parse the coverage artifact: ${error instanceof Error ? error.message : String(error)}`,
        candidate.path
      );
    }
  }

  if (stale.length > 0 && explicit) {
    return { status: 'invalid', diagnostics: stale };
  }

  return undefined;
}

function parseIstanbulSummary(filePath: string, rootDir: string): CoverageReport {
  const data = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(data)) {
    throw new Error('Istanbul summary root must be an object.');
  }

  const total = data.total;
  if (!isRecord(total)) {
    throw new Error('Istanbul summary is missing the total coverage block.');
  }

  const files = Object.entries(data)
    .filter(([key]) => key !== 'total')
    .map(([file, value]) => ({
      path: normalizeCoveragePath(file, rootDir),
      summary: normalizeSummary(value),
    }))
    .filter((file) => Object.keys(file.summary).length > 0);

  return {
    status: 'available',
    summary: normalizeSummary(total),
    files,
  };
}

type IstanbulCoverageSummaryLike = {
  toJSON: () => unknown;
};

type IstanbulFileCoverageLike = {
  toSummary: () => IstanbulCoverageSummaryLike;
};

type IstanbulCoverageMapLike = {
  getCoverageSummary: () => IstanbulCoverageSummaryLike;
  files: () => string[];
  fileCoverageFor: (file: string) => IstanbulFileCoverageLike;
};

function parseIstanbulCoverageMap(value: unknown, rootDir: string): CoverageReport {
  if (!isIstanbulCoverageMap(value)) {
    throw new Error('Coverage value does not expose the Istanbul CoverageMap API.');
  }

  const files = value.files().map((file) => {
    const fileCoverage = value.fileCoverageFor(file);
    const summary = fileCoverage.toSummary().toJSON();
    return {
      path: normalizeCoveragePath(file, rootDir),
      summary: normalizeSummary(summary),
    };
  }).filter((file) => Object.keys(file.summary).length > 0);

  return {
    status: 'available',
    summary: normalizeSummary(value.getCoverageSummary().toJSON()),
    files,
  };
}

function parseLcov(filePath: string, rootDir: string): CoverageReport {
  const text = readFileSync(filePath, 'utf8');
  const files: Array<{ path: string; summary: CoverageSummary }> = [];
  let current: {
    path?: string;
    lines: Map<number, number>;
    branches: Array<number | null>;
    functions: Map<string, number>;
  } | undefined;

  const flush = () => {
    if (!current?.path) return;
    const lineValues = Array.from(current.lines.values());
    const branchValues = current.branches;
    const functionValues = Array.from(current.functions.values());
    const summary: CoverageSummary = {
      lines: metricFromHits(lineValues),
    };
    if (branchValues.length > 0) summary.branches = metricFromHits(branchValues);
    if (functionValues.length > 0) summary.functions = metricFromHits(functionValues);
    files.push({ path: normalizeCoveragePath(current.path, rootDir), summary });
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === 'end_of_record') {
      flush();
      current = undefined;
      continue;
    }
    if (line.startsWith('SF:')) {
      flush();
      current = { path: line.slice(3), lines: new Map(), branches: [], functions: new Map() };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('DA:')) {
      const [lineNumber, hits] = line.slice(3).split(',');
      const parsedLine = Number(lineNumber);
      const parsedHits = Number(hits);
      if (Number.isFinite(parsedLine) && Number.isFinite(parsedHits)) current.lines.set(parsedLine, parsedHits);
      continue;
    }
    if (line.startsWith('BRDA:')) {
      const parts = line.slice(5).split(',');
      const taken = parts[3] === '-' ? null : Number(parts[3]);
      current.branches.push(Number.isFinite(taken) ? taken : null);
      continue;
    }
    if (line.startsWith('FNDA:')) {
      const [hits, name] = line.slice(5).split(',');
      const parsedHits = Number(hits);
      if (name && Number.isFinite(parsedHits)) current.functions.set(name, parsedHits);
    }
  }
  flush();

  return {
    status: 'available',
    summary: aggregateSummaries(files.map((file) => file.summary)),
    files,
  };
}

function metricFromHits(values: Array<number | null>): CoverageMetric {
  const total = values.length;
  const covered = values.filter((value) => typeof value === 'number' && value > 0).length;
  return makeMetric(covered, total);
}

function normalizeSummary(value: unknown): CoverageSummary {
  const summary: CoverageSummary = {};
  if (!isRecord(value)) return summary;

  for (const metric of metricNames) {
    const raw = value[metric];
    if (!isRecord(raw)) continue;
    const total = Number(raw.total);
    const covered = Number(raw.covered);
    const skipped = Number(raw.skipped);
    const pct = raw.pct === 'Unknown' || raw.pct === undefined || raw.pct === null
      ? calculatePct(covered, total)
      : Number(raw.pct);
    if (!Number.isFinite(total) || !Number.isFinite(covered)) continue;
    summary[metric] = {
      covered,
      total,
      skipped: Number.isFinite(skipped) ? skipped : undefined,
      pct: Number.isFinite(pct) ? clampPct(pct) : calculatePct(covered, total),
    };
  }
  return summary;
}

function aggregateSummaries(summaries: CoverageSummary[]): CoverageSummary {
  const aggregate: CoverageSummary = {};
  for (const metric of metricNames) {
    let covered = 0;
    let total = 0;
    let skipped = 0;
    let hasMetric = false;
    for (const summary of summaries) {
      const value = summary[metric];
      if (!value) continue;
      covered += value.covered;
      total += value.total;
      skipped += value.skipped ?? 0;
      hasMetric = true;
    }
    if (hasMetric) aggregate[metric] = { ...makeMetric(covered, total), skipped };
  }
  return aggregate;
}

function applyThresholds(report: CoverageReport, thresholds: Partial<Record<CoverageMetricName, number>>): CoverageReport {
  const entries = Object.entries(thresholds) as Array<[CoverageMetricName, number]>;
  if (entries.length === 0) return report;

  const diagnostics: CoverageDiagnostic[] = [...(report.diagnostics ?? [])];
  const applied = entries.map(([metric, minimum]) => {
    const actual = report.summary?.[metric]?.pct ?? null;
    const status = actual !== null && actual < minimum ? 'warning' as const : 'passed' as const;
    if (status === 'warning') {
      diagnostics.push({
        severity: 'warning',
        code: 'threshold-warning',
        message: `${metric} coverage is ${actual?.toFixed(1)}%, below the configured ${minimum}% threshold.`,
      });
    }
    return { metric, minimum, actual, status };
  });

  return {
    ...report,
    thresholds: applied,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
  };
}

function findCandidates(rootDir: string, reportsDirectory: string | undefined, configuredPath: string | undefined): Candidate[] {
  const candidates: Candidate[] = [];
  const add = (candidatePath: string | undefined, detected: 'auto' | 'configured') => {
    if (!candidatePath) return;
    const resolved = resolvePath(rootDir, candidatePath);
    if (candidates.some((candidate) => candidate.path.toLowerCase() === resolved.toLowerCase())) return;
    candidates.push({ path: resolved, format: detectFormat(resolved), detected });
  };

  add(configuredPath, 'configured');
  add(reportsDirectory ? path.join(reportsDirectory, 'coverage-summary.json') : undefined, 'auto');
  add(reportsDirectory ? path.join(reportsDirectory, 'lcov.info') : undefined, 'auto');
  add(path.join(rootDir, 'coverage', 'coverage-summary.json'), 'auto');
  add(path.join(rootDir, 'coverage', 'lcov.info'), 'auto');
  add(path.join(process.cwd(), 'coverage', 'coverage-summary.json'), 'auto');
  add(path.join(process.cwd(), 'coverage', 'lcov.info'), 'auto');

  return candidates.filter((candidate) => existsSync(candidate.path) || candidate.detected === 'configured');
}

function detectFormat(filePath: string): Candidate['format'] {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (normalized.endsWith('/coverage-summary.json') || normalized.endsWith('\\coverage-summary.json')) return 'istanbul-json-summary';
  if (normalized.endsWith('.info') || normalized.endsWith('.lcov')) return 'lcov';
  return 'unsupported';
}

function diagnosticReport(code: CoverageDiagnostic['code'], severity: CoverageDiagnostic['severity'], message: string, filePath?: string): CoverageReport {
  return {
    status: severity === 'info' ? 'not-collected' : 'invalid',
    diagnostics: [{ severity, code, message, path: filePath }],
  };
}

function normalizeCoveragePath(filePath: string, rootDir: string): string {
  const absolute = path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(rootDir, filePath);
  let relative = path.relative(rootDir, absolute);
  if (!relative || relative.startsWith('..')) relative = filePath;
  return relative.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function makeMetric(covered: number, total: number): CoverageMetric {
  return { covered, total, pct: calculatePct(covered, total) };
}

function calculatePct(covered: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return clampPct((covered / total) * 100);
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function isStale(fileStats: ReturnType<typeof statSync>, runStartedAt: number | undefined): boolean {
  if (!runStartedAt || !Number.isFinite(runStartedAt)) return false;
  return fileStats.mtimeMs + 2000 < runStartedAt;
}

function resolveThresholds(configured: Partial<Record<CoverageMetricName, number>> | undefined): Partial<Record<CoverageMetricName, number>> {
  const thresholds: Partial<Record<CoverageMetricName, number>> = {};
  for (const metric of metricNames) {
    const fromOptions = configured?.[metric];
    const fromEnv = process.env[`LIVEDOC_COVERAGE_THRESHOLD_${metric.toUpperCase()}`];
    const parsed = Number(fromOptions ?? fromEnv);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) thresholds[metric] = parsed;
  }
  return thresholds;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function resolvePath(rootDir: string, value: string): string {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(rootDir, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIstanbulCoverageMap(value: unknown): value is IstanbulCoverageMapLike {
  if (!isRecord(value)) return false;
  return typeof value.getCoverageSummary === 'function'
    && typeof value.files === 'function'
    && typeof value.fileCoverageFor === 'function';
}
