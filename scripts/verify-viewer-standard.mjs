import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const project = 'livedoc.xunit.unittests';
const stats = (total, passed, failed = 0, skipped = 0) => ({ total, passed, failed, pending: 0, skipped });
const test = (id, title, status, error) => ({
  id, kind: 'Test', title, tags: ['@native'],
  execution: { status, duration: status === 'skipped' ? 0 : 12, ...(error ? { error: { message: error } } : {}) },
});
const minimal = {
  protocolVersion: '1.0', runId: 'release-validation', runType: 'full',
  project, environment: 'local', framework: 'xunit', timestamp: '2026-10-01T00:00:00Z',
  duration: 13, status: 'passed', summary: stats(2, 2),
  documents: [
    {
      id: 'plain-tests', kind: 'Standard', path: 'PlainTests.cs', title: 'Plain Tests',
      tests: [test('plain-fact', 'Adding one and one returns two', 'passed')],
      statistics: stats(1, 1),
    },
    {
      id: 'arithmetic', kind: 'Specification', path: 'ArithmeticSpec.cs', title: 'Arithmetic',
      tests: [{ id: 'addition-rule', kind: 'Rule', title: 'Adding 1 and 1 returns 2', execution: { status: 'passed', duration: 1 } }],
      statistics: stats(1, 1),
    },
  ],
};
const detailed = structuredClone(minimal);
detailed.status = 'failed';
detailed.summary = stats(6, 3, 2, 1);
detailed.documents[0].statistics = stats(5, 2, 2, 1);
detailed.documents[0].tests = [
  test('plain-fact', 'Adding one and one returns two', 'passed'),
  test('failed-fact', 'A failing Fact', 'failed', 'Expected 2 but received 3'),
  test('skipped-fact', 'A skipped Fact', 'skipped', 'Requires an unavailable service'),
  test('theory-one', 'Addition(left: 1, right: 2, expected: 3)', 'passed'),
  test('theory-two', 'Addition(left: 2, right: 2, expected: 5)', 'failed', 'Expected 5 but received 4'),
];
detailed.documents[0].tests[0].execution.attachments = [{
  id: 'stdout', kind: 'file', title: 'stdout.txt', mimeType: 'text/plain',
  base64: Buffer.from('Fact output: 1 + 1 = 2').toString('base64'),
}, {
  id: 'native-image', kind: 'image', title: 'native-image.svg', mimeType: 'image/svg+xml',
  base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#14b8a6"/></svg>').toString('base64'),
}];
detailed.documents[0].tests[0].title = 'Example.Native.PlainTests.Adding_one_and_one_returns_two';
detailed.documents[0].tests[3].tags = ['@theory'];
detailed.documents[0].tests[4].tags = ['@theory'];
for (const [index, values] of [[3, [1, 2, 3]], [4, [2, 2, 5]]]) {
  detailed.documents[0].tests[index].dataTables = [{
    name: 'Arguments', headers: ['left', 'right', 'expected'],
    rows: [{ rowId: 0, values: values.map(value => ({ type: 'number', value })) }],
  }];
}

