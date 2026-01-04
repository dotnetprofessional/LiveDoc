import { useState } from 'react';
import { Scenario, Background, Step } from '../store';
import { StatusBadge } from './StatusBadge';
import { ChevronRight, ChevronDown } from './Icons';
import { StepList } from './StepList';

interface ScenarioOutlineCardProps {
  outline: {
    id: string;
    title: string;
    description?: string;
    templateSteps: Step[];
    examples: Scenario[];
    tags?: string[];
  };
  background?: Background;
}

export function ScenarioOutlineCard({ outline, background }: ScenarioOutlineCardProps) {
  // Track selected example for highlighting in template
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null);
  
  const selectExample = (id: string) => {
    setSelectedExampleId(prev => prev === id ? null : id);
  };

  // Calculate aggregate status
  const aggregateStatus = getAggregateStatus(outline.examples);
  
  // Get column headers from example values
  const columns = getColumnHeaders(outline.examples);
  
  // Get selected example's values for template substitution
  const selectedExample = outline.examples.find(e => e.id === selectedExampleId);
  const substitutionValues = selectedExample?.exampleValues || null;

    // Calculate stats
  const passCount = outline.examples.filter(e => e.status === 'pass').length;
  const failCount = outline.examples.filter(e => e.status === 'fail').length;
  const pendingCount = outline.examples.filter(e => e.status === 'pending' || !e.status).length;

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden mb-4">
      {/* Outline Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <span className={`w-2.5 h-2.5 rounded-full ${getStatusDot(aggregateStatus)}`}></span>
        <span className="flex-1 text-sm font-semibold text-text">
          {!outline.title.startsWith('Scenario Outline:') && !outline.title.startsWith('Specification:') && !outline.title.startsWith('Rule:') && (
            <span className="text-text-muted mr-2">
              {outline.title.toLowerCase().includes('rule') ? 'Rule:' : 'Scenario Outline:'}
            </span>
          )}
          <HighlightedStepText text={outline.title} values={null} />
        </span>
        <div className="flex items-center gap-3 text-xs">
          {passCount > 0 && <span className="text-pass font-medium">✓ {passCount}</span>}
          {failCount > 0 && <span className="text-fail font-medium">✗ {failCount}</span>}
          {pendingCount > 0 && <span className="text-pending font-medium">○ {pendingCount}</span>}
        </div>
      </div>

      {outline.description && (
        <p className="px-5 py-2 text-sm text-text-secondary border-b border-border">
          {outline.description}
        </p>
      )}

      {/* Background Section - BEFORE template steps */}
      {background && (
        <div className="px-5 py-4 border-b border-border">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">
            Background{background.title && background.title !== 'Background' ? `: ${background.title}` : ''}
          </div>
          {background.description && (
            <div className="mb-3 text-sm text-text-secondary whitespace-pre-wrap italic">
              {background.description}
            </div>
          )}
          <StepList steps={background.steps || []} showStatus={true} />
        </div>
      )}

      {/* Template Steps with Placeholder Highlighting or Value Substitution */}
      {outline.templateSteps.length > 0 && (
        <div className="px-5 py-4 bg-surface-hover/30 border-b border-border">
          <StepList 
            steps={outline.templateSteps} 
            showStatus={false} 
            highlightValues={substitutionValues || undefined} 
          />
        </div>
      )}

      {/* Examples Section */}
      <div>
        <div className="px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide border-b border-border">
          Examples ({outline.examples.length})
        </div>
        
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-border bg-surface-hover/50">
              <th className="w-10 px-4 py-2.5 text-center text-xs font-semibold text-text-muted uppercase">#</th>
              {columns.map(col => (
                <th key={col} className="px-4 py-2.5 text-left text-xs font-semibold text-text-muted uppercase">
                  {col}
                </th>
              ))}
              <th className="w-14 px-4 py-2.5 text-center text-xs font-semibold text-text-muted uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {outline.examples.map((example, index) => (
              <ExampleRow
                key={example.id}
                example={example}
                columns={columns}
                index={index + 1}
                isSelected={selectedExampleId === example.id}
                onSelect={() => selectExample(example.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Failed Example Details */}
      {outline.examples.filter(e => e.status === 'fail').map(example => (
        <FailedExampleDetail key={example.id} example={example} />
      ))}
    </div>
  );
}

