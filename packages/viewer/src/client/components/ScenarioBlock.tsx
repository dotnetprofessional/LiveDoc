import type { Status, StepTest } from '@swedevtools/livedoc-schema';
import { Card, CardContent } from './ui/card';
import { StatusBadge } from './StatusBadge';
import { Markdown } from './Markdown';
import { Badge } from './ui/badge';
import { formatTagLabel } from '../lib/filter-utils';
import { StepList } from './StepList';
import { Tag, Images, Paperclip, Clock } from 'lucide-react';
import { useState, useMemo } from 'react';
import { AttachmentViewer } from './AttachmentViewer';
import { collectScenarioAttachments } from '../utils/gallery';
import { formatDuration } from '../lib/status-utils';
import type { GalleryItem } from '../utils/gallery';

export interface ScenarioBlockProps {
  label: 'Scenario' | 'Scenario Outline' | 'Background' | 'Rule' | 'Rule Outline';
  title: React.ReactNode;
  status?: Status;
  description?: string;
  tags?: string[];
  steps?: StepTest[];
  highlightValues?: Record<string, string>;
  showDurations: boolean;
  showErrorStack: boolean;
  tone: 'scenario' | 'background';
  /** Scenario-level execution duration in ms */
  duration?: number;
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
  tone,
  duration
}: ScenarioBlockProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const bgClass = tone === 'background' ? 'bg-muted/20' : 'bg-card/60';

  // Collect all attachments across steps for the scenario gallery
  const galleryItems: GalleryItem[] = useMemo(() => {
    if (!steps || steps.length === 0) return [];
    return collectScenarioAttachments(steps);
  }, [steps]);

  const totalAttachments = galleryItems.length;
  const allAreImages = totalAttachments > 0 && galleryItems.every(
    (item) => item.kind === 'image' || item.kind === 'screenshot'
  );
  const GalleryIcon = allAreImages ? Images : Paperclip;

  // Find first failed step for smart default opening
  const firstFailedStepIndex = useMemo(() => {
    if (!steps) return 0;
    const failedIdx = steps.findIndex((s) => s.execution?.status === 'failed');
    return failedIdx >= 0 ? failedIdx : 0;
  }, [steps]);

  const initialGalleryIndex = useMemo(() => {
    if (totalAttachments === 0) return 0;
    let count = 0;
    for (let i = 0; i < firstFailedStepIndex && i < (steps?.length ?? 0); i++) {
      const stepAttachments = steps![i].execution?.attachments?.length ?? 0;
      count += stepAttachments;
    }
    return count;
  }, [firstFailedStepIndex, steps, totalAttachments]);

  return (
    <Card className={`border-none shadow-none ${bgClass}`}>
      <CardContent className="p-0">
        <div className="py-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-xl font-bold tracking-tight">
              <span className="text-muted-foreground font-semibold">{label}:</span>{' '}
              {title}
            </h2>
            <div className="flex items-center gap-2">
              {totalAttachments > 0 && (
                <button
                  onClick={() => setGalleryOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground group"
                  title={`View all ${totalAttachments} attachment${totalAttachments > 1 ? 's' : ''} across this scenario`}
                >
                  <GalleryIcon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">{totalAttachments}</span>
                </button>
              )}
              {showDurations && duration !== undefined && duration > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground/50">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(duration)}
                </span>
              )}
              {status && <StatusBadge status={status} size="lg" showLabel />}
            </div>
          </div>

          {description && (
            <Markdown content={description} className="text-sm text-muted-foreground mb-4" />
          )}

          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                  <Tag className="w-3 h-3 mr-1 opacity-60" />
                  {formatTagLabel(tag)}
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
              galleryItems={galleryItems}
            />
          )}
        </div>
      </CardContent>

      {totalAttachments > 0 && (
        <AttachmentViewer
          attachments={galleryItems}
          initialIndex={initialGalleryIndex}
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
        />
      )}
    </Card>
  );
}
