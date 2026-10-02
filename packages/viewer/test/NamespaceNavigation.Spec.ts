import { expect } from 'vitest';
import { rule, ruleOutline, specification } from '@swedevtools/livedoc-vitest';
import type { TestCase } from '@swedevtools/livedoc-schema';
import { buildGroupedNavTree, findNavItemById, projectNavTree } from '../src/client/lib/nav-tree';
import { namespaceRun } from '../src/client/test-fixtures/namespace-report';
import { buildHash, resolveHash } from '../src/client/lib/deep-link';
import { makeRunState } from '../src/client/store';

function documents(paths: string[], kind = 'Standard'): TestCase[] {
  return paths.map((path, index) => ({
    id: `doc-${index}`, title: `Document ${index}`, path, kind, tests: [],
    statistics: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 },
  }));
}

specification(`Common Root Display Projection
  @navigation
  Navigation skips redundant shared folders while keeping canonical report identities and saved navigation intact.
`, () => {
  ruleOutline(`The <kind> paths 'Acme/Commerce/Quotes/Services/Transactor/UnitTests/Authentication/A.cs' and 'Acme/Commerce/Quotes/Services/Transactor/UnitTests/ResourceProviders/B.cs' show 'Authentication,ResourceProviders', retaining both full-path group identities
    Examples:
    | kind          |
    | Standard      |
    | Container     |
    | Feature       |
    | Specification |
  `, (ctx) => {
    const [first, second, roots] = ctx.rule.values as [string, string, string];
    const paths = [first, second];
    const source = documents(paths, ctx.example.kind);
    const tree = buildGroupedNavTree(source);
    const visible = projectNavTree(tree).sidebarItems;
    expect(visible.map(item => item.title)).toEqual(roots.split(','));
    expect(visible.map(item => item.id)).toEqual(paths.map(path => `group:${path.slice(0, path.lastIndexOf('/'))}`));
    expect(source.map(doc => doc.path)).toEqual(paths);
  });

  ruleOutline(`Framework <framework> with paths <first> and <second> retains visible roots <roots>
    Examples:
    | framework | first                                                    | second                                              | roots                  |
    | xunit     | Acme/Commerce/Auth/A.cs                                   | Other/Billing/B.cs                                   | Acme,Other             |
    | xunit     | Auth/A.cs                                                | B.cs                                                | Root,Auth,Document 1   |
    | xunit     | Acme/Commerce/Auth/A.cs                                   | Acme/Commerce/B.cs                                   | Auth,Document 1        |
    | vitest    | Acme/Commerce/Auth/A.Spec.ts                              | Acme/Commerce/Billing/B.Spec.ts                      | Auth,Billing           |
    | vitest    | Auth/A.Spec.ts                                           | Billing/B.Spec.ts                                   | Auth,Billing           |
    | vitest    | A.Spec.ts                                                | B.Spec.ts                                           | Root,Document 0,Document 1 |
    | vitest    | Auth/A.Spec.ts                                           | B.Spec.ts                                           | Root,Auth,Document 1   |
    | vitest    | Acme/Commerce/Auth/A.Spec.ts                              | Acme/Commerce/B.Spec.ts                              | Auth,Document 1        |
    | mixed     | Acme/Commerce/Auth/A.cs                                   | Acme/Commerce/Billing/B.Spec.ts                      | Auth,Billing           |
    | unknown   | Acme/Commerce/Auth/A.cs                                   | Acme/Commerce/Billing/B.cs                           | Auth,Billing           |
  `, (ctx) => {
    const run = { ...namespaceRun(), framework: ctx.example.framework, documents: documents([ctx.example.first, ctx.example.second]) };
    const tree = buildGroupedNavTree(run.documents);
    expect(projectNavTree(tree).sidebarItems.map(item => item.title))
      .toEqual(String(ctx.example.roots).split(','));
  });

  rule("An empty run displays '0' sidebar entries and '0' breadcrumbs for missing 'doc-0'", (ctx) => {
    const [entries, crumbs, missing] = ctx.rule.values as [number, number, string];
    const projected = projectNavTree(buildGroupedNavTree([]));
    expect(projected.sidebarItems).toHaveLength(entries);
    expect(projected.breadcrumbs(missing)).toHaveLength(crumbs);
  });

  rule("A single document at 'Acme/Commerce/Tests/Check.cs' displays 'Document 0' with canonical ID 'doc-0'", (ctx) => {
    const [path, title, id] = ctx.rule.values as [string, string, string];
    const tree = buildGroupedNavTree(documents([path]));
    const projected = projectNavTree(tree);
    expect(projected.sidebarItems.map(item => ({ id: item.id, title: item.title }))).toEqual([{ id, title }]);
    expect(projected.breadcrumbs(id).map(item => item.title)).toEqual(['Root', title]);
  });

  rule("Branching at 'Acme/Tests' retains 'Billing/Lifecycle/Renewals' beside 'Authentication' without losing direct 'Document 2'", (ctx) => {
    const [prefix, branch, sibling, direct] = ctx.rule.values as [string, string, string, string];
    const tree = buildGroupedNavTree(documents([
      `${prefix}/${branch}/A.cs`, `${prefix}/${sibling}/B.cs`, `${prefix}/C.cs`,
    ]));
    const projected = projectNavTree(tree);
    expect(projected.sidebarItems.map(item => item.title)).toEqual([sibling, branch.split('/')[0], direct]);
    expect(findNavItemById(tree, `group:${prefix}/${branch}`)?.children.map(item => item.id)).toEqual(['doc-0']);
    expect(projected.breadcrumbs('doc-0').map(item => item.title)).toEqual(['Root', ...branch.split('/'), 'Document 0']);
  });

  ruleOutline(`Framework <framework> hidden ancestor 'group:Acme/Commerce/Quotes' round-trips through '#/group/Acme/Commerce/Quotes' and opens 'Authentication,ResourceProviders'
    Examples:
    | framework |
    | xunit     |
    | vitest    |
    | unknown   |
  `, (ctx) => {
    const [id, hash, roots] = ctx.rule.values as [string, string, string];
    const source = namespaceRun();
    source.framework = ctx.example.framework;
    const run = makeRunState(source);
    const tree = buildGroupedNavTree(run.run.documents);
    const ancestor = findNavItemById(tree, id);
    expect(ancestor).toBeDefined();
    expect(resolveHash(hash, run)).toEqual({ type: 'group', id });
    expect(buildHash({ type: 'group', id }, run)).toBe(hash);
    expect(projectNavTree(tree).childrenOf(ancestor!).map(item => item.title)).toEqual(roots.split(','));
    expect(run.run.summary.total).toBe(run.run.documents.length);
  });
});
