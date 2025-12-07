import { Run, Feature, Scenario, Step, Background } from '../store';
import { Breadcrumb } from './Breadcrumb';

interface ScenarioViewProps {
  run: Run;
  featureId: string;
  scenarioId: string;
}

export function ScenarioView({ run, featureId, scenarioId }: ScenarioViewProps) {
  const features = run.features || [];
  const feature = features.find(f => f.id === featureId);
  const scenario = feature?.scenarios?.find(s => s.id === scenarioId);

  // Find background from feature scenarios
  const background = feature?.scenarios?.find(s => 
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
            <h2 className="text-base font-semibold text-text">{scenario.title}</h2>
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
            <div className="space-y-2">
              {background.steps.map((step, idx) => (
                <div key={idx} className="font-mono text-sm text-text-secondary leading-relaxed">
                  <span className="text-accent font-semibold">{step.type}</span>{' '}
                  {step.title}
                </div>
              ))}
            </div>
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
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <StepDetail key={idx} step={step} />
              ))}
            </div>
          ) : (
            <div className="text-center text-text-muted py-4">No steps</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDetail({ step }: { step: Step }) {
  const icon = step.status === 'pass' ? '✓' : step.status === 'fail' ? '✗' : '○';
  const iconColor = step.status === 'pass' ? 'text-pass' : step.status === 'fail' ? 'text-fail' : 'text-text-muted';

  return (
    <div className="flex gap-3">
      <span className={`${iconColor} text-sm pt-0.5`}>{icon}</span>
      <div className="flex-1">
        <div className="font-mono text-sm leading-relaxed">
          <span className="text-accent font-semibold">{step.type}</span>{' '}
          <span className="text-text">{step.title}</span>
          {step.duration && (
            <span className="text-text-muted text-xs ml-2">{formatDuration(step.duration)}</span>
          )}
        </div>
        
        {step.error && (
          <div className="mt-2 p-3 bg-fail/10 border-l-2 border-fail rounded-r">
            <div className="font-mono text-xs text-fail">
              {step.error.message}
            </div>
            {step.error.diff && (
              <div className="font-mono text-xs mt-2 space-y-1">
                <div className="text-pass">+ expected: {step.error.diff.expected}</div>
                <div className="text-fail">- actual: {step.error.diff.actual}</div>
              </div>
            )}
            {step.error.stack && (
              <div className="font-mono text-[10px] text-text-muted mt-2 whitespace-pre-wrap break-words">
                {step.error.stack}
              </div>
            )}
            {step.error.filename && (
              <div className="font-mono text-[10px] text-text-muted mt-2">
                File: {step.error.filename}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
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
