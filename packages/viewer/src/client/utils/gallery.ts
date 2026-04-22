import type { StepTest, Status } from '@swedevtools/livedoc-schema';
import type { AttachmentItem } from '../components/AttachmentViewer';

// ---------------------------------------------------------------------------
// Gallery Types
// ---------------------------------------------------------------------------

export interface GalleryItem extends AttachmentItem {
  stepIndex: number;
  stepKeyword: string;
  stepTitle: string;
  stepStatus: Status;
}

export interface StepGroup {
  stepIndex: number;
  keyword: string;
  title: string;
  status: Status;
  attachments: GalleryItem[];
  startIndex: number; // flat index of first attachment in this group
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

/**
 * Collects all attachments across scenario steps, enriched with step context.
 * Returns a flat array of GalleryItem[], preserving step order.
 */
export function collectScenarioAttachments(steps: StepTest[]): GalleryItem[] {
  const items: GalleryItem[] = [];

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    const attachments = step.execution?.attachments ?? [];
    const status = (step.execution?.status ?? 'pending') as Status;
    const keyword = step.keyword || 'given';
    const title = step.title || '';

    for (const att of attachments) {
      items.push({
        ...att,
        stepIndex,
        stepKeyword: keyword,
        stepTitle: title,
        stepStatus: status,
      });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Groups gallery items by step, preserving step order.
 * Each group includes metadata and a startIndex into the flat array.
 */
export function groupByStep(items: GalleryItem[]): StepGroup[] {
  const groups: StepGroup[] = [];
  const seenSteps = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const stepIndex = item.stepIndex;

    if (seenSteps.has(stepIndex)) {
      // Add to existing group
      const group = groups.find((g) => g.stepIndex === stepIndex);
      if (group) group.attachments.push(item);
    } else {
      // Create new group
      seenSteps.add(stepIndex);
      groups.push({
        stepIndex,
        keyword: item.stepKeyword,
        title: item.stepTitle,
        status: item.stepStatus,
        attachments: [item],
        startIndex: i,
      });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Navigation Helpers
// ---------------------------------------------------------------------------

/**
 * Finds the step group containing the given flat index.
 */
export function findGroupAtIndex(groups: StepGroup[], flatIndex: number): StepGroup | undefined {
  for (const group of groups) {
    const endIndex = group.startIndex + group.attachments.length;
    if (flatIndex >= group.startIndex && flatIndex < endIndex) {
      return group;
    }
  }
  return undefined;
}

/**
 * Jumps to the first attachment of the prev/next step group.
 */
export function jumpToAdjacentGroup(
  groups: StepGroup[],
  currentIndex: number,
  direction: 'prev' | 'next'
): number | null {
  const currentGroup = findGroupAtIndex(groups, currentIndex);
  if (!currentGroup) return null;

  const currentGroupIndex = groups.indexOf(currentGroup);
  const targetIndex = direction === 'prev' ? currentGroupIndex - 1 : currentGroupIndex + 1;

  if (targetIndex < 0 || targetIndex >= groups.length) return null;

  return groups[targetIndex].startIndex;
}
