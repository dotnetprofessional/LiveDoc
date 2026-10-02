import { afterAll, beforeAll, expect, vi } from 'vitest';
import { rule, ruleOutline, specification } from '@swedevtools/livedoc-vitest';
import { useBrowser } from '@swedevtools/livedoc-vitest/playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { useStore } from '../src/client/store';
import { namespaceRun, SHARED_NAMESPACE } from '../src/client/test-fixtures/namespace-report';
import { getInitialSidebarWidth, SIDEBAR_WIDTH_KEY } from '../src/client/lib/sidebar-layout';

declare global {
  interface Window {
    __NAVIGATION_FIXTURE__: { store: typeof useStore; installPhysical: () => void };
  }
}

const { page } = useBrowser({ viewport: { width: 1440, height: 900 } });
let server: ViteDevServer;
let baseUrl: string;

beforeAll(async () => {
  page().setDefaultTimeout(5_000);
  await page().routeWebSocket('**/ws', () => {});
  server = await createServer({
    configFile: false,
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../src/client'),
    plugins: [react(), tailwindcss()],
    define: { __LIVEDOC_VIEWER_VERSION__: JSON.stringify('test') },
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Navigation fixture has no port');
  baseUrl = `http://127.0.0.1:${address.port}/namespace-navigation-fixture.html`;
});
afterAll(async () => { await server?.close(); });

specification(`Sidebar Width Preferences
  @sidebar
  Stored desktop widths stay usable even when storage is absent or contains an invalid value.
`, () => {
  ruleOutline(`Stored width <stored> initializes the sidebar preference to <expected> pixels
    Examples:
    | stored  | expected |
    | missing | 280      |
    | invalid | 280      |
    | 480     | 480      |
    | -50     | 240      |
    | 999     | 600      |
  `, (ctx) => {
    const saved = ctx.example.stored === 'missing' ? null : String(ctx.example.stored);
    vi.stubGlobal('localStorage', { getItem: () => saved });
    try {
      expect(getInitialSidebarWidth()).toBe(ctx.example.expected);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

async function open(query = '', hash = '#/group') {
  await page().setViewportSize({ width: 1440, height: 900 });
  await page().goto(`${baseUrl}${query}${hash}`);
  await page().getByRole('heading', { name: 'Root', exact: true }).waitFor();
  await page().evaluate(key => localStorage.removeItem(key), SIDEBAR_WIDTH_KEY);
  await page().reload();
  await page().getByRole('heading', { name: 'Root', exact: true }).waitFor();
}

function sidebar() { return page().getByRole('complementary', { name: 'Report navigation' }); }
function divider() { return page().getByRole('separator', { name: 'Resize navigation sidebar' }); }

async function width() {
  const box = await sidebar().boundingBox();
  if (!box) throw new Error('Sidebar has no rendered rectangle');
  return box.width;
}

async function dragTo(x: number) {
  const box = await divider().boundingBox();
  if (!box) throw new Error('Divider has no rendered rectangle');
  await page().mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page().mouse.down();
  await page().mouse.move(x, box.y + box.height / 2, { steps: 8 });
  await page().mouse.up();
}

async function waitWidth(expected: number) {
  await page().waitForFunction(value => {
    const element = document.querySelector('aside[aria-label="Report navigation"]');
    return element && Math.abs(element.getBoundingClientRect().width - value) < 1;
  }, expected);
  expect(await width()).toBeCloseTo(expected, 0);
}

async function captureNavigation(name: string) {
  await page().waitForFunction(() => [...document.querySelectorAll('h1, h2, h3')].every(heading => {
    for (let element: Element | null = heading; element; element = element.parentElement) {
      if (Number(getComputedStyle(element).opacity) < 0.99) return false;
    }
    return true;
  }));
  await page().screenshot({ path: resolve(process.cwd(), 'test-results', name) });
}

specification(`Sidebar Navigation and Resizing
  @navigation @sidebar
  Readers can find meaningful folders and allocate space to deeper branches without changing report data or mobile navigation.
`, () => {
  ruleOutline(`A <framework> run with prefix <prefix> and '401' containers starts at 'Authentication,ResourceProviders', preserving '401' passed tests
    Examples:
    | framework | prefix  |
    | xunit     | shared  |
    | vitest    | shared  |
    | vitest    | trimmed |
  `, async (ctx) => {
    const [count, roots, passed] = ctx.rule.values as [number, string, number];
    await open(`?framework=${ctx.example.framework}${ctx.example.prefix === 'trimmed' ? '&trimmed' : ''}`);
    expect(await sidebar().getByRole('button').filter({ hasText: /^(Authentication|ResourceProviders)$/ }).allTextContents())
      .toEqual(roots.split(','));
    expect(await sidebar().getByRole('button', { name: 'Acme', exact: true }).count()).toBe(0);
    expect(await page().getByRole('listitem').getByRole('button').allTextContents()).toEqual(roots.split(','));
    const inventory = await page().evaluate(() => {
      const state = window.__NAVIGATION_FIXTURE__.store.getState();
      return { count: state.getCurrentRun()!.run.documents.length, summary: state.getCurrentRun()!.run.summary };
    });
    expect(inventory.count).toBe(count);
    expect(inventory.summary).toMatchObject({ total: count, passed });
  });

  ruleOutline(`In <framework>, search 'Check 001' and tag '@authentication' keep the 'Authentication' root and canonical selection without revealing 'UnitTests'
    Examples:
    | framework |
    | xunit     |
    | vitest    |
  `, async (ctx) => {
    const [search, tag, root, hidden] = ctx.rule.values as [string, string, string, string];
    await open(`?framework=${ctx.example.framework}`);
    await sidebar().getByRole('button', { name: root, exact: true }).click();
    await page().getByRole('heading', { name: root, exact: true }).waitFor();
    const before = await page().evaluate(() => window.__NAVIGATION_FIXTURE__.store.getState().currentView.id);
    const filter = page().getByPlaceholder('Filter… (type @ to add tag)');
    await filter.fill(search);
    expect(await sidebar().getByRole('button', { name: root, exact: true }).count()).toBe(1);
    expect(await sidebar().getByRole('button', { name: hidden, exact: true }).count()).toBe(0);
    expect(await page().getByRole('listitem').count()).toBe(1);
    await filter.fill(tag);
    await page().getByRole('option', { name: tag.slice(1), exact: true }).click();
    expect(await page().getByRole('listitem').count()).toBe(4);
    expect(await page().evaluate(() => window.__NAVIGATION_FIXTURE__.store.getState().currentView.id)).toBe(before);
  });

  ruleOutline(`In <framework>, a saved hidden-ancestor link '#/group/Acme/Commerce/Quotes' opens 'Quotes' with 'Authentication,ResourceProviders' and full path tooltips
    Examples:
    | framework |
    | xunit     |
    | vitest    |
  `, async (ctx) => {
    const [hash, heading, roots] = ctx.rule.values as [string, string, string];
    const query = `?framework=${ctx.example.framework}`;
    await open(query);
    await page().goto(`${baseUrl}${query}${hash}`);
    await page().getByRole('heading', { name: heading, exact: true }).waitFor();
    expect(await page().getByRole('listitem').getByRole('button').allTextContents()).toEqual(roots.split(','));
    expect(await sidebar().getByRole('button', { name: 'Authentication', exact: true }).getAttribute('title'))
      .toBe(`${SHARED_NAMESPACE}/Authentication`);
    await sidebar().getByRole('button', { name: 'Authentication', exact: true }).click();
    await page().getByRole('heading', { name: 'Authentication', exact: true }).waitFor();
    await page().goBack();
    await page().getByRole('heading', { name: heading, exact: true }).waitFor();
    await page().goForward();
    await page().getByRole('heading', { name: 'Authentication', exact: true }).waitFor();
    expect(page().url()).toContain(SHARED_NAMESPACE);
  });

  ruleOutline(`In <framework>, document 'Check 001' and native result 'Check 1 passes' retain full path <path> with compact 'Root,Authentication,Check 001' breadcrumbs
    Examples:
    | framework | path                                                                               |
    | xunit     | Acme/Commerce/Quotes/Services/Transactor/UnitTests/Authentication/Check1.cs           |
    | vitest    | Acme/Commerce/Quotes/Services/Transactor/UnitTests/Authentication/Check1.Spec.ts      |
  `, async (ctx) => {
    const [document, test, crumbs] = ctx.rule.values as [string, string, string];
    const query = `?framework=${ctx.example.framework}`;
    await open(query);
    await page().goto(`${baseUrl}${query}#/check-001/check-1-passes`);
    await page().getByRole('heading', { name: `Test: ${test}`, exact: true }).waitFor();
    expect(await page().getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button').allTextContents())
      .toEqual(crumbs.split(','));
    expect(await page().getByRole('heading', { name: document, exact: true }).getAttribute('title'))
      .toBe(ctx.example.path);
    if (ctx.example.framework === 'vitest') {
      await captureNavigation('navigation-vitest-common-root-desktop.png');
    }
  });

  rule("A Vitest mobile drawer at '375' pixels starts at 'Authentication,ResourceProviders', hides 'Acme', and opens the full-path 'Authentication' folder without horizontal overflow", async (ctx) => {
    const [viewport, roots, hidden, folder] = ctx.rule.values as [number, string, string, string];
    await open('?framework=vitest');
    await page().setViewportSize({ width: viewport, height: 812 });
    await page().getByRole('button', { name: 'Open navigation', exact: true }).click();
    expect(await sidebar().getByRole('button', { name: /^(Authentication|ResourceProviders)$/ }).allTextContents()).toEqual(roots.split(','));
    expect(await sidebar().getByRole('button', { name: hidden, exact: true }).count()).toBe(0);
    await captureNavigation('navigation-vitest-common-root-mobile.png');
    await sidebar().getByRole('button', { name: folder, exact: true }).click();
    await page().getByRole('dialog').press('Escape');
    await page().getByRole('heading', { name: folder, exact: true }).waitFor();
    expect(page().url()).toContain(`${SHARED_NAMESPACE}/${folder}`);
    expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBe(viewport);
  });

  ruleOutline(`A live <framework> report with '401' containers at <viewport> pixels starts at 'Authentication,ResourceProviders' and opens 'Authentication' at its full path without exposing 'Acme'
    Examples:
    | framework | viewport |
    | xunit     | 1440     |
    | vitest    | 1440     |
    | xunit     | 375      |
    | vitest    | 375      |
  `, async (ctx) => {
    const [count, roots, folder, hidden] = ctx.rule.values as [number, string, string, string];
    const source = namespaceRun(count);
    source.framework = ctx.example.framework;
    if (source.framework === 'vitest') {
      source.documents = source.documents.map(document => ({ ...document, path: document.path?.replace(/\.cs$/, '.Spec.ts') }));
    }
    await page().route('**/api/v1/**', async route => {
      const request = route.request();
      if (request.method() !== 'GET') throw new Error(`Unexpected live fixture request: ${request.method()}`);
      const path = new URL(request.url()).pathname;
      if (path === '/api/v1/diagnostics') {
        await route.fulfill({ json: { diagnostics: [] } });
      } else if (path === '/api/v1/hierarchy') {
        await route.fulfill({ json: { projects: [{
          name: source.project,
          environments: [{ name: source.environment, latestRun: source, historyCount: 1, history: [] }],
        }] } });
      } else if (path === '/api/v1/runs') {
        await route.fulfill({ json: [source] });
      } else if (path === `/api/v1/runs/${source.runId}`) {
        await route.fulfill({ json: source });
      } else {
        throw new Error(`Unexpected live fixture API path: ${path}`);
      }
    });
    try {
      await open(`?live&framework=${ctx.example.framework}`);
      await page().setViewportSize({ width: ctx.example.viewport, height: 900 });
      const openNavigation = page().getByRole('button', { name: 'Open navigation', exact: true });
      if (await openNavigation.isVisible()) await openNavigation.click();
      expect(await sidebar().getByRole('button').filter({ hasText: /^(Authentication|ResourceProviders)$/ }).allTextContents()).toEqual(roots.split(','));
      expect(await sidebar().getByRole('button', { name: hidden, exact: true }).count()).toBe(0);
      expect(await sidebar().getByRole('button', { name: folder, exact: true }).getAttribute('title')).toBe(`${SHARED_NAMESPACE}/${folder}`);
      await sidebar().getByRole('button', { name: folder, exact: true }).click();
      const drawer = page().getByRole('dialog');
      if (await drawer.isVisible()) await drawer.press('Escape');
      await page().getByRole('heading', { name: folder, exact: true }).waitFor();
      expect(page().url()).toContain(`${SHARED_NAMESPACE}/${folder}`);
      expect(await page().evaluate(() => window.__NAVIGATION_FIXTURE__.store.getState().getCurrentRun()!.run.documents.length)).toBe(count);
      expect(await page().evaluate(() => '__LIVEDOC_DATA__' in window)).toBe(false);
      await captureNavigation(`navigation-${ctx.example.framework}-live-${ctx.example.viewport}.png`);
    } finally {
      await page().goto('about:blank');
      await page().unrouteAll({ behavior: 'wait' });
    }
  });

  rule("A single deeply namespaced container 'Check 001' tagged 'authentication' is directly reachable in the sidebar and Root listing", async (ctx) => {
    const [title, tag] = ctx.rule.values as [string, string];
    await open('?single');
    expect(await sidebar().getByRole('button', { name: title, exact: true }).count()).toBe(1);
    expect(await page().getByRole('listitem').getByRole('button', { name: `${title} ${tag}`, exact: true }).count()).toBe(1);
    await sidebar().getByRole('button', { name: title, exact: true }).click();
    await page().getByRole('heading', { name: title, exact: true }).waitFor();
  });

  rule("Combined partial inventory keeps '401' containers while This partial shows '4', and Combined restores 'Authentication,ResourceProviders'", async (ctx) => {
    const [combined, physical, roots] = ctx.rule.values as [number, number, string];
    await open('?partial');
    await page().evaluate(() => window.__NAVIGATION_FIXTURE__.installPhysical());
    const inventory = () => page().evaluate(() => window.__NAVIGATION_FIXTURE__.store.getState().getCurrentRun()!.run.documents.length);
    expect(await inventory()).toBe(combined);
    await page().getByRole('tab', { name: 'This partial', exact: true }).click();
    await page().waitForFunction(count => window.__NAVIGATION_FIXTURE__.store.getState().getCurrentRun()!.run.documents.length === count, physical);
    expect(await inventory()).toBe(physical);
    await page().getByRole('tab', { name: 'Combined', exact: true }).click();
    await page().waitForFunction(count => window.__NAVIGATION_FIXTURE__.store.getState().getCurrentRun()!.run.documents.length === count, combined);
    expect(await sidebar().getByRole('button', { name: /^(Authentication|ResourceProviders)$/ }).allTextContents()).toEqual(roots.split(','));
  });

  rule("Dragging the desktop divider from default '280' to '480' pixels preserves expanded 'ResourceProviders' and folder selection after reload", async (ctx) => {
    const [initial, resized, branch] = ctx.rule.values as [number, number, string];
    await open('?deep');
    await waitWidth(initial);
    await sidebar().getByRole('button', { name: branch, exact: true }).click();
    await page().getByRole('heading', { name: branch, exact: true }).waitFor();
    const row = sidebar().getByRole('button', { name: branch, exact: true }).locator('..');
    await row.getByRole('button', { name: 'Expand', exact: true }).click();
    await sidebar().getByRole('button', { name: 'RepositoryRegistration', exact: true }).waitFor();
    await dragTo(resized + 6);
    await waitWidth(resized);
    expect(await sidebar().getByRole('button', { name: 'RepositoryRegistration', exact: true }).count()).toBe(1);
    expect(await page().evaluate(key => Number(localStorage.getItem(key)), SIDEBAR_WIDTH_KEY)).toBeCloseTo(resized, 0);
    await page().reload();
    await page().getByRole('heading', { name: branch, exact: true }).waitFor();
    await waitWidth(resized);
  });

  rule("The named separator responds to 'ArrowRight' and 'ArrowLeft' with keyboard focus retained", async (ctx) => {
    const [grow, shrink] = ctx.rule.values as [string, string];
    await open();
    const before = await width();
    await divider().focus();
    await divider().press(grow);
    expect(await width()).toBeGreaterThan(before);
    expect(await divider().evaluate(element => element === document.activeElement)).toBe(true);
    await divider().press(shrink);
    await waitWidth(before);
    expect(await divider().getAttribute('aria-orientation')).toBe('vertical');
  });

  rule("A legitimate branch 'ResourceProviders/Billing/Lifecycle/Renewals/LongTransactionAuthorizationPolicies' remains navigable and its label fits after resizing from '280' to '480' pixels", async (ctx) => {
    const [branch, initial, resized] = ctx.rule.values as [string, number, number];
    await open('?deep');
    await waitWidth(initial);
    const folders = branch.split('/');
    for (const folder of folders.slice(0, -1)) {
      const row = sidebar().getByRole('button', { name: folder, exact: true }).locator('..');
      await row.getByRole('button', { name: 'Expand', exact: true }).click();
    }
    const leaf = sidebar().getByRole('button', { name: folders.at(-1)!, exact: true });
    await leaf.waitFor();
    const label = leaf.locator('span');
    expect(await label.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await dragTo(resized + 6);
    await waitWidth(resized);
    expect(await label.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await leaf.click();
    await page().getByRole('heading', { name: folders.at(-1)!, exact: true }).waitFor();
    expect(await page().getByRole('navigation', { name: 'Breadcrumb' }).getByRole('button').allTextContents())
      .toEqual(['', ...folders.slice(0, -1)]);
    expect(page().url()).toContain(`${SHARED_NAMESPACE}/${branch}`);
  });

  ruleOutline(`Dragging at viewport <viewport> pixels to <target> clamps sidebar at <expected>, retaining at least '480' pixels of content
    Examples:
    | viewport | target | expected |
    | 1440     | 0      | 240      |
    | 1440     | 1400   | 600      |
    | 800      | 790    | 308      |
  `, async (ctx) => {
    const [contentMin] = ctx.rule.values as [number];
    await open();
    await page().setViewportSize({ width: ctx.example.viewport, height: 900 });
    await dragTo(ctx.example.target);
    await waitWidth(ctx.example.expected);
    const content = await page().locator('#report-content').boundingBox();
    expect(content?.width).toBeGreaterThanOrEqual(contentMin);
    expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBe(ctx.example.viewport);
    const header = page().locator('header');
    expect(await header.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });

  rule("Preferred width '600' shrinks to '276' at viewport '768', restores at '1440', and does not leak into the '375' pixel mobile drawer", async (ctx) => {
    const [preferred, narrow, narrowViewport, wideViewport, mobile] = ctx.rule.values as [number, number, number, number, number];
    await open();
    await dragTo(preferred + 6);
    await waitWidth(preferred);
    await page().setViewportSize({ width: narrowViewport, height: 900 });
    await waitWidth(narrow);
    expect(await page().evaluate(key => Number(localStorage.getItem(key)), SIDEBAR_WIDTH_KEY)).toBeCloseTo(preferred, 0);
    await page().setViewportSize({ width: wideViewport, height: 900 });
    await waitWidth(preferred);
    await page().setViewportSize({ width: mobile, height: 812 });
    await page().getByRole('button', { name: 'Open navigation', exact: true }).waitFor();
    expect(await divider().count()).toBe(0);
    expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBe(mobile);
    await page().getByRole('button', { name: 'Open navigation', exact: true }).click();
    await sidebar().getByRole('button', { name: 'Authentication', exact: true }).waitFor();
    expect(await width()).toBeLessThan(mobile);
    await page().getByRole('dialog').press('Escape');
    await page().setViewportSize({ width: wideViewport, height: 900 });
    await waitWidth(preferred);
  });

  rule("An embedded VS Code viewer at '1440' pixels retains host-controlled navigation with no desktop divider or sidebar", async (ctx) => {
    const [viewport] = ctx.rule.values as [number];
    await page().setViewportSize({ width: viewport, height: 900 });
    await page().goto(`${baseUrl}?embedded`);
    await page().getByPlaceholder('Filter… (type @ to add tag)').waitFor();
    await page().waitForFunction(() => Boolean(window.__NAVIGATION_FIXTURE__.store.getState().getCurrentRun()));
    expect(await divider().count()).toBe(0);
    expect(await sidebar().count()).toBe(0);
    expect((await page().locator('#report-content').boundingBox())?.width).toBe(viewport);
  });
});
