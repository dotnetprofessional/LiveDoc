import { useState } from 'react';
import type { Attachment, DataTable, StepTest, Status, TypedValue } from '@swedevtools/livedoc-schema';
import { bindPlaceholdersInText, renderTitle, highlightPlaceholders } from '../lib/title-utils';
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, Clock, Camera, Paperclip } from 'lucide-react';
import { cn } from '../lib/utils';
import { Markdown } from './Markdown';
import { ErrorDisplay } from './ErrorDisplay';
import { AttachmentViewer } from './AttachmentViewer';
import type { GalleryItem } from '../utils/gallery';

type NormalizedCell = {
  text: string;
  type: TypedValue['type'] | 'unknown';
};

type NormalizedDataTable = {
  headers: string[];
  rows: NormalizedCell[][];
  columnAlign: Array<'left' | 'right' | 'center'>;
};

function isValueLikeHeader(text: string): boolean {
  const t = String(text ?? '').trim();
  if (t.length === 0) return true;
  if (/^(true|false|null|undefined)$/i.test(t)) return true;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return true;
  // ISO-ish datetime
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const d = new Date(t);
    return !Number.isNaN(d.getTime());
  }
  return false;
}

function isLikelyKey(text: string): boolean {
  const t = String(text ?? '').trim();
  if (t.length === 0) return false;
  if (t.length > 50) return false;
  // Conservative: typical identifiers/labels (no punctuation-heavy strings)
  return /^[A-Za-z][A-Za-z0-9_\- ]*$/.test(t);
}

function shouldRenderTwoColumnVerticalTable(table: NormalizedDataTable): boolean {
  if (table.headers.length !== 2) return false;
  if (!isValueLikeHeader(table.headers[1])) return false;

  const keys = table.rows
    .map((r) => String(r?.[0]?.text ?? '').trim())
    .filter(Boolean);

  if (keys.length < 2) return false;
  const keyishRatio = keys.filter(isLikelyKey).length / keys.length;
  if (keyishRatio < 0.8) return false;

  const uniq = new Set(keys.map((k) => k.toLowerCase()));
  if (uniq.size !== keys.length) return false;

  return true;
}

interface StepListProps {
  steps: StepTest[];
  showStatus?: boolean;
  /** Optional example values to highlight in rendered titles (ScenarioOutline / RuleOutline examples) */
  highlightValues?: Record<string, string>;
  /** Optional example values to bind into descriptions on selection (ScenarioOutline / RuleOutline) */
  bindValues?: Record<string, string>;
  /** Hide per-step durations (Business mode default) */
  showDurations?: boolean;
  /** Show stack traces for failures (Developer mode default) */
  showErrorStack?: boolean;
  /** Scenario-level gallery items for unified entry */
  galleryItems?: GalleryItem[];
}

export function StepList({ steps, showStatus = true, highlightValues, bindValues, showDurations = true, showErrorStack = true, galleryItems }: StepListProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <StepItem 
          key={index} 
          step={step} 
          stepIndex={index}
          showStatus={showStatus} 
          highlightValues={highlightValues} 
          bindValues={bindValues} 
          showDurations={showDurations} 
          showErrorStack={showErrorStack}
          galleryItems={galleryItems}
        />
      ))}
    </div>
  );
}

interface StepItemProps {
  step: StepTest;
  stepIndex: number;
  showStatus?: boolean;
  highlightValues?: Record<string, string>;
  bindValues?: Record<string, string>;
  showDurations?: boolean;
  showErrorStack?: boolean;
  galleryItems?: GalleryItem[];
}

