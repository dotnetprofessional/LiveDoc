import { Step, StepType } from '../store';

interface StepListProps {
  steps: Step[];
  showStatus?: boolean;
}

export function StepList({ steps, showStatus = true }: StepListProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <StepItem key={index} step={step} showStatus={showStatus} />
      ))}
    </div>
  );
}

interface StepItemProps {
  step: Step;
  showStatus?: boolean;
}

function StepItem({ step, showStatus = true }: StepItemProps) {
  const typeColors: Record<StepType, string> = {
    Given: 'text-given',
    When: 'text-when',
    Then: 'text-then',
    And: 'text-and',
    But: 'text-but',
  };

  const statusIcons: Record<string, string> = {
    pass: '✓',
    fail: '✗',
    skip: '○',
    pending: '◌',
  };

  const statusColors: Record<string, string> = {
    pass: 'text-pass',
    fail: 'text-fail',
    skip: 'text-skip',
    pending: 'text-pending',
  };

  return (
    <div className="flex items-start gap-2">
      {showStatus && step.status && (
        <span className={`flex-shrink-0 w-4 text-center ${statusColors[step.status]}`}>
          {statusIcons[step.status]}
        </span>
      )}
      <span className={`font-semibold flex-shrink-0 w-14 ${typeColors[step.type]}`}>
        {step.type}
      </span>
      <span className="text-text flex-1">
        {highlightPlaceholders(step.title)}
      </span>
    </div>
  );
}

// Highlight placeholders like <Customer's Country> in step titles
function highlightPlaceholders(text: string): React.ReactNode {
  const parts = text.split(/(<[^>]+>)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return (
        <span key={index} className="px-1 bg-accent/20 text-accent rounded font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

// Template step list for ScenarioOutline (no status, just template)
interface TemplateStepListProps {
  steps: { type: string; title: string }[];
}

export function TemplateStepList({ steps }: TemplateStepListProps) {
  const typeColors: Record<string, string> = {
    Given: 'text-given',
    When: 'text-when',
    Then: 'text-then',
    And: 'text-and',
    But: 'text-but',
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className={`font-semibold flex-shrink-0 w-14 ${typeColors[step.type] || 'text-text-muted'}`}>
            {step.type}
          </span>
          <span className="text-text flex-1">
            {highlightPlaceholders(step.title)}
          </span>
        </div>
      ))}
    </div>
  );
}
