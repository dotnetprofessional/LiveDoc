import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { rule, ruleOutline, specification } from '@swedevtools/livedoc-vitest';
import { useBrowser } from '@swedevtools/livedoc-vitest/playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildGroupedNavTree, findNavItemById } from '../src/client/lib/nav-tree';
import { standardRun } from '../src/client/test-fixtures/standard-report';
import { validateTestRunData } from '../src/client/lib/run-validation';
import { buildHash, resolveHash } from '../src/client/lib/deep-link';
import { makeRunState, useStore } from '../src/client/store';
import { createServer as createLiveDocServer, type LiveDocServer } from '@swedevtools/livedoc-server';
import { serve } from '@hono/node-server';
import { mkdir, rm } from 'node:fs/promises';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { TestRunV1 } from '@swedevtools/livedoc-schema';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChildrenList } from '../src/client/components/nodeviews/ChildrenList';
import { getKindPresentation } from '../src/client/lib/kind-presentation';
import { FileText } from 'lucide-react';

const { page } = useBrowser();
let server: ViteDevServer;
let baseUrl: string;
let api: LiveDocServer;
let apiUrl: string;
let savedRunId: string;
let httpServer: ReturnType<typeof serve>;
const dataDir = resolve(process.cwd(), '.livedoc', `native-test-contract-${process.pid}`);

