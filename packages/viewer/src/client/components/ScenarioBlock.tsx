import { Status, Step } from '@livedoc/schema';
import { Card, CardContent } from './ui/card';
import { StatusBadge } from './StatusBadge';
import { Markdown } from './Markdown';
import { Badge } from './ui/badge';
import { normalizeTag } from '../lib/filter-utils';
import { StepList } from './StepList';

export interface ScenarioBlockProps {
  label: 'Scenario' | 'Background';
  title: React.ReactNode;
  status?: Status;
  description?: string;
  tags?: string[];
  steps?: Step[];
  highlightValues?: Record<string, string>;
  showDurations: boolean;
  showErrorStack: boolean;
  tone: 'scenario' | 'background';
}

export function ScenarioBlock({
  label,
  title,
  status,
  description,
  tags,
  steps,
  highlightValues,
  showDurations,
  showErrorStack,
  tone
}: ScenarioBlockProps) {
  const bgClass = tone === 'background' ? 'bg-muted/20' : 'bg-card/60';

  return (
    <Card className={`border-none shadow-none ${bgClass}`}>
      <CardContent className="p-0">
        <div className="py-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-xl font-bold tracking-tight">
              <span className="text-muted-foreground font-semibold">{label}:</span>{' '}
              {title}
            </h2>
            {status && <StatusBadge status={status} size="lg" showLabel />}
          </div>

          {description && (
            <Markdown content={description} className="text-sm text-muted-foreground mb-4" />
          )}

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                  {normalizeTag(tag)}
                </Badge>
              ))}
            </div>
          )}

          {steps && steps.length > 0 && (
            <StepList
              steps={steps}
              highlightValues={highlightValues}
              showDurations={showDurations}
              showErrorStack={showErrorStack}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
