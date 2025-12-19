import { Run, Feature, Scenario, Background, Step } from '../store';
import { Breadcrumb } from './Breadcrumb';
import { ScenarioOutlineCard } from './ScenarioOutlineCard';
import { groupScenarios } from '../lib/gherkin-utils';

interface ScenarioOutlineViewProps {
  run: Run;
  featureId: string;
  outlineId: string;
}

export function ScenarioOutlineView({ run, featureId, outlineId }: ScenarioOutlineViewProps) {
  const features = run.features || [];
  const feature = features.find(f => f.id === featureId);
  
  if (!feature) {
    return (
      <div className="max-w-5xl mx-auto">
        <Breadcrumb />
        <div className="text-center text-text-muted py-8">Feature not found</div>
      </div>
    );
  }

  // Group scenarios to find the outline
  const { outlines, background } = groupScenarios(feature.scenarios);
  const outline = outlines.find(o => o.id === outlineId);

  if (!outline) {
    return (
      <div className="max-w-5xl mx-auto">
        <Breadcrumb />
        <div className="text-center text-text-muted py-8">Scenario Outline not found</div>
      </div>
    );
  }

  const shortPath = getShortPath(feature.filename);

  return (
    <div className="max-w-5xl mx-auto">
      <Breadcrumb />

      {/* Feature Context */}
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

      {/* Scenario Outline Card with full details */}
      <ScenarioOutlineCard 
        outline={outline} 
        background={background || feature.background} 
      />
    </div>
  );
}

// Duplicated from FeatureView - could be extracted to shared utility
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