async function post(path: string, body: unknown): Promise<Response> {
  return api.getApp().request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForPresentation(): Promise<void> {
  await page().waitForFunction(() => [...document.querySelectorAll('h1, h2, h3')].every(heading => {
    for (let node: Element | null = heading; node; node = node.parentElement) {
      if (Number(getComputedStyle(node).opacity) < 0.99) return false;
    }
    return true;
  }));
}

beforeAll(async () => {
  page().setDefaultTimeout(5_000);
  page().setDefaultNavigationTimeout(20_000);
  server = await createServer({
    configFile: false,
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../src/client'),
    plugins: [react(), tailwindcss()],
    define: { __LIVEDOC_VIEWER_VERSION__: JSON.stringify('test') },
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Native test fixture has no port');
  baseUrl = `http://127.0.0.1:${address.port}/standard-tests-fixture.html`;
  await mkdir(dirname(dataDir), { recursive: true });
  await mkdir(dataDir);
  api = createLiveDocServer({ dataDir });
  await api.getRunStore().initialize();
  const source = standardRun();
  const started = await post('/api/v1/runs/start', {
    project: source.project, environment: source.environment, framework: source.framework, runType: 'full',
  });
  expect(started.status).toBe(201);
  savedRunId = (await started.json()).runId;
  const completed = await post(`/api/v1/runs/${savedRunId}/testcases/batch`, {
    testCases: source.documents,
    complete: { status: source.status, duration: source.duration, summary: source.summary },
  });
  expect(completed.status).toBe(200);
  // Reload persisted JSON through the same public server/store contract used at startup.
  api = createLiveDocServer({ dataDir });
  await api.getRunStore().initialize();
  httpServer = serve({ fetch: api.getApp().fetch, hostname: '127.0.0.1', port: 0 });
  if (!httpServer.listening) await once(httpServer, 'listening');
  apiUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server?.close();
  httpServer?.closeAllConnections();
  if (httpServer) await new Promise<void>((resolveClose, reject) => httpServer.close(error => error ? reject(error) : resolveClose()));
  await rm(dataDir, { recursive: true, force: true });
});

afterEach(async (ctx) => {
  if (ctx.task.result?.state === 'fail') {
    console.log(await page().locator('body').innerText());
  }
  if (page().url().startsWith('http://')) {
    await page().evaluate(() => localStorage.removeItem('livedoc.viewer.testTypes'));
  }
  await page().setViewportSize({ width: 1280, height: 720 });
});

specification(`Native Test Report Compatibility
  @native-tests
  Existing saved xUnit results remain reachable beside authored living documentation without changing their identities or totals.
`, () => {
  rule("Unmapped kind 'toString' retains label 'toString', plural 'toStrings', and a FileText icon", (ctx) => {
    const [kind, label, plural] = ctx.rule.values as [string, string, string];
    expect(getKindPresentation(kind)).toEqual({ label, plural, icon: FileText, navIcon: FileText });
  });

  ruleOutline(`A <kind> document with Test children retains ID plain-tests, namespace Arithmetic/Native, and totals 2 passed of 2 in navigation
    Examples:
    | kind      |
    | Standard  |
    | Container |
    | Feature   |
    | Specification |
  `, (ctx) => {
    const run = standardRun();
    run.documents[0]!.kind = ctx.example.kind;
    run.documents[0]!.path = 'Arithmetic/Native/PlainTests.cs';
    const tree = buildGroupedNavTree(run.documents);
    expect(findNavItemById(tree, 'plain-tests')).toMatchObject({ kind: ctx.example.kind, node: run.documents[0] });
    expect(findNavItemById(tree, 'group:Arithmetic/Native')?.children.map(child => child.id)).toEqual(['plain-tests']);
    expect(run.summary).toEqual({ total: 2, passed: 2, failed: 0, pending: 0, skipped: 0 });
  });

  rule("A saved 'Standard' document and 'Specification' expose '2' document nodes and '2' passed results", async (ctx) => {
    const [nativeKind, specKind, count, passed] = ctx.rule.values as [string, string, number, number];
    const source = standardRun();
    expect(source.documents.map(doc => doc.kind)).toEqual([nativeKind, specKind]);
    expect(validateTestRunData(source).run?.summary).toMatchObject({ total: count, passed });
    await page().goto(`${baseUrl}#/group`);
    await page().getByRole('heading', { name: 'Root', exact: true }).waitFor();
    expect(await page().getByRole('listitem').count()).toBe(count);
    expect(await page().getByRole('listitem').getByRole('button', { name: 'Arithmetic', exact: true }).count()).toBe(1);
    await page().getByRole('listitem').getByRole('button', { name: 'Plain Tests', exact: true }).click();
    await page().getByRole('heading', { name: 'Plain Tests', exact: true }).waitFor();
    expect(await page().getByRole('button', { name: 'Adding one and one returns two native', exact: true }).count()).toBe(0);
    expect(await page().getByRole('listitem').getByText('Adding one and one returns two', { exact: true }).count()).toBe(1);
    expect(await page().getByText('Passed', { exact: true }).count()).toBeGreaterThan(0);
    await page().goto(`${baseUrl}#/arithmetic`);
    await page().getByRole('heading', { name: 'Rules', exact: true }).waitFor();
    expect(await page().getByText('Adding 1 and 1 returns 2', { exact: true }).count()).toBe(1);
    expect(source.documents.length).toBe(count);
  });

  ruleOutline(`Cards for <kind> label their children Tests and expose passed Test Adding one and one returns two without a drill-down button
    Examples:
    | kind      |
    | Standard  |
    | Container |
  `, (ctx) => {
    const markup = renderToStaticMarkup(createElement(ChildrenList, {
      children: standardRun().documents[0]!.tests,
      showCards: true, filterText: '', filterTags: [], navigate: useStore.getState().navigate,
      isSpecificationContainer: false, containerKind: ctx.example.kind,
    }));
    expect(markup).toMatch(/<h3[^>]*>Tests<\/h3>/);
    expect(markup).toContain('Adding one and one returns two');
    expect(markup).not.toMatch(/<button\b/);
    expect(markup).not.toContain('>Scenarios<');
  });

  ruleOutline(`Direct native test links render <title> with status <status> and details <detail>
    Examples:
    | slug                                     | title                                    | status  | detail                          |
    | adding-one-and-one-returns-two            | Adding one and one returns two           | Passed  | Test: Adding one and one returns two |
    | a-failing-fact                           | A failing Fact                           | Failed  | Expected 2 but received 3        |
    | a-skipped-fact                           | A skipped Fact                           | Skipped | Requires an unavailable service |
    | addition-left-1-right-2-expected-3        | Addition(left: 1, right: 2, expected: 3)  | Passed  | Arguments                       |
    | addition-left-2-right-2-expected-5        | Addition(left: 2, right: 2, expected: 5)  | Failed  | Expected 5 but received 4        |
  `, async (ctx) => {
    expect(validateTestRunData(standardRun(true)).diagnostic).toBeUndefined();
    await page().goto(`${baseUrl}?detailed#/plain-tests/${ctx.example.slug}`);
    await page().getByRole('heading', { name: `Test: ${ctx.example.title}`, exact: true }).waitFor();
    expect(await page().getByText(ctx.example.status, { exact: true }).count()).toBeGreaterThan(0);
    expect(await page().getByText(ctx.example.detail, { exact: true }).count()).toBeGreaterThan(0);
    expect(await page().getByRole('button', { name: 'Plain Tests', exact: true }).count()).toBeGreaterThan(0);
  });

  ruleOutline(`Native Test Adding one and one returns two with status <status> has <links> drill-down links and a visible status badge
    Examples:
    | status    | links |
    | pending   | 0     |
    | running   | 0     |
    | timedOut  | 1     |
    | cancelled | 0     |
  `, async (ctx) => {
    await page().goto(`${baseUrl}?status=${ctx.example.status}#/plain-tests`);
    await page().getByRole('heading', { name: 'Tests', exact: true }).waitFor();
    expect(await page().getByRole('button', { name: 'Adding one and one returns two native', exact: true }).count()).toBe(ctx.example.links);
    await page().getByRole('listitem').getByTitle(ctx.example.status, { exact: true }).waitFor({ state: 'visible' });
  });

  ruleOutline(`The <kind> list exposes passed Facts and individual Theory rows as <tests> test links plus <evidence> evidence controls
    Examples:
    | kind      | query               | tests | evidence |
    | Standard  | detailed            | 5     | 2        |
    | Container | detailed&container  | 5     | 2        |
  `, async (ctx) => {
    await page().goto(`${baseUrl}?${ctx.example.query}#/plain-tests`);
    await page().getByRole('heading', { name: 'Tests', exact: true }).waitFor();
    expect(await page().getByRole('listitem').count()).toBe(ctx.example.tests);
    expect(await page().getByRole('listitem').getByRole('button').count()).toBe(Number(ctx.example.tests) + Number(ctx.example.evidence));
  });

  rule("Searching 'Addition(left: 2' reaches '1' Theory result; tag '@theory' keeps '2' test rows", async (ctx) => {
    const [search, matches, tag, rows] = ctx.rule.values as [string, number, string, number];
    await page().goto(`${baseUrl}?detailed#/plain-tests`);
    await page().getByRole('heading', { name: 'Tests', exact: true }).waitFor();
    const filter = page().getByPlaceholder('Filter… (type @ to add tag)');
    await filter.fill(search);
    expect(await page().getByRole('listitem').count()).toBe(matches);
    await filter.fill(tag);
    await page().getByRole('option', { name: 'theory', exact: true }).click();
    expect(await page().getByRole('listitem').count()).toBe(rows);
    await filter.fill(search);
    expect(await page().getByRole('listitem').count()).toBe(matches);
    await filter.press('Tab');
    await page().getByRole('listitem').getByRole('button', { name: 'Addition(left: 2, right: 2, expected: 5) theory', exact: true }).click();
    await page().getByRole('heading', { name: 'Test: Addition(left: 2, right: 2, expected: 5)', exact: true }).waitFor();
  });

  rule("Native Fact evidence opens 'stdout.txt' with 'Fact output: 1 + 1 = 2'", async (ctx) => {
    const [title, output] = ctx.rule.values as [string, string];
    await page().goto(`${baseUrl}?detailed#/plain-tests/adding-one-and-one-returns-two`);
    await page().getByRole('button', { name: 'View all 1 attachment for this test', exact: true }).click();
    expect(await page().getByRole('dialog').getByText(title, { exact: true }).count()).toBeGreaterThan(0);
    expect(await page().getByRole('dialog').getByText(output, { exact: true }).count()).toBe(1);
  });

  rule("Excluding 'Standard tests (non-LiveDoc)' leaves '1' test, hides 'Plain Tests', persists across reload, and restoring it brings back '6' tests", async (ctx) => {
    const [label, remaining, hidden, total] = ctx.rule.values as [string, number, string, number];
    await page().goto(`${baseUrl}?detailed`);
    const metrics = page().getByRole('group', { name: 'Tests', exact: true });
    await page().getByRole('button', { name: 'Viewer settings' }).click();
    await page().getByRole('menuitemcheckbox', { name: label }).click();
    expect(await page().getByRole('menuitemcheckbox', { name: label }).getAttribute('aria-checked')).toBe('false');
    await page().keyboard.press('Escape');
    expect(await page().getByRole('button', { name: hidden, exact: true }).count()).toBe(0);
    await metrics.getByText(String(remaining), { exact: true }).waitFor();
    await page().getByRole('group', { name: 'Failed', exact: true }).getByText('0', { exact: true }).waitFor();
    expect(await page().getByRole('heading', { name: 'Failing Containers', exact: true }).count()).toBe(0);
    await page().reload();
    await page().getByRole('button', { name: 'Viewer settings' }).click();
    expect(await page().getByRole('menuitemcheckbox', { name: label }).getAttribute('aria-checked')).toBe('false');
    await page().getByRole('menuitemcheckbox', { name: label }).click();
    await page().keyboard.press('Escape');
    await metrics.getByText(String(total), { exact: true }).waitFor();
  });

  ruleOutline(`At viewport <width> by <height>, excluding all types shows zero Tests and the empty-state message, with all three checkboxes reachable without page overflow
    Examples:
    | width | height |
    | 1440  | 900    |
    | 390   | 844    |
  `, async (ctx) => {
    await page().setViewportSize({ width: ctx.example.width, height: ctx.example.height });
    await page().goto(`${baseUrl}?detailed`);
    await page().getByRole('button', { name: 'Viewer settings' }).click();
    for (const label of ['Features', 'Specifications', 'Standard tests (non-LiveDoc)']) {
      await page().getByRole('menuitemcheckbox', { name: label, exact: true }).click();
    }
    expect(await page().getByRole('menuitemcheckbox', { checked: false }).count()).toBe(3);
    expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ctx.example.width);
    const evidenceDir = resolve(process.cwd(), 'test-results');
    await mkdir(evidenceDir, { recursive: true });
    await page().screenshot({ path: resolve(evidenceDir, `test-types-settings-${ctx.example.width}.png`) });
    await page().keyboard.press('Escape');
    await page().getByText('No tests match the included test types.', { exact: true }).waitFor();
    await page().getByRole('group', { name: 'Tests', exact: true }).getByText('0', { exact: true }).waitFor();
  });

  rule("A qualified native method shows 'Adding_one_and_one_returns_two' in its list and detail while its saved link retains 'example-native-plaintests-adding-one-and-one-returns-two'", async (ctx) => {
    const [title, slug] = ctx.rule.values as [string, string];
    await page().goto(`${baseUrl}?detailed&qualified#/plain-tests`);
    await page().getByRole('heading', { name: 'Tests', exact: true }).waitFor();
    await page().getByRole('listitem').getByRole('button', { name: `${title} native`, exact: true }).click();
    await page().getByRole('heading', { name: `Test: ${title}`, exact: true }).waitFor();
    expect(new URL(page().url()).hash).toContain(slug);
  });

  rule("A 'Standard' Test link preserves project 'livedoc.xunit.unittests', run 'native-tests-fixture', and physical projection", (ctx) => {
    const [kind, project, runId] = ctx.rule.values as [string, string, string];
    const run = makeRunState(standardRun(true));
    expect(run.run.documents[0]!.kind).toBe(kind);
    const hash = buildHash({ type: 'node', id: 'theory-two' }, run, { project, environment: 'local', runId, runView: 'physical' });
    expect(hash).toBe(`#/plain-tests/addition-left-2-right-2-expected-5?project=${project}&environment=local&run=${runId}&view=physical`);
    expect(resolveHash(hash, run)).toEqual({ type: 'node', id: 'theory-two' });
  });

  rule("Patching Standard Fact 'plain-fact' to 'failed' retains '2' documents and 'arithmetic' in combined inventory", (ctx) => {
    const [testId, status, count, other] = ctx.rule.values as [string, 'failed', number, string];
    const state = useStore.getState();
    const previous = useStore.getState();
    try {
      state.setRuns([makeRunState(standardRun())]);
      state.patchTestExecution('native-tests-fixture', testId, { execution: { status } });
      const run = useStore.getState().runs[0]!;
      expect(run.run.documents).toHaveLength(count);
      expect(run.itemById[testId]).toMatchObject({ execution: { status } });
      expect(run.itemById[other]).toEqual(standardRun().documents[1]);
      expect(findNavItemById(buildGroupedNavTree(run.run.documents), 'plain-tests')?.kind).toBe('Standard');
    } finally {
      useStore.setState(previous, true);
    }
  });

  rule("Reloaded REST results preserve 'Standard,Specification', summary '2', passed '2', and a passive native Fact without details", async (ctx) => {
    const [kinds, total, passed] = ctx.rule.values as [string, number, number];
    const response = await fetch(`${apiUrl}/api/v1/runs/${savedRunId}?view=physical`);
    expect(response.status).toBe(200);
    const saved = await response.json() as TestRunV1;
    expect(saved.documents.map(doc => doc.kind).join(',')).toBe(kinds);
    expect(saved.summary).toMatchObject({ total, passed });
    expect(saved.documents[0]!.tests[0]!).toMatchObject({ id: 'plain-fact', kind: 'Test', execution: { status: 'passed' } });
    await page().addInitScript(url => Object.assign(window, { __LIVEDOC_CONFIG__: { serverUrl: url } }), apiUrl);
    await page().goto(`${baseUrl.replace('standard-tests-fixture.html', 'index.html')}#/plain-tests?project=${saved.project}&environment=${saved.environment}&run=${savedRunId}&view=physical`);
    await page().getByRole('heading', { name: 'Tests', exact: true }).waitFor();
    expect(await page().getByRole('button', { name: 'Adding one and one returns two native', exact: true }).count()).toBe(0);
    expect(await page().getByRole('listitem').getByText('Adding one and one returns two', { exact: true }).count()).toBe(1);
    expect(new URL(page().url()).hash).toContain(`run=${savedRunId}`);
    expect(new URL(page().url()).hash).toContain('view=physical');
  });

  rule("A partial Standard Fact changes to 'failed' while combined inventory retains '2' documents and '1' unaffected Specification", async (ctx) => {
    const [status, documentCount, specificationCount] = ctx.rule.values as ['failed', number, number];
    const source = standardRun();
    const start = await post('/api/v1/runs/start', {
      project: source.project, environment: source.environment, framework: source.framework, runType: 'partial',
    });
    expect(start.status).toBe(201);
    const partialId: string = (await start.json()).runId;
    const partialDocument = structuredClone(source.documents[0]!);
    partialDocument.tests[0]!.execution.status = status;
    partialDocument.statistics = { total: 1, passed: 0, failed: 1, pending: 0, skipped: 0 };
    expect((await post(`/api/v1/runs/${partialId}/testcases/batch`, {
      testCases: [partialDocument],
      complete: { status, duration: 12 },
    })).status).toBe(200);
    const combined = await (await fetch(`${apiUrl}/api/v1/runs/${partialId}?view=combined`)).json() as TestRunV1;
    const physical = await (await fetch(`${apiUrl}/api/v1/runs/${partialId}?view=physical`)).json() as TestRunV1;
    expect(combined.documents).toHaveLength(documentCount);
    expect(combined.documents.filter(doc => doc.kind === 'Specification')).toHaveLength(specificationCount);
    expect(combined.documents.find(doc => doc.id === 'arithmetic')).toEqual(source.documents[1]);
    expect(combined.summary).toEqual({ total: 2, passed: 1, failed: 1, pending: 0, skipped: 0 });
    expect(physical.documents.map(doc => doc.kind)).toEqual(['Standard']);
    await page().addInitScript(url => Object.assign(window, { __LIVEDOC_CONFIG__: { serverUrl: url } }), apiUrl);
    await page().goto('about:blank');
    await page().goto(`${baseUrl.replace('standard-tests-fixture.html', 'index.html')}#/plain-tests/adding-one-and-one-returns-two?project=${source.project}&environment=local&run=${partialId}`);
    await page().getByRole('heading', { name: 'Test: Adding one and one returns two', exact: true }).waitFor();
    expect(await page().getByText('Failed', { exact: true }).count()).toBeGreaterThan(0);
    await page().getByRole('tab', { name: 'This partial', exact: true }).click();
    expect(new URL(page().url()).hash).toContain('view=physical');
    await page().getByRole('tab', { name: 'Combined', exact: true }).click();
    expect(new URL(page().url()).hash).not.toContain('view=physical');
  });

  ruleOutline(`At viewport <width> by <height>, Standard and Specification show <count> document links without page overflow
    Examples:
    | width | height | count |
    | 1440  | 900    | 2     |
    | 390   | 844    | 2     |
  `, async (ctx) => {
    const width = Number(ctx.example.width);
    const height = Number(ctx.example.height);
    await page().setViewportSize({ width, height });
    await page().goto(`${baseUrl}#/group`);
    await page().getByRole('heading', { name: 'Root', exact: true }).waitFor();
    expect(await page().getByRole('listitem').getByRole('button').count()).toBe(ctx.example.count);
    expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const evidenceDir = resolve(process.cwd(), '..', '..', '.livedoc', 'standard-tests-verification');
    await mkdir(evidenceDir, { recursive: true });
    await waitForPresentation();
    await page().screenshot({ path: resolve(evidenceDir, `source-documents-${width}.png`), fullPage: true });
    await page().goto(`${baseUrl}?detailed#/plain-tests/addition-left-1-right-2-expected-3`);
    await page().getByRole('heading', { name: 'Test: Addition(left: 1, right: 2, expected: 3)', exact: true }).waitFor();
    expect(await page().getByRole('table').getByRole('row').count()).toBe(2);
    expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await waitForPresentation();
    await page().screenshot({ path: resolve(evidenceDir, `source-theory-${width}.png`), fullPage: true });
  });
});
