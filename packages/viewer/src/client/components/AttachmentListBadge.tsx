import { useState } from 'react';
import { Paperclip } from 'lucide-react';
import type { AnyTest, RuleOutlineTest, ScenarioTest } from '@swedevtools/livedoc-schema';
import { AttachmentViewer } from './AttachmentViewer';
import { Button } from './ui/button';

export function AttachmentListBadge({ node }: { node: AnyTest }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const kind = String(node.kind).toLowerCase();

  if (kind === 'rule') {
    const attachments = node.execution?.attachments ?? [];
    if (attachments.length === 0) return null;

    const label = `View ${attachments.length} attachment${attachments.length === 1 ? '' : 's'} for rule ${node.title}`;
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="pointer-events-auto relative z-10 h-7 shrink-0 gap-1.5 bg-background px-2 text-xs tabular-nums"
          aria-label={label}
          title={label}
          onClick={() => setGalleryOpen(true)}
        >
          <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
          {attachments.length}
        </Button>
        <AttachmentViewer attachments={attachments} open={galleryOpen} onOpenChange={setGalleryOpen} />
      </>
    );
  }

  let count = 0;
  let label = '';
  if (kind === 'ruleoutline') {
    const outline = node as RuleOutlineTest;
    const rowIds = new Set(outline.examples?.flatMap((table) => table.rows.map((row) => row.rowId)) ?? []);
    const templateSteps = outline.template?.children ?? outline.template?.steps ?? outline.steps ?? [];
    const stepIds = new Set(templateSteps.map((step) => step.id));
    const rowsWithEvidence = new Set<number>();
    for (const entry of outline.exampleResults ?? []) {
      const rowId = entry.result?.rowId;
      if (rowId === undefined || !rowIds.has(rowId)) continue;
      if (entry.testId !== outline.id && !stepIds.has(entry.testId)) continue;
      if (entry.result.attachments?.length) rowsWithEvidence.add(rowId);
    }
    count = rowsWithEvidence.size;
    label = `${count} example${count === 1 ? '' : 's'} with attachments in rule outline ${node.title}`;
  } else if (kind === 'scenario') {
    const scenario = node as ScenarioTest;
    count = (scenario.execution?.attachments?.length ?? 0)
      + (scenario.steps ?? []).reduce((sum, step) => sum + (step.execution?.attachments?.length ?? 0), 0);
    label = `${count} attachment${count === 1 ? '' : 's'} in scenario ${node.title} and its steps`;
  }

  if (count === 0) return null;
  return (
    <span
      role="note"
      aria-label={label}
      title={label}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-muted/60 px-2 text-xs font-medium tabular-nums text-muted-foreground"
    >
      <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
      {count}
    </span>
  );
}
