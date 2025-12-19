import { Feature, Scenario, Background } from '../store';
import { Breadcrumb } from './Breadcrumb';
import { StatusBadge } from './StatusBadge';
import { StepList } from './StepList';
import { StatsBar } from './StatsBar';
import { ClockIcon, TagIcon } from './Icons';
import { ItemList } from './ItemList';
import { groupScenarios } from '../lib/gherkin-utils';

interface FeatureViewProps {
  feature: Feature;
  groupName?: string;
  onScenarioClick?: (scenarioId: string) => void;
  onOutlineClick?: (outlineId: string) => void;
}

export function FeatureView({ feature, groupName, onScenarioClick, onOutlineClick }: FeatureViewProps) {
  // Group scenarios: separate outlines from regular scenarios
  const { regularScenarios, outlines, background } = groupScenarios(feature.scenarios);

  // Get short path for display
  const shortPath = getShortPath(feature.filename);

  // Convert regular scenarios to items for ItemList
  const scenarioItems = regularScenarios.map(s => {
    const steps = s.steps || [];
    const passed = steps.filter(st => st.status === 'pass').length;
    const failed = steps.filter(st => st.status === 'fail').length;
    const pending = steps.filter(st => !st.status || st.status === 'pending').length;

    return {
      id: s.id,
      name: s.title,
      status: s.status as 'pass' | 'fail' | 'pending',
      count: steps.length,
      passed,
      failed,
      pending,
      duration: s.duration,
    };
  });

  // Convert outlines to items for ItemList  
  const outlineItems = outlines.map(o => {
    const examples = o.examples || [];
    const passed = examples.filter(e => e.status === 'pass').length;
    const failed = examples.filter(e => e.status === 'fail').length;
    const pending = examples.filter(e => e.status === 'pending' || !e.status).length;
    const status = failed > 0 ? 'fail' : pending > 0 ? 'pending' : 'pass';
    const totalDuration = examples.reduce((sum, e) => sum + (e.duration || 0), 0);

    return {
      id: o.id,
      name: o.title,
      status: status as 'pass' | 'fail' | 'pending',
      count: examples.length,
      passed,
      failed,
      pending,
      duration: totalDuration,
    };
  });

  // Combine all items
  const allItems = [...outlineItems, ...scenarioItems];

  // Calculate feature totals
  const featureTotals = allItems.reduce((acc, item) => {
    acc.passed += item.passed;
    acc.failed += item.failed;
    acc.pending += item.pending;
    acc.duration += item.duration || 0;
    return acc;
  }, { passed: 0, failed: 0, pending: 0, duration: 0 });

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb />

      {/* Feature Detail Header */}
      <div className="bg-surface border border-border rounded-lg p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(feature.status)}`}></span>
          <h1 className="text-lg font-semibold text-text">{feature.title}</h1>
        </div>
        
        {shortPath && (
          <div className="text-xs text-text-muted font-mono mb-3">{shortPath}</div>
        )}
        
        {feature.tags && feature.tags.length > 0 && (
          <div className="flex gap-1.5 mt-3">
            {feature.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 bg-surface-hover border border-border rounded-full text-text-secondary">
                @{tag}
              </span>
            ))}
          </div>
        )}
        
        {feature.description && (
          <div className="mt-3 pt-3 border-t border-border text-sm text-text-secondary whitespace-pre-wrap">
            {feature.description}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      {allItems.length > 0 && (
        <StatsBar 
          passed={featureTotals.passed}
          failed={featureTotals.failed}
          pending={featureTotals.pending}
          duration={featureTotals.duration}
          label={outlineItems.length > 0 ? 'examples' : 'scenarios'}
        />
      )}

      {/* All Scenarios/Outlines as item list */}
      {allItems.length > 0 && (
        <ItemList 
          type="Scenario"
          items={allItems}
          onItemClick={(id) => {
            // Check if it's an outline or regular scenario
            const isOutline = outlines.some(o => o.id === id);
            if (isOutline) {
              onOutlineClick?.(id);
            } else {
              onScenarioClick?.(id);
            }
          }}
        />
      )}

      {/* Empty state */}
      {allItems.length === 0 && (
        <div className="px-5 py-10 text-center text-text-muted">No scenarios</div>
      )}
    </div>
  );
}

interface ScenarioCardProps {
  scenario: Scenario;
}

function ScenarioCard({ scenario }: ScenarioCardProps) {
  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <StatusBadge status={scenario.status} />
          <h3 className="font-semibold text-text">{scenario.title}</h3>
        </div>
        
        {scenario.duration && (
          <span className="text-sm text-text-muted">{formatDuration(scenario.duration)}</span>
        )}
      </div>
      
      {scenario.description && (
        <p className="px-4 py-2 text-sm text-text-muted border-b border-border">{scenario.description}</p>
      )}
      
      <div className="p-4">
        <StepList steps={scenario.steps} />
      </div>
    </div>
  );
}

interface BackgroundSectionProps {
  background: Background;
}

function BackgroundSection({ background }: BackgroundSectionProps) {
  return (
    <div className="bg-surface/50 rounded-lg border border-border/50 p-4 mb-6">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
        Background: {background.title || 'Setup'}
      </h3>
      {background.description && (
        <p className="text-sm text-text-muted mb-3">{background.description}</p>
      )}
      <StepList steps={background.steps} />
    </div>
  );
}

// Group scenarios into regular scenarios and outlines
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pass':
    case 'passed':
      return 'bg-pass';
    case 'fail':
    case 'failed':
      return 'bg-fail';
    case 'pending':
      return 'bg-pending';
    default:
      return 'bg-skip';
  }
}

function getShortPath(path?: string): string {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts.slice(-3).join('/');
}
