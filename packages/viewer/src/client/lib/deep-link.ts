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
  type: 'summary' | 'node' | 'group' | 'coverage';
  id?: string;
}

/** Which projection of a partial run's data the deep link points at. Missing/'combined' is the default. */
export type DeepLinkRunView = 'combined' | 'physical';

export interface DeepLinkContext {
  project?: string;
  environment?: string;
  runId?: string;
  runGroupId?: string;
  sourceRunIds?: string[];
  runView?: DeepLinkRunView;
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
  /** Present only when the hash explicitly requested 'physical'; otherwise callers should default to 'combined'. */
  runView?: DeepLinkRunView;
}

/**
 * Builds a URL hash string from the current navigation state.
 * Returns '' for the summary (home) view.
 *
 * `runView` is UI-only selection state (not part of TestRunV1) — when 'physical', it is appended
 * as a `?view=physical` suffix so partial-run projection selection round-trips through deep links.
 * Omitting it (or passing 'combined') keeps the hash in its original, backward-compatible form.
 */
export function buildHash(
  view: DeepLinkView,
  run: Run | undefined,
  runViewOrContext?: DeepLinkRunView | DeepLinkContext
): string {
  const base = buildBaseHash(view, run);
  const context = typeof runViewOrContext === 'string'
    ? { runView: runViewOrContext }
    : runViewOrContext;
  const params = new URLSearchParams();

  if (context?.project) params.set('project', context.project);
  if (context?.environment) params.set('environment', context.environment);
  if (context?.runId) params.set('run', context.runId);
  if (context?.runGroupId) params.set('group', context.runGroupId);
  for (const sourceRunId of context?.sourceRunIds ?? []) {
    params.append('sourceRun', sourceRunId);
  }
  if (context?.runView === 'physical') params.set('view', 'physical');

  if (params.size === 0) return base;
  if (!base && !context?.runId && !context?.runGroupId) return '';
  return `${base || '#/'}?${params.toString()}`;
}

function buildBaseHash(view: DeepLinkView, run: Run | undefined): string {
  if (!run || view.type === 'summary') return '';

  if (view.type === 'coverage') return '#/coverage';

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
  type: 'summary' | 'node' | 'group' | 'coverage';
  id?: string;
}

/**
 * Extracts the `?view=physical` query suffix (if present) from a hash and returns it alongside
 * the query-stripped hash. Any other query value, or no query at all, resolves to 'combined'.
 */
function splitHashQuery(hash: string): { hash: string; params: URLSearchParams } {
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return { hash, params: new URLSearchParams() };

  const query = hash.slice(queryIndex + 1);
  return { hash: hash.slice(0, queryIndex), params: new URLSearchParams(query) };
}

export function parseDeepLinkContext(hash: string): DeepLinkContext {
  const { params } = splitHashQuery(hash);
  const runView: DeepLinkRunView = params.get('view') === 'physical' ? 'physical' : 'combined';
  return {
    project: params.get('project') || undefined,
    environment: params.get('environment') || undefined,
    runId: params.get('run') || undefined,
    runGroupId: params.get('group') || undefined,
    sourceRunIds: params.getAll('sourceRun').filter(Boolean),
    ...(runView === 'physical' ? { runView } : {}),
  };
}

/**
 * Parses a URL hash and resolves it to a navigation view.
 * Returns null if the hash can't be resolved (item not found).
 * Tolerates (and ignores) a `?view=...` projection suffix — use `resolveHashAgainstCandidates`
 * to also recover that projection selection.
 */
export function resolveHash(hash: string, run: Run | undefined): ResolvedView | null {
  const { hash: cleanHash } = splitHashQuery(hash);

  if (!cleanHash || cleanHash === '#' || cleanHash === '#/') {
    return { type: 'summary' };
  }

  const path = decodeHashPath(cleanHash);
  if (!path) return { type: 'summary' };

  if (!run) return null; // Data not loaded yet

  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'coverage') {
    return { type: 'coverage' };
  }

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
  const { hash: cleanHash } = splitHashQuery(hash);
  const context = parseDeepLinkContext(hash);
  const hasExplicitTarget = Boolean(
    context.runId ||
    context.runGroupId ||
    context.project ||
    context.environment
  );
  const contextualCandidates = candidates.filter((candidate) => {
    if (context.runGroupId && candidate.runGroupId !== context.runGroupId) return false;
    if (context.runId && candidate.runId !== context.runId) return false;
    if (context.project && candidate.run.run.project !== context.project) return false;
    if (context.environment && candidate.run.run.environment !== context.environment) return false;
    return true;
  });

  if (!cleanHash || cleanHash === '#' || cleanHash === '#/') {
    if (hasExplicitTarget && contextualCandidates.length === 0) return null;
    const candidate = contextualCandidates[0];
    return {
      view: { type: 'summary' },
      runId: candidate?.runId,
      runGroupId: candidate?.runGroupId,
      ...(context.runView === 'physical' ? { runView: context.runView } : {}),
    };
  }

  if (hasExplicitTarget && contextualCandidates.length === 0) return null;

  for (const candidate of contextualCandidates) {
    const view = resolveHash(cleanHash, candidate.run);
    if (view) {
      return {
        view,
        runId: candidate.runId,
        runGroupId: candidate.runGroupId,
        ...(context.runView === 'physical' ? { runView: context.runView } : {}),
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