// Find matching value by normalizing placeholder name
// Handles cases like "Customer's Country" matching "CustomersCountry"
function findMatchingValue(placeholder: string, values: Record<string, string>): string | undefined {
  // Direct match first
  if (values[placeholder] !== undefined) {
    return values[placeholder];
  }
  
  // Normalize: remove spaces, apostrophes, and compare case-insensitively
  const normalize = (s: string) => s.replace(/['\s]/g, '').toLowerCase();
  const normalizedPlaceholder = normalize(placeholder);
  
  for (const [key, value] of Object.entries(values)) {
    if (normalize(key) === normalizedPlaceholder) {
      return value;
    }
  }
  
  return undefined;
}

// Highlight <placeholder> text in steps, or substitute with values if provided
function HighlightedStepText({ text, values }: { text: string; values: Record<string, string> | null }) {
  if (!text) return null;

  // 1. Handle substitution if values are provided
  let content: (string | JSX.Element)[] = [text];

  // 2. Highlight placeholders <name>
  const placeholderRegex = /<([^>]+)>/g;
  content = content.flatMap((part) => {
    if (typeof part !== 'string') return part;
    const subParts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = placeholderRegex.exec(part)) !== null) {
      if (match.index > lastIndex) {
        subParts.push(part.substring(lastIndex, match.index));
      }
      const placeholder = match[1];
      const value = values ? findMatchingValue(placeholder, values) : undefined;
      if (value !== undefined) {
        subParts.push(
          <span key={`ph-${match.index}`} className="px-1 bg-accent/20 text-accent rounded font-medium">
            {value}
          </span>
        );
      } else {
        subParts.push(
          <span key={`ph-${match.index}`} className="px-1 bg-accent/20 text-accent rounded font-medium">
            {match[0]}
          </span>
        );
      }
      lastIndex = placeholderRegex.lastIndex;
    }
    if (lastIndex < part.length) {
      subParts.push(part.substring(lastIndex));
    }
    return subParts;
  });

  // 3. Highlight quoted values 'value' or "value"
  const quoteRegex = /('[^']+'|"[^"]+")/g;
  content = content.flatMap((part) => {
    if (typeof part !== 'string') return part;
    const subParts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = quoteRegex.exec(part)) !== null) {
      if (match.index > lastIndex) {
        subParts.push(part.substring(lastIndex, match.index));
      }
      subParts.push(
        <span key={`q-${match.index}`} className="text-accent font-medium">
          {match[0]}
        </span>
      );
      lastIndex = quoteRegex.lastIndex;
    }
    if (lastIndex < part.length) {
      subParts.push(part.substring(lastIndex));
    }
    return subParts;
  });

  return <>{content}</>;
}

