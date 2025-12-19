import { Run, Feature, Scenario } from '../store';
import { StatsBar } from './StatsBar';
import { ItemList } from './ItemList';
import { StatusBadge } from './StatusBadge';

interface SummaryViewProps {
  run: Run;
  onGroupClick: (groupName: string) => void;
}

export function SummaryView({ run, onGroupClick }: SummaryViewProps) {
  const features = run.features || [];
  const groups = groupFeatures(features);
  
  // Calculate total stats from scenarios (not steps)
  const stats = features.reduce((acc, f) => {
    const s = getFeatureStats(f);
    acc.passed += s.passed;
    acc.failed += s.failed;
    acc.pending += s.pending;
    return acc;
  }, { passed: 0, failed: 0, pending: 0 });
  
  const duration = run.summary?.duration || run.duration || 0;
  
  // Determine the result status based on test outcomes (not run execution status)
  // Run status is about execution: running -> completed
  // Result status is about test outcomes: pass/fail/pending
  const resultStatus = stats.failed > 0 ? 'failed' : stats.passed > 0 ? 'passed' : 'pending';

  const groupItems = Object.entries(groups).map(([name, groupFeatures]) => {
    const groupStats = groupFeatures.reduce((acc, f) => {
      const s = getFeatureStats(f);
      acc.passed += s.passed;
      acc.failed += s.failed;
      acc.pending += s.pending;
      acc.duration += f.duration || 0;
      return acc;
    }, { passed: 0, failed: 0, pending: 0, duration: 0 });
    
    const total = groupStats.passed + groupStats.failed + groupStats.pending;
    const groupStatus = groupStats.failed > 0 ? 'fail' : groupStats.pending > 0 ? 'pending' : 'pass';
    const displayName = formatGroupDisplayName(name);

    return {
      id: name,
      name: displayName,
      status: groupStatus as 'pass' | 'fail' | 'pending',
      count: total,
      passed: groupStats.passed,
      failed: groupStats.failed,
      pending: groupStats.pending,
      duration: groupStats.duration,
    };
  });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-semibold text-text mb-1.5">{run.project || 'Test Results'}</h1>
        <div className="flex items-center gap-4 text-sm text-text-secondary">
          {run.environment && <span>{run.environment}</span>}
          {run.framework && <span>{run.framework}</span>}
          <span>{new Date(run.timestamp).toLocaleString()}</span>
          <StatusBadge status={statusToVariant(resultStatus)} showLabel />
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar 
        passed={stats.passed}
        failed={stats.failed}
        pending={stats.pending}
        duration={duration}
        label="scenarios"
      />

      {/* Groups List */}
      <ItemList 
        type="Group"
        items={groupItems}
        onItemClick={onGroupClick}
      />
    </div>
  );
}

function formatGroupDisplayName(groupName: string): string {
  if (groupName === '/') return 'Root';
  return groupName
    .split('/')
    .map((segment) => (segment.startsWith('_') ? segment : segment.replace(/_/g, ' ')))
    .join('/');
}

// Group features by their folder path
function groupFeatures(features: Feature[]): Record<string, Feature[]> {
  const groups: Record<string, Feature[]> = {};
  const basePath = findCommonPath(features.map(f => f.filename || ''));

  for (const f of features) {
    const groupName = getGroupName(f, basePath);
    groups[groupName] = groups[groupName] || [];
    groups[groupName].push(f);
  }
  return groups;
}

function getGroupName(feature: Feature, basePath: string): string {
  const raw = (feature.path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (raw) return raw;

  // Fallback: derive from filename
  const filename = (feature.filename || '').replace(basePath, '').replace(/\\/g, '/');
  const parts = filename.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
}

function findCommonPath(paths: string[]): string {
  if (!paths.length) return '';
  const parts = paths[0].split(/[/\\]/);
  let common: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    if (paths.every(p => p.split(/[/\\]/)[i] === parts[i])) {
      common.push(parts[i]);
    } else break;
  }
  return common.join('/') + (common.length ? '/' : '');
}

// Get scenario stats for a feature
function getFeatureStats(f: Feature): { passed: number; failed: number; pending: number } {
  let passed = 0, failed = 0, pending = 0;
  const scenarios = f.scenarios || [];
  
  // Group scenarios to count ScenarioOutlines as single items
  const { outlines, standaloneScenarios } = groupScenarios(scenarios);
  
  // Count each ScenarioOutline as 1 scenario
  for (const { examples } of outlines) {
    const outlineStatus = examples.some((e: Scenario) => e.status === 'fail') ? 'fail'
                        : examples.some((e: Scenario) => e.status === 'pending' || !e.status) ? 'pending'
                        : 'pass';
    outlineStatus === 'pass' ? passed++ : outlineStatus === 'fail' ? failed++ : pending++;
  }
  
  // Count standalone scenarios
  for (const s of standaloneScenarios) {
    const st = s.status || 'pending';
    st === 'pass' ? passed++ : st === 'fail' ? failed++ : pending++;
  }
  
  return { passed, failed, pending };
}

function groupScenarios(scenarios: Scenario[]): { outlines: { outline: Scenario; examples: Scenario[] }[]; standaloneScenarios: Scenario[] } {
  const outlineMap = new Map<string, { outline: Scenario; examples: Scenario[] }>();
  const standaloneScenarios: Scenario[] = [];

  for (const s of scenarios) {
    if (s.type === 'Background') {
      continue; // Skip background
    } else if (s.type === 'ScenarioOutline') {
      outlineMap.set(s.id, { outline: s, examples: [] });
    } else if (s.outlineId) {
      const parent = outlineMap.get(s.outlineId);
      if (parent) {
        parent.examples.push(s);
      }
    } else {
      standaloneScenarios.push(s);
    }
  }

  return {
    outlines: Array.from(outlineMap.values()),
    standaloneScenarios,
  };
}

function statusToVariant(status: string): 'pass' | 'fail' | 'skip' | 'pending' {
  switch (status) {
    case 'completed':
    case 'passed':
    case 'pass':
      return 'pass';
    case 'failed':
    case 'fail':
      return 'fail';
    case 'running':
    case 'pending':
      return 'pending';
    default:
      return 'skip';
  }
}

export { groupFeatures, getFeatureStats, groupScenarios };
