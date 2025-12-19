import { Step, StepType } from '../store';

interface StepListProps {
  steps: Step[];
  showStatus?: boolean;
  /** Optional example values to highlight in rendered titles (ScenarioOutline / RuleOutline examples) */
  highlightValues?: Record<string, string>;
}

export function StepList({ steps, showStatus = true, highlightValues }: StepListProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <StepItem key={index} step={step} showStatus={showStatus} highlightValues={highlightValues} />
      ))}
    </div>
  );
}

interface StepItemProps {
  step: Step;
  showStatus?: boolean;
  highlightValues?: Record<string, string>;
}

function StepItem({ step, showStatus = true, highlightValues }: StepItemProps) {
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

  const isContinuation = step.type === 'And' || step.type === 'But';
  const normalizedTable = normalizeDataTable(step.dataTable);

  return (
    <div className="flex items-start gap-2">
      {showStatus && step.status && (
        <span className={`shrink-0 w-4 text-center ${statusColors[step.status]}`}>
          {statusIcons[step.status]}
        </span>
      )}
      <span className={`font-semibold shrink-0 w-14 ${typeColors[step.type]} ${isContinuation ? 'pl-4' : ''}`}>
        {step.type}
      </span>
      <div className="text-text flex-1 min-w-0">
        <div className="whitespace-pre-wrap wrap-break-word">
          {renderStepTitle(step.title, highlightValues)}
        </div>

        {step.docString && (
          <pre className="mt-2 text-xs font-mono text-text-secondary bg-surface-hover/30 border border-border rounded p-3 whitespace-pre-wrap overflow-x-auto">
{step.docString}
          </pre>
        )}

        {normalizedTable && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs font-mono border border-border rounded overflow-hidden">
              <thead>
                <tr className="bg-surface-hover/50">
                  {normalizedTable.headers.map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-semibold text-text-muted uppercase border-r border-border last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {normalizedTable.rows.map((row, idx) => (
                  <tr key={idx} className="border-t border-border">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-2 py-1 text-text-secondary border-r border-border last:border-r-0 whitespace-pre-wrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function renderStepTitle(text: string, highlightValues?: Record<string, string>): React.ReactNode {
  // Prefer placeholder highlighting for template steps
  if (/<[^>]+>/.test(text)) return highlightPlaceholders(text);
  if (!highlightValues || Object.keys(highlightValues).length === 0) return text;
  return highlightExampleValues(text, highlightValues);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight concrete example values in step titles (and scenario titles)
function highlightExampleValues(text: string, values: Record<string, string>): React.ReactNode {
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

function normalizeDataTable(dataTable: unknown): { headers: string[]; rows: string[][] } | null {
  if (!dataTable) return null;

  // Viewer legacy shape: { rows: string[][] }
  if (typeof dataTable === 'object' && dataTable !== null && Array.isArray((dataTable as any).rows)) {
    const rows = (dataTable as any).rows as unknown[];
    if (rows.length === 0 || !Array.isArray(rows[0])) return null;
    const headers = (rows[0] as unknown[]).map((c) => String(c ?? ''));
    const body = rows.slice(1).map((r: any) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
    return { headers, rows: body };
  }

  // Server shape: DataTableRow[] (array of objects) or string[][]
  if (Array.isArray(dataTable)) {
    if (dataTable.length === 0) return null;

    if (Array.isArray(dataTable[0])) {
      const rows = dataTable as unknown[][];
      const headers = (rows[0] || []).map((c) => String(c ?? ''));
      const body = rows.slice(1).map((r) => (r || []).map((c) => String(c ?? '')));
      return { headers, rows: body };
    }

    if (typeof dataTable[0] === 'object' && dataTable[0] !== null) {
      const objects = dataTable as Record<string, unknown>[];
      const headers = Object.keys(objects[0]);
      const body = objects.map((row) => headers.map((h) => String((row as any)?.[h] ?? '')));
      return { headers, rows: body };
    }
  }

  return null;
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
          <span className={`font-semibold shrink-0 w-14 ${typeColors[step.type] || 'text-text-muted'}`}>
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