const [, , mode, ...args] = process.argv;
if (mode === '--fixtures') {
  const [stage] = args;
  assert(stage, 'Fixture output directory is required');
  const savedDir = path.join(stage, '.livedoc', 'data', project, 'local');
  await mkdir(savedDir, { recursive: true });
  await writeFile(path.join(stage, 'viewer-input.json'), JSON.stringify(minimal));
  await writeFile(path.join(stage, 'viewer-detailed-input.json'), JSON.stringify(detailed));
  await writeFile(path.join(savedDir, 'lastrun.json'), JSON.stringify(minimal));
} else if (mode === '--browser') {
  const [baseUrl, minimalHtml, detailedHtml, evidenceDir, version] = args;
  assert(baseUrl && minimalHtml && detailedHtml && evidenceDir && version, 'Browser verification arguments are required');
  const require = createRequire(new URL('../packages/vitest/package.json', import.meta.url));
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  await mkdir(evidenceDir, { recursive: true });
  try {
    const response = await fetch(`${baseUrl}/api/v1/runs/release-validation?view=physical`);
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.deepEqual(saved.documents.map(doc => doc.kind), ['Standard', 'Specification']);
    assert.deepEqual(saved.summary, stats(2, 2));
    assert.equal(saved.documents[0].tests[0].kind, 'Test');
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(10_000);
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    const waitForPresentation = () => page.waitForFunction(() => [...document.querySelectorAll('h1, h2, h3')].every(heading => {
      for (let node = heading; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < 0.99) return false;
      }
      return true;
    }));
    for (const [name, url] of [
      ['installed-cli', `${baseUrl}/`],
      ['static-export', pathToFileURL(minimalHtml).href],
    ]) {
      await page.goto(`${url}#/group`);
      try {
        await page.getByRole('heading', { name: 'Root', exact: true }).waitFor();
      } catch (error) {
        console.error(name, await page.locator('body').innerText(), browserErrors);
        throw error;
      }
      const actual = await page.getByRole('listitem').count();
      assert.equal(actual, 2, `${name}: both persisted documents must render`);
      await page.getByRole('listitem').getByRole('button', { name: 'Plain Tests', exact: true }).click();
      await page.getByRole('heading', { name: 'Tests', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Adding one and one returns two native', exact: true }).count(), 0);
      assert.equal(await page.getByRole('listitem').getByText('Adding one and one returns two', { exact: true }).count(), 1);
      // Existing direct links remain valid even when a result no longer needs another click.
      await page.goto(`${url}#/plain-tests/adding-one-and-one-returns-two`);
      await page.getByRole('heading', { name: 'Test: Adding one and one returns two', exact: true }).waitFor();
      assert((await page.getByText('Passed', { exact: true }).count()) > 0);
      await page.goto(url);
      await page.getByRole('group', { name: 'Tests', exact: true }).getByText('2', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Viewer settings', exact: true }).click();
      await page.getByRole('menuitemcheckbox', { name: 'Standard tests (non-LiveDoc)', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('group', { name: 'Tests', exact: true }).getByText('1', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Plain Tests', exact: true }).count(), 0);
      await page.reload();
      await page.getByRole('group', { name: 'Tests', exact: true }).getByText('1', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Viewer settings', exact: true }).click();
      assert.equal(await page.getByRole('menuitemcheckbox', { name: 'Standard tests (non-LiveDoc)', exact: true }).getAttribute('aria-checked'), 'false');
      await page.getByRole('menuitemcheckbox', { name: 'Standard tests (non-LiveDoc)', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('group', { name: 'Tests', exact: true }).getByText('2', { exact: true }).waitFor();
      results.push({ surface: name, expectedDocuments: 2, actualDocuments: actual, summaryTotal: saved.summary.total, summaryPassed: saved.summary.passed, nativeChildKind: 'Test' });
    }
    const detailedUrl = pathToFileURL(detailedHtml).href;
    for (const [slug, title, detail] of [
      ['a-failing-fact', 'A failing Fact', 'Expected 2 but received 3'],
      ['a-skipped-fact', 'A skipped Fact', 'Requires an unavailable service'],
      ['addition-left-1-right-2-expected-3', 'Addition(left: 1, right: 2, expected: 3)', 'Passed'],
      ['addition-left-2-right-2-expected-5', 'Addition(left: 2, right: 2, expected: 5)', 'Expected 5 but received 4'],
    ]) {
      await page.goto(`${detailedUrl}#/plain-tests/${slug}`);
      await page.getByRole('heading', { name: `Test: ${title}`, exact: true }).waitFor();
      assert((await page.getByText(detail, { exact: true }).count()) > 0, `Native details missing: ${title}`);
      if (title.startsWith('Addition(')) assert.equal(await page.getByRole('table').getByRole('row').count(), 2);
    }
    await page.goto(`${detailedUrl}#/plain-tests`);
    await page.getByRole('heading', { name: 'Tests', exact: true }).waitFor();
    assert.equal(await page.getByRole('listitem').count(), 5);
    const filter = page.getByPlaceholder('Filter… (type @ to add tag)');
    await filter.fill('@theory');
    await page.getByRole('option', { name: 'theory', exact: true }).click();
    assert.equal(await page.getByRole('listitem').count(), 2);
    await filter.fill('Addition(left: 2');
    assert.equal(await page.getByRole('listitem').count(), 1);
    await page.goto(`${detailedUrl}#/plain-tests/example-native-plaintests-adding-one-and-one-returns-two`);
    await page.getByRole('heading', { name: 'Test: Adding_one_and_one_returns_two', exact: true }).waitFor();
    await page.getByRole('button', { name: 'View all 2 attachments for this test', exact: true }).click();
    await page.getByRole('dialog').getByText('Fact output: 1 + 1 = 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'native-image.svg', exact: true }).click();
    const toolbar = page.getByRole('toolbar', { name: 'Image zoom', exact: true });
    await toolbar.getByRole('button', { name: 'Actual size', exact: true }).click();
    await page.getByRole('region', { name: 'Image viewport', exact: true }).hover();
    await page.keyboard.down('Control');
    try { await page.mouse.wheel(0, -100); } finally { await page.keyboard.up('Control'); }
    await toolbar.getByRole('status').getByText('150%', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(`${pathToFileURL(minimalHtml).href}#/group`);
      await page.getByRole('heading', { name: 'Root', exact: true }).waitFor();
      assert.equal(await page.getByRole('listitem').count(), 2);
      assert.equal(await page.locator(`[title="LiveDoc Viewer version ${version}"]`).count(), 1);
      assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= width);
      await waitForPresentation();
      await page.screenshot({ path: path.join(evidenceDir, `packaged-documents-${width}.png`), fullPage: true });
      await page.goto(`${detailedUrl}#/plain-tests/addition-left-2-right-2-expected-5`);
      await page.getByRole('heading', { name: 'Test: Addition(left: 2, right: 2, expected: 5)', exact: true }).waitFor();
      assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= width);
      await waitForPresentation();
      await page.screenshot({ path: path.join(evidenceDir, `packaged-theory-${width}.png`), fullPage: true });
    }
    assert((await readFile(detailedHtml, 'utf8')).includes('Standard test containers'));
    await writeFile(path.join(evidenceDir, 'package-verification.json'), JSON.stringify({
      version, results, nativeFactStatuses: ['passed', 'failed', 'skipped'], theoryRows: 2,
      plainResults: 'Native results without extra details stay inline; existing direct links remain valid',
      testTypeSettings: 'Installed CLI and static HTML exclude/restore standard tests with 2/1/2 totals and remembered settings after reload',
      qualifiedNames: 'Qualified native method displays only Adding_one_and_one_returns_two; canonical saved link remains qualified',
      filters: 'tag @theory: 2; title Addition(left: 2: 1', attachment: 'stdout.txt',
      ctrlWheel: 'Packaged static HTML image: Ctrl-wheel -100 changes 100% to 150%',
      viewports: [1440, 390],
    }, null, 2));
    console.log('Native Viewer package browser verification passed: expected documents 2, actual 2; summary total/passed 2; saved Standard/Test, Fact/Theory details, tags/search, deep links, stdout evidence, desktop/mobile.');
  } finally {
    await browser.close();
  }
} else {
  throw new Error('Use --fixtures <stage> or --browser <base-url> <minimal-html> <detailed-html> <evidence-dir> <version>');
}