interface ExampleRowProps {
  example: Scenario;
  columns: string[];
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

function ExampleRow({ example, columns, index, isSelected, onSelect }: ExampleRowProps) {
  const statusBg = example.status === 'fail' ? 'bg-fail/10' : '';
  const selectedBg = isSelected ? 'bg-accent/15 ring-1 ring-accent/50' : '';
  const icon = example.status === 'pass' ? '✓' : example.status === 'fail' ? '✗' : '○';

  return (
    <tr 
      className={`border-b border-border/50 hover:bg-surface-hover/50 cursor-pointer transition-colors ${statusBg} ${selectedBg}`}
      onClick={onSelect}
    >
      <td className="px-4 py-2.5 text-center text-text-muted">{index}</td>
      {columns.map(col => (
        <td key={col} className={`px-4 py-2.5 ${isSelected ? 'text-accent font-medium' : 'text-text'}`}>
          {example.exampleValues?.[col] || '-'}
        </td>
      ))}
      <td className="px-4 py-2.5 text-center">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs text-white ${getStatusBg(example.status)}`}>
          {icon}
        </span>
      </td>
    </tr>
  );
}

function StepRow({ step }: { step: Step }) {
  const icon = step.status === 'pass' ? '✓' : step.status === 'fail' ? '✗' : '○';
  const iconColor = step.status === 'pass' ? 'text-pass' : step.status === 'fail' ? 'text-fail' : 'text-text-muted';

  return (
    <div className="flex items-start gap-2">
      <span className={`${iconColor} text-sm`}>{icon}</span>
      <div className="flex-1">
        <div className="font-mono text-sm">
          <span className={`${getStepTypeClass(step.type)} font-semibold`}>{step.type}</span>{' '}
          <span className="text-text">{step.title}</span>
          {step.duration && (
            <span className="text-text-muted text-xs ml-2">{formatDuration(step.duration)}</span>
          )}
        </div>
        {step.error && (
          <div className="mt-2 p-3 bg-fail/10 border-l-2 border-fail rounded-r text-xs font-mono text-fail">
            {step.error.message}
          </div>
        )}
      </div>
    </div>
  );
}

function getStepTypeClass(type: string): string {
  switch (String(type || '').trim().toLowerCase()) {
    case 'given':
      return 'text-given';
    case 'when':
      return 'text-when';
    case 'then':
      return 'text-then';
    case 'and':
      return 'text-and';
    case 'but':
      return 'text-but';
    default:
      return 'text-text-muted';
  }
}

// Failed example detail section
function FailedExampleDetail({ example }: { example: Scenario }) {
  const failedStep = example.steps?.find(st => st.status === 'fail');
  const exampleNum = example.exampleIndex || example.title?.match(/Example (\d+)/)?.[1] || '?';

  return (
    <div className="bg-bg border-t border-border p-5">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-fail">
        <span>✗</span> Example {exampleNum} Failed
      </div>
      
      <div className="space-y-2 mb-3">
        {(example.steps || []).map((step, idx) => (
          <StepRow key={idx} step={step} />
        ))}
      </div>
      
      {failedStep?.error && (
        <div className="p-3 bg-fail/10 border border-fail rounded">
          <div className="font-mono text-xs text-fail mb-2">
            {failedStep.error.message}
          </div>
          {failedStep.error.diff && (
            <div className="font-mono text-xs space-y-1">
              <div className="text-pass">+ expected: {failedStep.error.diff.expected}</div>
              <div className="text-fail">- actual: {failedStep.error.diff.actual}</div>
            </div>
          )}
          {failedStep.error.stack && (
            <div className="font-mono text-[10px] text-text-muted mt-2 whitespace-pre-wrap">
              {failedStep.error.stack}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Get all unique column headers from examples
function getColumnHeaders(examples: Scenario[]): string[] {
  const columns = new Set<string>();
  
  for (const example of examples) {
    if (example.exampleValues) {
      for (const key of Object.keys(example.exampleValues)) {
        columns.add(key);
      }
    }
  }
  
  return Array.from(columns);
}

// Calculate aggregate status from examples
function getAggregateStatus(examples: Scenario[]): 'pass' | 'fail' | 'skip' | 'pending' {
  if (examples.length === 0) return 'pending';
  
  const hasFailure = examples.some(e => e.status === 'fail');
  if (hasFailure) return 'fail';
  
  const hasPending = examples.some(e => e.status === 'pending');
  if (hasPending) return 'pending';
  
  const hasSkip = examples.some(e => e.status === 'skip');
  if (hasSkip) return 'skip';
  
  return 'pass';
}

function getStatusDot(status: string): string {
  switch (status) {
    case 'pass': return 'bg-pass';
    case 'fail': return 'bg-fail';
    case 'pending': return 'bg-pending';
    default: return 'bg-skip';
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'pass': return 'bg-pass';
    case 'fail': return 'bg-fail';
    case 'pending': return 'bg-pending';
    default: return 'bg-skip';
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