function StepItem({ step, stepIndex, showStatus = true, highlightValues, bindValues, showDurations = true, showErrorStack = true, galleryItems }: StepItemProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const allAttachments = step.execution?.attachments ?? [];

  const allAreImages = allAttachments.length > 0 && allAttachments.every(
    (a: Attachment) => a.kind === 'image' || a.kind === 'screenshot'
  );
  const AttachmentIcon = allAreImages ? Camera : Paperclip;
  const attachmentLabel = allAreImages
    ? `${allAttachments.length} screenshot${allAttachments.length > 1 ? 's' : ''}`
    : `${allAttachments.length} attachment${allAttachments.length > 1 ? 's' : ''}`;

  // Calculate initial index for scenario gallery
  const initialIndexInGallery = galleryItems ? galleryItems.findIndex(item => item.stepIndex === stepIndex) : -1;
  const useScenarioGallery = galleryItems && galleryItems.length > 0 && initialIndexInGallery >= 0;

  const handleAttachmentClick = () => {
    setLightboxOpen(true);
  };

  const typeColors: Record<string, string> = {
    given: 'text-given',
    when: 'text-when',
    then: 'text-then',
    and: 'text-muted-foreground/60',
    but: 'text-destructive/60',
  };


  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="w-4 h-4 text-pass" />;
      case 'failed': return <XCircle className="w-4 h-4 text-fail" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-pending" />;
      default: return <HelpCircle className="w-4 h-4 text-muted-foreground/40" />;
    }
  };

  const normalizedTable = normalizeDataTable(step.dataTables?.[0]);
  const keyword = step.keyword?.toLowerCase() || '';
  const isContinuation = ['and', 'but'].includes(keyword);

  const status = (step as any)?.execution?.status as Status | undefined;
  const duration = typeof (step as any)?.execution?.duration === 'number' ? (step as any).execution.duration as number : 0;

  const description = typeof step.description === 'string' ? step.description : undefined;
  const boundDescription =
    description && bindValues && Object.keys(bindValues).length > 0
      ? bindPlaceholdersInText(description, bindValues)
      : description;

  return (
    <div className="group relative flex items-start gap-2 py-1 -mx-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
      {/* 1. Status Column (Fixed Width) */}
      <div className="shrink-0 w-5 flex justify-center pt-0.5">
        {showStatus && getStatusIcon(status ?? 'pending')}
      </div>

      {/* 2. Keyword Column (Fixed Width, Right Aligned) */}
      <div className={cn(
        "shrink-0 w-14 text-right select-none",
        "font-medium text-sm",
        isContinuation && "pr-0",
        typeColors[keyword] || 'text-muted-foreground'
      )}>
        {keyword}
      </div>

      {/* 3. Content Column (Flexible) */}
      <div className="flex-1 min-w-0">
        {/* Title Row */}
        <div className="flex items-baseline justify-between gap-4">
           <div className="text-sm leading-relaxed text-foreground/90 font-medium">
             {renderTitle(step.title, highlightValues)}
           </div>

           {allAttachments.length > 0 && (
             <button
               onClick={handleAttachmentClick}
               className="shrink-0 inline-flex items-center gap-1 text-muted-foreground/50 hover:text-primary transition-colors"
               title={attachmentLabel}
             >
               <AttachmentIcon className="w-3.5 h-3.5" />
               {allAttachments.length > 1 && (
                 <span className="text-[10px] font-bold">{allAttachments.length}</span>
               )}
             </button>
           )}
           
           {showDurations && duration > 0 && (
            <span className="shrink-0 text-[10px] font-bold text-muted-foreground/40 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Clock className="w-3 h-3" />
              {duration}ms
            </span>
          )}
        </div>

        {boundDescription && (
          <div className="mt-2 -ml-16 pl-4 border-l-2 border-muted">
             <Markdown
               content={boundDescription}
               highlightValues={bindValues && Object.keys(bindValues).length > 0 ? bindValues : undefined}
               className="text-sm text-muted-foreground/80 italic leading-relaxed"
             />
          </div>
        )}

        {normalizedTable && (() => {
          const isVertical = shouldRenderTwoColumnVerticalTable(normalizedTable);

          const headerAsFirstRow: NormalizedCell[] | null = isVertical
            ? [
                { text: normalizedTable.headers[0], type: 'string' },
                { text: String(normalizedTable.headers[1] ?? ''), type: 'string' }
              ]
            : null;

          const rowsToRender = isVertical
            ? [headerAsFirstRow!, ...normalizedTable.rows]
            : normalizedTable.rows;

          const align = isVertical
            ? computeColumnAlign(rowsToRender, 2)
            : normalizedTable.columnAlign;

          return (
            // Hang-align the table under the status icon (not under the keyword column)
            <div className="mt-2 -ml-16 inline-block w-fit max-w-full sm:max-w-3xl align-top">
              <div className="rounded-lg max-w-full">
                <table className="table-auto text-xs border-collapse border border-foreground/25 max-w-full">
                  {!isVertical && (
                    <thead>
                      <tr className="bg-primary/10">
                        {normalizedTable.headers.map((h, idx) => {
                          const colAlign = align[idx] ?? 'left';
                          return (
                            <th
                              key={h}
                              className={cn(
                                'px-3 py-1.5 font-extrabold text-foreground/80 uppercase tracking-wide text-[11px] whitespace-nowrap border border-foreground/30 bg-primary/10',
                                colAlign === 'right' && 'text-right',
                                colAlign === 'center' && 'text-center',
                                colAlign === 'left' && 'text-left'
                              )}
                            >
                              {h}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                  )}

                  <tbody>
                    {rowsToRender.map((row, i) => (
                      <tr key={i} className={cn(!isVertical && 'border-t border-border/20')}>
                        {row.map((cell, cIdx) => {
                          const colAlign = align[cIdx] ?? 'left';
                          const isNumeric = cell.type === 'number';
                          const shouldWrap = cell.type === 'string' || cell.type === 'object' || cell.type === 'unknown';
                          const isKeyColumn = isVertical && cIdx === 0;

                          return (
                            <td
                              key={cIdx}
                              className={cn(
                                'px-3 py-1.5 border border-foreground/20 font-mono align-top',
                                isKeyColumn ? 'bg-primary/10 text-foreground/80 font-bold' : 'text-foreground/80',
                                colAlign === 'right' && 'text-right tabular-nums',
                                colAlign === 'center' && 'text-center',
                                colAlign === 'left' && 'text-left',
                                isNumeric && 'whitespace-nowrap',
                                shouldWrap ? 'whitespace-normal wrap-anywhere' : 'whitespace-nowrap'
                              )}
                            >
                              {cell.text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {step.execution?.error && (
          <ErrorDisplay
            error={step.execution.error}
            variant="inline"
            isBusiness={!showErrorStack}
            className="mt-2 -ml-16"
          />
        )}
      </div>

      {allAttachments.length > 0 && (
        <AttachmentViewer
          attachments={useScenarioGallery ? galleryItems! : allAttachments}
          initialIndex={useScenarioGallery ? initialIndexInGallery : 0}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </div>
  );
}

function formatTypedValue(v: TypedValue): NormalizedCell {
  if (typeof v?.displayFormat === 'string' && v.displayFormat.length > 0) {
    return { text: v.displayFormat, type: v.type ?? 'unknown' };
  }

  switch (v.type) {
    case 'string':
      return { text: String(v.value ?? ''), type: 'string' };
    case 'number':
      return { text: typeof v.value === 'number' ? String(v.value) : String(v.value ?? ''), type: 'number' };
    case 'boolean':
      return { text: typeof v.value === 'boolean' ? String(v.value) : String(v.value ?? ''), type: 'boolean' };
    case 'date': {
      if (typeof v.value === 'string') {
        const d = new Date(v.value);
        if (!Number.isNaN(d.getTime())) return { text: d.toISOString(), type: 'date' };
      }
      return { text: String(v.value ?? ''), type: 'date' };
    }
    case 'object': {
      try {
        return { text: JSON.stringify(v.value), type: 'object' };
      } catch {
        return { text: String(v.value ?? ''), type: 'object' };
      }
    }
    case 'null':
      return { text: 'null', type: 'null' };
    case 'undefined':
      return { text: 'undefined', type: 'undefined' };
    default:
      return { text: String((v as any)?.value ?? ''), type: 'unknown' };
  }
}
function computeColumnAlign(rows: NormalizedCell[][], columnCount: number): Array<'left' | 'right' | 'center'> {
  const align: Array<'left' | 'right' | 'center'> = [];
  for (let c = 0; c < columnCount; c++) {
    const col = rows.map((r) => r[c]).filter(Boolean);
    const allNumbers = col.length > 0 && col.every((cell) => cell.type === 'number');
    const allBooleans = col.length > 0 && col.every((cell) => cell.type === 'boolean');
    if (allNumbers) align[c] = 'right';
    else if (allBooleans) align[c] = 'center';
    else align[c] = 'left';
  }
  return align;
}

function normalizeDataTable(dataTable: DataTable | undefined): NormalizedDataTable | null {
  if (!dataTable) return null;

  const headers = (dataTable.headers ?? []).map((h) => String(h ?? ''));
  const rowValues = (dataTable.rows ?? []).map((r) => (r?.values ?? []).map((v) => formatTypedValue(v)));

  const columnCount = Math.max(headers.length, ...rowValues.map((r) => r.length));
  const paddedRows = rowValues.map((r) => {
    const copy = r.slice();
    while (copy.length < columnCount) copy.push({ text: '', type: 'unknown' });
    return copy;
  });

  const columnAlign = computeColumnAlign(paddedRows, columnCount);
  return { headers, rows: paddedRows, columnAlign };
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
    And: 'text-muted-foreground/70',
    But: 'text-destructive/70',
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const isContinuation = ['and', 'but'].includes(step.type.toLowerCase());
        return (
          <div key={index} className={cn("flex items-baseline gap-3 pl-8 py-1", isContinuation && "ml-8")}>
            <span className={cn(
              "font-black text-[10px] uppercase tracking-[0.2em] shrink-0 w-16",
              typeColors[step.type] || 'text-muted-foreground'
            )}>
              {step.type}
            </span>
            <span className="text-[15px] text-foreground/80 font-medium">
              {highlightPlaceholders(step.title)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
