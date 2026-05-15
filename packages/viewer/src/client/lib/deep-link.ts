import type { Run } from '../store';
import type { TestCase, AnyTest } from '@swedevtools/livedoc-schema';
import { buildGroupedNavTree, findNavItemById } from './nav-tree';

/**
 * Converts a title string to a URL-friendly slug.
 * e.g. "Browser launches & provides valid Playwright objects" → "browser-launches-provides-valid-playwright-objects"
 */
export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')           // remove apostrophes
    .replace(/[^a-z0-9]+/g, '-')   // replace non-alphanumeric runs with hyphens
    .replace(/^-+|-+$/g, '');       // trim leading/trailing hyphens
}

// ── Build hash from current view state ──────────────────────────

export interface DeepLinkView {
  type: 'summary' | 'node' | 'group';
  id?: string;
}

export interface DeepLinkCandidate {
  run: Run;
  runId?: string;
  runGroupId?: string;
}

export interface DeepLinkResolution {
  view: ResolvedView;
  runId?: string;
  runGroupId?: string;
}

/**
 * Builds a URL hash string from the current navigation state.
 * Returns '' for the summary (home) view.
 */
export function buildHash(view: DeepLinkView, run: Run | undefined): string {
  if (!run || view.type === 'summary') return '';

  if (view.type === 'group' && view.id) {
    if (view.id.startsWith('group:')) {
      const path = view.id.replace(/^group:/, '').replace(/^\/+|\/+$/g, '');
      return path ? `#/group/${encodePath(path)}` : '#/group';
    }

    return buildNodeHash(view.id, run);
  }

  if (view.type === 'node' && view.id) {
    return buildNodeHash(view.id, run);
  }

  return '';
}

// ── Resolve hash back to a view ─────────────────────────────────

export interface ResolvedView {
  type: 'summary' | 'node' | 'group';
  id?: string;
}

/**
 * Parses a URL hash and resolves it to a navigation view.
 * Returns null if the hash can't be resolved (item not found).
 */
export function resolveHash(hash: string, run: Run | undefined): ResolvedView | null {
  if (!hash || hash === '#' || hash === '#/') {
    return { type: 'summary' };
  }

  const path = decodeHashPath(hash);
  if (!path) return { type: 'summary' };

  if (!run) return null; // Data not loaded yet

  const segments = path.split('/').filter(Boolean);

  // Group paths: /group/path/segments
  if (segments[0] === 'group') {
    const groupPath = segments.slice(1).join('/');
    const groupId = groupPath ? `group:${groupPath}` : 'group:/';
    const group = findGroupById(run, groupId);
    return group ? { type: 'group', id: group.id } : null;
  }

  if (segments.length === 1) {
    // Document-level slug
    const docSlug = segments[0];
    const doc = findDocumentBySlug(run, docSlug);
    if (doc) return { type: 'group', id: doc.id };
    return null;
  }

  if (segments.length === 2) {
    // Document/test slug
    const [docSlug, testSlug] = segments;
    const doc = findDocumentBySlug(run, docSlug);
    if (!doc) return null;

    const test = findTestBySlug(doc, testSlug);
    if (test) return { type: 'node', id: test.id };
    return null;
  }

  return null;
}

export function resolveHashAgainstCandidates(hash: string, candidates: DeepLinkCandidate[]): DeepLinkResolution | null {
  if (!hash || hash === '#' || hash === '#/') {
    return { view: { type: 'summary' } };
  }

  for (const candidate of candidates) {
    const view = resolveHash(hash, candidate.run);
    if (view) {
      return {
        view,
        runId: candidate.runId,
        runGroupId: candidate.runGroupId,
      };
    }
  }

  return null;
}

// ── Lookup helpers ──────────────────────────────────────────────

function buildNodeHash(itemId: string, run: Run): string {
  const item = run.itemById[itemId];
  if (!item) return '';

  const doc = findDocumentForItem(run, itemId);
  if (!doc) return '';

  if (doc.id === itemId) {
    return `#/${toSlug(doc.title)}`;
  }

  return `#/${toSlug(doc.title)}/${toSlug(item.title)}`;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function decodeHashPath(hash: string): string {
  const path = hash.replace(/^#\/?/, '').replace(/^\/+|\/+$/g, '');

  try {
    return path
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    return path;
  }
}

function findGroupById(run: Run, groupId: string): { id: string } | undefined {
  const navTree = buildGroupedNavTree(run.run.documents ?? []);
  const exact = findNavItemById(navTree, groupId);
  if (exact?.kind === 'Group') return exact;

  const target = groupId.toLowerCase();
  const stack = [...navTree];
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) continue;
    if (item.kind === 'Group' && item.id.toLowerCase() === target) return item;
    stack.push(...item.children);
  }

  return undefined;
}

function findDocumentForItem(run: Run, itemId: string): TestCase | undefined {
  for (const doc of run.run.documents ?? []) {
    if (doc.id === itemId) return doc;
    if (hasDescendant(doc, itemId)) return doc;
  }
  return undefined;
}

function hasDescendant(doc: TestCase, itemId: string): boolean {
  // Check background
  const bg = (doc as any).background;
  if (bg) {
    if (bg.id === itemId) return true;
    if (Array.isArray(bg.steps)) {
      for (const step of bg.steps as AnyTest[]) {
        if (step.id === itemId) return true;
      }
    }
  }
  for (const test of doc.tests ?? []) {
    if (test.id === itemId) return true;
    if ('steps' in test && Array.isArray((test as any).steps)) {
      for (const step of (test as any).steps as AnyTest[]) {
        if (step.id === itemId) return true;
      }
    }
  }
  return false;
}

function findDocumentBySlug(run: Run, slug: string): TestCase | undefined {
  return (run.run.documents ?? []).find(doc => toSlug(doc.title) === slug);
}

function findTestBySlug(doc: TestCase, slug: string): AnyTest | undefined {
  // Check background and its steps
  const bg = (doc as any).background as AnyTest | undefined;
  if (bg) {
    if (toSlug(bg.title) === slug) return bg;
    if (Array.isArray((bg as any).steps)) {
      for (const step of (bg as any).steps as AnyTest[]) {
        if (toSlug(step.title) === slug) return step;
      }
    }
  }
  for (const test of doc.tests ?? []) {
    if (toSlug(test.title) === slug) return test;
    // Check nested steps/rules
    if ('steps' in test && Array.isArray((test as any).steps)) {
      for (const step of (test as any).steps as AnyTest[]) {
        if (toSlug(step.title) === slug) return step;
      }
    }
  }
  return undefined;
}
