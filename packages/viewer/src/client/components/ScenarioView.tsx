import { Run, Feature, Scenario, Step, Background } from '../store';
import { Breadcrumb } from './Breadcrumb';
import { StepList } from './StepList';

interface ScenarioViewProps {
  run: Run;
  featureId: string;
  scenarioId: string;
}

export function ScenarioView({ run, featureId, scenarioId }: ScenarioViewProps) {
  const features = run.features || [];
  const feature = features.find(f => f.id === featureId);
  const scenario = feature?.scenarios?.find(s => s.id === scenarioId);

  // Find background from feature scenarios (legacy shape) or feature.background
  const background = (feature as any)?.background || feature?.scenarios?.find(s =>
    s.type === 'Background' || s.title === 'Background' || s.id?.includes('background')
  );

  if (!feature || !scenario) {
    return (
      <div className="max-w-5xl mx-auto">
        <Breadcrumb />
        <div className="text-center text-text-muted py-8">Scenario not found</div>
      </div>
    );
  }

  const steps = scenario.steps || [];
  const status = scenario.status || 'pending';
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

      {/* Scenario Card */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {/* Scenario Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}></span>
            <h2 className="text-base font-semibold text-text">
              {highlightExampleValues(scenario.title, scenario.exampleValues)}
            </h2>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            {scenario.duration && (
              <span>Duration: {formatDuration(scenario.duration)}</span>
            )}
            {scenario.tags && scenario.tags.length > 0 && (
              <span>Tags: {scenario.tags.map(t => '@' + t).join(' ')}</span>
            )}
          </div>
        </div>

        {/* Background Section */}
        {background && background.steps && background.steps.length > 0 && (
          <div className="px-5 py-4 border-b border-border bg-surface-hover/30">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Background</div>
            <StepList steps={background.steps} showStatus={false} />
          </div>
        )}

        {/* Example Values Table (for outline examples) */}
        {scenario.exampleValues && Object.keys(scenario.exampleValues).length > 0 && (
          <div className="px-5 py-3 border-b border-border">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Example Values</div>
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="bg-surface-hover/50">
                  {Object.keys(scenario.exampleValues).map(key => (
                    <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-text-muted uppercase border-r border-border last:border-r-0">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Object.entries(scenario.exampleValues).map(([key, value]) => (
                    <td key={key} className="px-3 py-2 text-text border-r border-border last:border-r-0">
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Steps */}
        <div className="p-5">
          {steps.length > 0 ? (
            <StepList steps={steps} highlightValues={scenario.exampleValues} />
          ) : (
            <div className="text-center text-text-muted py-4">No steps</div>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightExampleValues(text: string, values?: Record<string, string>): React.ReactNode {
  if (!values || Object.keys(values).length === 0) return text;

  const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uniqueValues = Array.from(
    new Set(Object.values(values).map((v) => String(v ?? '')).filter((v) => v.length > 0))
  ).sort((a, b) => b.length - a.length);

  if (uniqueValues.length === 0) return text;

  const pattern = new RegExp(`(${uniqueValues.map(escapeRegExp).join('|')})`, 'g');
  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    if (uniqueValues.includes(part)) {
      return (
        <span key={idx} className="px-1 bg-accent/20 text-accent rounded font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getShortPath(path?: string): string {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts.slice(-3).join('/');
}
