import type { Run } from '../store';
import type { TestCase, AnyTest } from '@swedevtools/livedoc-schema';

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

/**
 * Builds a URL hash string from the current navigation state.
 * Returns '' for the summary (home) view.
 */
export function buildHash(view: DeepLinkView, run: Run | undefined): string {
  if (!run || view.type === 'summary') return '';

  if (view.type === 'group' && view.id) {
    // Group ids are "group:path/segments" — extract the path
    const path = view.id.replace(/^group:/, '');
    return `#/group/${path}`;
  }

  if (view.type === 'node' && view.id) {
    const item = run.itemById[view.id];
    if (!item) return '';

    // Check if this is a top-level document (TestCase/Feature/Specification)
    const doc = findDocumentForItem(run, view.id);
    if (!doc) return '';

    if (doc.id === view.id) {
      // Navigating to a document itself
      return `#/${toSlug(doc.title)}`;
    }

    // Navigating to a child test within a document
    return `#/${toSlug(doc.title)}/${toSlug(item.title)}`;
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

  // Strip leading #/
  const path = hash.replace(/^#\/?/, '');
  if (!path) return { type: 'summary' };

  // Group paths: /group/path/segments
  if (path.startsWith('group/')) {
    const groupPath = path.slice('group/'.length);
    return { type: 'group', id: `group:${groupPath}` };
  }

  if (!run) return null; // Data not loaded yet

  const segments = path.split('/').filter(Boolean);

  if (segments.length === 1) {
    // Document-level slug
    const docSlug = segments[0];
    const doc = findDocumentBySlug(run, docSlug);
    if (doc) return { type: 'node', id: doc.id };
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

// ── Lookup helpers ──────────────────────────────────────────────

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
