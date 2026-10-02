import { afterAll, beforeAll, expect } from 'vitest';
import { feature, scenario, scenarioOutline, given, when, Then as then, and } from '@swedevtools/livedoc-vitest';
import { useBrowser } from '@swedevtools/livedoc-vitest/playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const { page } = useBrowser();
let server: ViteDevServer;
let baseUrl: string;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../src/client'),
    plugins: [react(), tailwindcss()],
    define: { __LIVEDOC_VIEWER_VERSION__: JSON.stringify('test') },
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Attachment fixture server has no port');
  baseUrl = `http://127.0.0.1:${address.port}/mermaid-fixture.html`;
});

afterAll(async () => {
  await server?.close();
});

async function openJson(name: string, stepGallery = false, width = 1280) {
  await page().setViewportSize({ width, height: 720 });
  const url = stepGallery ? `${baseUrl}?step-gallery`
    : ['collections.json', 'response.json', 'null.json', 'search.json', 'scalar-string.json'].includes(name)
      ? `${baseUrl}?json-cases` : baseUrl;
  await page().goto(url);
  await page().getByRole('button', { name: 'Open attachment gallery' }).click();
  if (!stepGallery) await page().getByRole('button', { name }).click();
  await preview().waitFor({ state: 'visible' });
  await preview().click({ trial: true });
}

const preview = () => page().getByRole('region', { name: 'JSON preview' });
const tree = () => preview().getByRole('tree', { name: 'JSON view' });
const root = () => tree().locator(':scope > [role="treeitem"]');
const children = (parent: ReturnType<typeof root>) =>
  parent.locator(':scope > [role="group"] > [role="treeitem"]');
const field = (parent: ReturnType<typeof root>, name: string) =>
  children(parent).filter({ has: page().locator(':scope > span').filter({ hasText: new RegExp(`^"${name}":$`) }) });
const rootField = (name: string) => field(root(), name);
const toggle = (item: ReturnType<typeof root>) => item.locator(':scope > [role="button"]');

async function keyTextLeft(item: ReturnType<typeof root>, name: string) {
  return item.locator(':scope > span').filter({ hasText: new RegExp(`^"${name}":$`) })
    .evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().left;
    });
}

const searchPanel = () => page().getByRole('dialog', { name: 'Search JSON', exact: true });
const searchInput = () => searchPanel().getByRole('textbox', { name: 'Search keys and values' });

async function searchFor(query: string) {
  await page().getByRole('button', { name: 'Search JSON', exact: true }).click();
  await searchInput().fill(query);
}

async function activeHighlight() {
  return page().evaluate(() => {
    const ranges = Array.from(CSS.highlights.get('livedoc-json-active') ?? []);
    return ranges.map(range => {
      if (!(range instanceof Range)) throw new Error('Expected a rendered text range');
      const element = range.startContainer.parentElement!;
      const preview = element.closest('[aria-label="JSON preview"]')!;
      const ancestors: string[] = [];
      let parent: Element | null = element.closest('[role="treeitem"]')?.parentElement?.closest('[role="treeitem"]') ?? null;
      while (parent) {
        const label = parent.querySelector(':scope > .livedoc-json-label')?.textContent;
        if (label) ancestors.unshift(label);
        parent = parent.parentElement?.closest('[role="treeitem"]') ?? null;
      }
      const bounds = range.getBoundingClientRect();
      const viewport = preview.getBoundingClientRect();
      return { text: range.toString(), fieldText: element.textContent, ancestors,
        background: getComputedStyle(element, '::highlight(livedoc-json-active)').backgroundColor,
        top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
        viewportTop: viewport.top, viewportBottom: viewport.bottom,
        viewportLeft: viewport.left, viewportRight: viewport.right };
    });
  });
}

async function expectActiveText(text: string) {
  await expect.poll(async () => (await activeHighlight()).map(range => range.text)).toContain(text);
  const ranges = await activeHighlight();
  expect(ranges[0].background).not.toBe('rgba(0, 0, 0, 0)');
  expect(ranges[0].top).toBeGreaterThanOrEqual(ranges[0].viewportTop);
  expect(ranges[0].bottom).toBeLessThanOrEqual(ranges[0].viewportBottom);
}

feature(`Interactive JSON Attachment Previews
  Nested JSON remains readable as a tree without changing attachment copy or fallback behavior.
`, () => {
  scenario("The 'tree.json' header and expanded root show sibling fields while 'profile' begins collapsed", () => {
    given("the attachment gallery is open", async () => {
      await page().setViewportSize({ width: 1280, height: 720 });
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'tree.json'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await preview().waitFor();
    });

    then("its header shows 'application/json' and its root shows 'status', 'profile', and 'entries'", async (ctx) => {
      const [mime, status, profile, entries] = ctx.step.values as string[];
      expect(await page().getByRole('dialog').getByText(mime, { exact: true }).isVisible()).toBe(true);
      expect(await toggle(root()).getAttribute('aria-expanded')).toBe('true');
      for (const field of [status, profile, entries]) expect(await rootField(field).isVisible()).toBe(true);
      expect(await toggle(rootField(profile)).getAttribute('aria-expanded')).toBe('false');
      expect(await preview().getByText('"ready"', { exact: true }).isVisible()).toBe(true);
    });
  });

  scenario("Arrow keys collapse and expand the 'tree.json' root without navigating the gallery", () => {
    given("the 'tree.json' root is expanded", async (ctx) => {
      await openJson(ctx.step.values[0] as string);
      await toggle(root()).focus();
    });

    when("pressing 'ArrowLeft' on the root", async (ctx) => {
      await page().keyboard.press(ctx.step.values[0] as string);
    });

    then("'status' disappears and the root reports aria-expanded 'false'", async (ctx) => {
      expect(await toggle(root()).getAttribute('aria-expanded')).toBe(String(ctx.step.values[1]));
      expect(await rootField(ctx.step.values[0] as string).count()).toBe(0);
      expect(await page().getByRole('dialog').getByText('tree.json').first().isVisible()).toBe(true);
    });

    and("pressing 'ArrowRight' restores 'status'", async (ctx) => {
      await page().keyboard.press(ctx.step.values[0] as string);
      expect(await rootField(ctx.step.values[1] as string).isVisible()).toBe(true);
    });
  });

  scenario("A disclosure remains keyboard-operable in the 'tree.json' step gallery", () => {
    given("the 'tree.json' step gallery is open", async (ctx) => {
      await openJson(ctx.step.values[0] as string, true);
      await toggle(root()).focus();
    });

    when("pressing 'ArrowLeft' in the tree", async (ctx) => {
      await page().keyboard.press(ctx.step.values[0] as string);
    });

    then("the root reports aria-expanded 'false' and 'status' is hidden", async (ctx) => {
      expect(await toggle(root()).getAttribute('aria-expanded')).toBe(String(ctx.step.values[0]));
      expect(await rootField(ctx.step.values[1] as string).count()).toBe(0);
    });
  });

  scenario("Nested 'profile' and 'options' disclose 'Ada' and 'night' independently", () => {
    given("the 'tree.json' attachment is open", async (ctx) => {
      await openJson(ctx.step.values[0] as string);
    });

    when("expanding 'profile' and its 'options'", async (ctx) => {
      const [profile, options] = ctx.step.values as string[];
      await toggle(rootField(profile)).click();
      const optionsItem = children(rootField(profile)).filter({ has: page().getByText(`"${options}":`, { exact: true }) });
      await toggle(optionsItem).click();
    });

    then("'Ada' and 'night' are shown, then hidden when 'profile' collapses", async (ctx) => {
      const [name, theme, profile] = ctx.step.values as string[];
      for (const value of [name, theme]) expect(await preview().getByText(`"${value}"`, { exact: true }).isVisible()).toBe(true);
      await toggle(rootField(profile)).click();
      for (const value of [name, theme]) expect(await preview().getByText(`"${value}"`, { exact: true }).count()).toBe(0);
    });
  });

  scenario("The 'entries' array groups indexed objects and nested 'tags' together", () => {
    given("the 'tree.json' attachment is open", async (ctx) => {
      await openJson(ctx.step.values[0] as string);
    });

    when("expanding 'entries', its first object, and 'tags'", async (ctx) => {
      const [entries, tags] = ctx.step.values as string[];
      await toggle(rootField(entries)).click();
      await toggle(children(rootField(entries)).first()).click();
      await toggle(children(children(rootField(entries)).first()).filter({
        has: page().getByText(`"${tags}":`, { exact: true }),
      })).click();
    });

    then("'one' and 'two' appear inside the first 'entries' object under 'tags'", async (ctx) => {
      const [one, two, entries, tags] = ctx.step.values as string[];
      const firstObject = children(rootField(entries)).first();
      const tagsItem = children(firstObject).filter({ has: page().getByText(`"${tags}":`, { exact: true }) });
      for (const value of [one, two]) {
        expect(await tagsItem.getByText(`"${value}"`, { exact: true }).isVisible()).toBe(true);
      }
      expect(await toggle(firstObject).getAttribute('aria-expanded')).toBe('true');
    });
  });

  scenario("The 'response.json' root keeps 'SchemaVersion', 'Status', 'StatusUpdatedUtc', 'Error', and 'emptyArray' at one depth", () => {
    given("the 'response.json' attachment is open at '1280' pixels", async (ctx) => {
      await page().setViewportSize({ width: ctx.step.values[1] as number, height: 720 });
      await openJson(ctx.step.values[0] as string);
    });

    when("expanding 'Error' to inspect its 'dependencies'", async (ctx) => {
      await toggle(rootField(ctx.step.values[0] as string)).click();
    });

    then("'SchemaVersion', 'Status', 'StatusUpdatedUtc', 'Error', and 'emptyArray' key text aligns within '1' pixel, while 'dependencies' belongs inside 'Error'", async (ctx) => {
      const names = (ctx.step.values as string[]).slice(0, 5);
      const tolerance = ctx.step.values[5] as number;
      const positions = await Promise.all(names.map(name => keyTextLeft(rootField(name), name)));
      expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(tolerance);
      const error = rootField(names[3]);
      const dependenciesName = ctx.step.values[6] as string;
      const dependencies = children(error).filter({ has: page().getByText(`"${dependenciesName}":`, { exact: true }) });
      expect(await dependencies.count()).toBe(1);
      const errorLabelLeft = await error.getByText(`"${names[3]}":`, { exact: true })
        .evaluate(element => element.getBoundingClientRect().left);
      expect(await dependencies.getByText(`"${dependenciesName}":`, { exact: true })
        .evaluate(element => element.getBoundingClientRect().left)).toBeGreaterThan(errorLabelLeft);
      await toggle(dependencies).click();
      await toggle(children(dependencies).first()).click();
      expect(await children(children(dependencies).first()).getByText('"name":', { exact: true }).isVisible()).toBe(true);
      expect(await children(children(dependencies).first()).getByText('"database"', { exact: true }).isVisible()).toBe(true);
    });
  });

  scenarioOutline(`Root collection key text stays aligned at <width> pixels with containers <state>
    Examples:
    | width | state     |
    | 1280  | collapsed |
    | 1280  | expanded  |
    | 375   | collapsed |
    | 375   | expanded  |
  `, () => {
    given("the large 'collections.json' attachment is open at <width> pixels", async (ctx) => {
      await openJson(ctx.step.values[0] as string, false, ctx.example.width as number);
    });

    when("'services', 'summary', 'records', and 'Error' are <state>", async (ctx) => {
      for (const name of ctx.step.values as string[]) {
        if (ctx.example.state === 'expanded') await toggle(rootField(name)).click();
        expect(await toggle(rootField(name)).getAttribute('aria-expanded'))
          .toBe(String(ctx.example.state === 'expanded'));
      }
    });

    then("key text for 'documentType', 'services', 'summary', 'records', 'Error', 'emptyArray', 'emptyObject', and 'optional' aligns within '1' pixel", async (ctx) => {
      const names = ctx.step.values.slice(0, -1) as string[];
      const tolerance = ctx.step.values.at(-1) as number;
      const positions = await Promise.all(names.map(name => keyTextLeft(rootField(name), name)));
      expect(Math.max(...positions) - Math.min(...positions), JSON.stringify({ names, positions }))
        .toBeLessThanOrEqual(tolerance);
    });
  });

  scenarioOutline(`Nested collection key text keeps one indent at <width> pixels with dependencies <state>
    Examples:
    | width | state     |
    | 1280  | collapsed |
    | 1280  | expanded  |
    | 375   | collapsed |
    | 375   | expanded  |
  `, () => {
    given("the large 'collections.json' attachment is open at <width> pixels with 'Error' expanded", async (ctx) => {
      await openJson(ctx.step.values[0] as string, false, ctx.example.width as number);
      await toggle(rootField(ctx.step.values[1] as string)).click();
    });

    when("'dependencies' inside 'Error' is <state>", async (ctx) => {
      const [dependencies, error] = ctx.step.values as string[];
      const item = field(rootField(error), dependencies);
      if (ctx.example.state === 'expanded') await toggle(item).click();
      expect(await toggle(item).getAttribute('aria-expanded')).toBe(String(ctx.example.state === 'expanded'));
    });

    then("inside 'Error', key text for 'httpStatusCode', 'dependencies', 'emptyArray', 'emptyObject', and 'optional' aligns within '1' pixel and is indented '28' pixels from its parent within '1' pixel", async (ctx) => {
      const error = rootField(ctx.step.values[0] as string);
      const names = ctx.step.values.slice(1, 6) as string[];
      const [tolerance, indent, indentTolerance] = ctx.step.values.slice(6) as number[];
      const positions = await Promise.all(names.map(name =>
        keyTextLeft(field(error, name), name)));
      expect(Math.max(...positions) - Math.min(...positions), JSON.stringify({ names, positions }))
        .toBeLessThanOrEqual(tolerance);
      expect(Math.abs(positions[0] - await keyTextLeft(error, ctx.step.values[0] as string) - indent))
        .toBeLessThanOrEqual(indentTolerance);
    });
  });

  scenario("At '375' pixels, 'response.json' keeps long values inside the preview and shows special values", () => {
    given("the 'response.json' attachment is open at '375' pixels", async (ctx) => {
      await openJson(ctx.step.values[0] as string, false, ctx.step.values[1] as number);
    });

    when("expanding 'Error' to read 'message' and 'httpStatusCode'", async (ctx) => {
      await toggle(rootField(ctx.step.values[0] as string)).click();
    });

    then("'emptyArray' is '[]', 'emptyObject' is '{}', 'emptyString' is '\"\"', 'zero' is '0', and 'provider' stays indented under 'Error' with nested 'null' and 'false' without overflow", async (ctx) => {
      const error = rootField('Error');
      const [arrayName, arrayValue, objectName, objectValue, stringName, stringValue, zeroName, zeroValue, provider, , nullValue, falseValue] = ctx.step.valuesRaw;
      const errorLabelLeft = await error.getByText('"Error":', { exact: true }).evaluate(element => element.getBoundingClientRect().left);
      const providerLabelLeft = await children(error).getByText(`"${provider}":`, { exact: true })
        .evaluate(element => element.getBoundingClientRect().left);
      expect(providerLabelLeft).toBeGreaterThan(errorLabelLeft);
      expect(await children(error).getByText(nullValue, { exact: true }).isVisible()).toBe(true);
      await toggle(children(error).filter({ has: page().getByText('"dependencies":', { exact: true }) })).click();
      await toggle(children(children(error).filter({ has: page().getByText('"dependencies":', { exact: true }) })).first()).click();
      expect(await preview().getByText(falseValue, { exact: true }).isVisible()).toBe(true);
      for (const [name, value] of [[arrayName, arrayValue], [objectName, objectValue], [stringName, stringValue], [zeroName, zeroValue]]) {
        expect(await rootField(name).textContent()).toContain(value);
      }
      const bounds = await page().evaluate(() => {
        const viewport = document.querySelector('[aria-label="JSON preview"]')!.getBoundingClientRect();
        const dialog = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
        const container = document.querySelector('[aria-label="JSON preview"]')!;
        return { viewportLeft: viewport.left, viewportRight: viewport.right, dialogRight: dialog.right, width: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          contentWidth: container.scrollWidth, availableWidth: container.clientWidth };
      });
      expect(bounds.viewportLeft).toBeGreaterThanOrEqual(0);
      expect(bounds.viewportRight).toBeLessThanOrEqual(bounds.dialogRight);
      expect(bounds.dialogRight).toBeLessThanOrEqual(bounds.width);
      expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.width);
      expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.availableWidth + 1);
    });
  });

  scenario("A 'numbers.json' root array expands its nested object", () => {
    given("the 'numbers.json' attachment is open", async (ctx) => {
      await openJson(ctx.step.values[0] as string);
    });

    when("expanding the object at index '1'", async (ctx) => {
      await toggle(children(root()).nth(ctx.step.values[0] as number)).click();
    });

    then("the array shows '1' and nested value 'two'", async (ctx) => {
      expect(await toggle(root()).getAttribute('aria-expanded')).toBe('true');
      expect(await children(root()).getByText(String(ctx.step.values[0]), { exact: true }).isVisible()).toBe(true);
      expect(await preview().getByText(`"${ctx.step.values[1]}"`, { exact: true }).isVisible()).toBe(true);
    });
  });

  scenario("Switching from 'tree.json' to 'other.json' and back resets nested disclosure state", () => {
    given("the 'tree.json' profile is expanded to show 'Ada'", async (ctx) => {
      await openJson(ctx.step.values[0] as string);
      await toggle(rootField('profile')).click();
      expect(await preview().getByText(`"${ctx.step.values[1]}"`, { exact: true }).isVisible()).toBe(true);
    });

    when("selecting 'other.json' with 'second' then returning to 'tree.json' with 'ready'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await preview().getByText(`"${ctx.step.values[1]}"`, { exact: true }).waitFor({ state: 'visible' });
      await page().getByRole('button', { name: ctx.step.values[2] as string }).click();
      await preview().getByText(`"${ctx.step.values[3]}"`, { exact: true }).waitFor({ state: 'visible' });
    });

    then("'profile' is collapsed and 'Ada' is hidden", async (ctx) => {
      expect(await toggle(rootField(ctx.step.values[0] as string)).getAttribute('aria-expanded')).toBe('false');
      expect(await preview().getByText(`"${ctx.step.values[1]}"`, { exact: true }).count()).toBe(0);
    });
  });

  scenario("Copying collapsed 'tree.json' includes hidden 'Ada' and 'one'", () => {
    given("the 'tree.json' attachment is open", async (ctx) => {
      await openJson(ctx.step.values[0] as string);
      await page().evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async (text: string) => { document.documentElement.dataset.copiedJson = text; } },
        });
      });
    });

    when("selecting 'Copy'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string, exact: true }).click();
    });

    then("copied JSON still contains 'Ada' and 'one'", async (ctx) => {
      const copied = await page().evaluate(() => document.documentElement.dataset.copiedJson);
      expect(copied).toBeDefined();
      expect(JSON.parse(copied!).profile.user).toBe(ctx.step.values[0]);
      expect(JSON.parse(copied!).entries[0].tags[0]).toBe(ctx.step.values[1]);
    });
  });

  scenario("A 'null.json' root value is visible without a disclosure", () => {
    given("the attachment gallery is open", async () => {
      await page().goto(`${baseUrl}?json-cases`);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'null.json'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await preview().waitFor();
    });

    then("'null' is displayed without an expandable tree", async (ctx) => {
      expect(await preview().getByText(ctx.step.valuesRaw[0], { exact: true }).isVisible()).toBe(true);
      expect(await tree().count()).toBe(0);
    });
  });

  scenario("Invalid 'invalid.json' shows raw source and remains copyable", () => {
    given("the attachment gallery is open", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async (text: string) => { document.documentElement.dataset.copiedJson = text; } },
        });
      });
    });

    when("selecting 'invalid.json'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await preview().waitFor();
    });

    then(`the warning and raw source appear without a tree
      """
      {"broken":,}
      """
      `, async (ctx) => {
      await preview().getByText(ctx.step.docString, { exact: true }).waitFor({ state: 'visible' });
      expect(await page().getByRole('alert').getByText('Invalid JSON — showing raw content').isVisible()).toBe(true);
      expect(await tree().count()).toBe(0);
      expect(await page().getByRole('button', { name: 'Search JSON', exact: true }).count()).toBe(0);
    });

    and(`selecting 'Copy' places raw source on the clipboard
      """
      {"broken":,}
      """
      `, async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string, exact: true }).click();
      expect(await page().evaluate(() => document.documentElement.dataset.copiedJson)).toBe(ctx.step.docString);
    });
  });

});

feature(`Searching JSON Attachments
  Find relevant evidence without expanding every collection or altering the attachment.
`, () => {
    scenario("Searching 'NIGHT' reveals and highlights 'night' inside collapsed 'profile' and 'options' only", () => {
      given("the 'tree.json' attachment has collapsed 'profile' and 'entries'", async (ctx) => {
        await openJson(ctx.step.values[0] as string);
        for (const name of ctx.step.values.slice(1) as string[]) {
          expect(await toggle(rootField(name)).getAttribute('aria-expanded')).toBe('false');
        }
      });
      when("searching for 'NIGHT'", async (ctx) => { await searchFor(ctx.step.values[0] as string); });
      then("'night' is visibly highlighted, the status is '1 of 1', and unrelated 'entries' stays collapsed", async (ctx) => {
        await expectActiveText(ctx.step.values[0] as string);
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[1]);
        expect(await toggle(rootField(ctx.step.values[2] as string)).getAttribute('aria-expanded')).toBe('false');
        const highlights = await page().evaluate(() => {
          const element = document.querySelector('.livedoc-json-value')!;
          return {
            match: getComputedStyle(element, '::highlight(livedoc-json-match)').backgroundColor,
            active: getComputedStyle(element, '::highlight(livedoc-json-active)').backgroundColor,
          };
        });
        expect(highlights.match).not.toBe(highlights.active);
      });
    });

    scenario("Searching 'name' distinguishes repeated keys and values, wraps, and reveals a manually collapsed ancestor", () => {
      given("the 'search.json' attachment is searching for 'name'", async (ctx) => {
        await openJson(ctx.step.values[0] as string);
        await searchFor(ctx.step.values[1] as string);
      });
      when("advancing with 'Enter' from the root key to its identical value", async (ctx) => {
        await page().keyboard.press(ctx.step.values[0] as string);
      });
      then("status '2 of 5' highlights the root value for 'name' rather than its key label", async (ctx) => {
        const name = ctx.step.values[1] as string;
        await expect.poll(async () => (await activeHighlight())[0]?.fieldText).toBe(JSON.stringify(name));
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[0]);
        expect((await activeHighlight())[0].fieldText).not.toBe(`${JSON.stringify(name)}:`);
      });
      and("using 'Shift+Enter' twice wraps to '5 of 5' at the nested key under 'branch' and 'nested'", async (ctx) => {
        await page().keyboard.press(ctx.step.values[0] as string);
        await page().keyboard.press(ctx.step.values[0] as string);
        await expect.poll(async () => (await activeHighlight())[0]?.fieldText).toBe('"name":');
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[1]);
        const branch = rootField(ctx.step.values[2] as string);
        const nested = field(branch, ctx.step.values[3] as string);
        expect(await toggle(branch).getAttribute('aria-expanded')).toBe('true');
        expect(await toggle(nested).getAttribute('aria-expanded')).toBe('true');
        expect((await activeHighlight())[0].ancestors)
          .toEqual([ctx.step.values[2], ctx.step.values[3]].map(name => `${JSON.stringify(name)}:`));
      });
      and("collapsing 'branch', then clicking 'Previous JSON match' reveals its value 'name' again at '4 of 5'", async (ctx) => {
        const branch = rootField(ctx.step.values[0] as string);
        await toggle(branch).click();
        expect(await toggle(branch).getAttribute('aria-expanded')).toBe('false');
        await page().getByRole('button', { name: 'Search JSON', exact: true }).click();
        await searchPanel().getByRole('button', { name: ctx.step.values[1] as string }).click();
        await expect.poll(() => toggle(branch).getAttribute('aria-expanded')).toBe('true');
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[3]);
        await expectActiveText(ctx.step.values[2] as string);
      });
    });

    scenarioOutline(`Search treats <query> literally and highlights <visible> in wrapped Unicode text at <width> pixels
      Examples:
      | query   | visible | width |
      | .*[x]   | .*[x]   | 1280  |
      | 中文    | 中文    | 375   |
      | CAFÉ    | Café    | 375   |
      | "quoted"| quoted  | 1280  |
      | ος      | ΟΣ      | 1280  |
      | 🛰️      | 🛰️      | 375   |
      | i̇       | İ       | 375   |
    `, () => {
      given("the 'search.json' attachment is open at <width> pixels", async (ctx) => {
        await openJson(ctx.step.values[0] as string, false, ctx.example.width as number);
      });
      when("searching for <query>", async (ctx) => { await searchFor(ctx.example.query as string); });
      then("the status is '1 of 1' with <visible> highlighted and the panel inside the viewport", async (ctx) => {
        const visible = ctx.example.visible as string;
        await expect.poll(async () => (await activeHighlight()).some(range => range.text.includes(visible))).toBe(true);
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[0]);
        const bounds = await searchPanel().boundingBox();
        const width = ctx.example.width as number;
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        const sizes = await preview().evaluate(element => ({
          content: element.scrollWidth, viewport: element.clientWidth, document: document.documentElement.scrollWidth,
        }));
        expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);
        expect(sizes.document).toBeLessThanOrEqual(width);
      });
    });

    scenario("No matches disables navigation and clearing removes highlights without losing useful expansion", () => {
      given("the 'tree.json' attachment is searching for 'night'", async (ctx) => {
        await openJson(ctx.step.values[0] as string);
        await searchFor(ctx.step.values[1] as string);
        await expectActiveText(ctx.step.values[1] as string);
      });
      when("replacing the query with 'no-such-value'", async (ctx) => { await searchInput().fill(ctx.step.values[0] as string); });
      then("status 'No matches' disables 'Previous JSON match' and 'Next JSON match'", async (ctx) => {
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[0]);
        for (const label of ctx.step.values.slice(1) as string[]) {
          expect(await searchPanel().getByRole('button', { name: label }).isDisabled()).toBe(true);
        }
      });
      and("selecting 'Clear JSON search' focuses the empty input, shows 'Type to search', and keeps 'profile' expanded", async (ctx) => {
        await searchPanel().getByRole('button', { name: ctx.step.values[0] as string }).click();
        expect(await searchInput().inputValue()).toBe('');
        expect(await searchInput().evaluate(element => element === document.activeElement)).toBe(true);
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[1]);
        expect(await toggle(rootField(ctx.step.values[2] as string)).getAttribute('aria-expanded')).toBe('true');
        await expect.poll(() => page().evaluate(() => CSS.highlights.get('livedoc-json-active')?.size ?? 0)).toBe(0);
      });
    });

    scenario("Search autofocus, gallery-safe typing, Escape, and scoped Ctrl+F keep the attachment open", () => {
      given("the 'tree.json' attachment is open", async (ctx) => { await openJson(ctx.step.values[0] as string); });
      when("opening 'Search JSON' and typing 'night' with 'ArrowLeft', 'Home', and 'End'", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string, exact: true }).click();
        expect(await searchInput().evaluate(element => element === document.activeElement)).toBe(true);
        await searchInput().fill(ctx.step.values[1] as string);
        for (const key of ctx.step.values.slice(2) as string[]) await page().keyboard.press(key);
      });
      then("'tree.json' remains open and 'Escape' closes only the panel and restores focus to 'Search JSON'", async (ctx) => {
        expect(await page().getByRole('banner').getByText(ctx.step.values[0] as string, { exact: true }).isVisible()).toBe(true);
        await page().keyboard.press(ctx.step.values[1] as string);
        await searchPanel().waitFor({ state: 'hidden' });
        await expect.poll(() => page().getByRole('button', { name: ctx.step.values[2] as string, exact: true })
          .evaluate(element => element === document.activeElement)).toBe(true);
      });
      and("'Control+f' opens the panel with its existing 'night' query", async (ctx) => {
        await page().keyboard.press(ctx.step.values[0] as string);
        await searchPanel().waitFor({ state: 'visible' });
        expect(await searchInput().inputValue()).toBe(ctx.step.values[1]);
      });
    });

    scenario("Leaving 'tree.json' for 'other.json' resets search, then returning starts with collapsed 'profile'", () => {
      given("the 'tree.json' attachment is searching for 'night'", async (ctx) => {
        await openJson(ctx.step.values[0] as string);
        await searchFor(ctx.step.values[1] as string);
        await expectActiveText(ctx.step.values[1] as string);
      });
      when("selecting 'other.json', reopening search, and returning to 'tree.json'", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        await preview().getByText('"second"', { exact: true }).waitFor();
        expect(await searchPanel().count()).toBe(0);
        await searchFor('');
        expect(await searchInput().inputValue()).toBe('');
        await page().getByRole('button', { name: ctx.step.values[1] as string }).click();
        await preview().getByText('"ready"', { exact: true }).waitFor();
      });
      then("'profile' is collapsed and active highlights are absent", async (ctx) => {
        expect(await toggle(rootField(ctx.step.values[0] as string)).getAttribute('aria-expanded')).toBe('false');
        expect(await searchPanel().count()).toBe(0);
        await expect.poll(() => page().evaluate(() => CSS.highlights.get('livedoc-json-active')?.size ?? 0)).toBe(0);
      });
    });

    scenarioOutline(`JSON search finds <query> in <attachment> with status <status>
      Examples:
      | attachment        | query  | status |
      | null.json         | null   | 1 of 1 |
      | scalar-string.json| 中文   | 1 of 1 |
      | numbers.json      | two    | 1 of 1 |
      | search.json       | false  | 1 of 1 |
    `, () => {
      given("the <attachment> attachment is open", async (ctx) => { await openJson(ctx.example.attachment as string); });
      when("searching for <query>", async (ctx) => { await searchFor(String(ctx.example.query)); });
      then("status is <status> and <query> is visibly highlighted", async (ctx) => {
        await expectActiveText(String(ctx.example.query));
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.example.status);
      });
    });

    scenario("Searching for empty collection values '[]' and '{}' in 'search.json' highlights their displayed brackets", () => {
      given("the 'search.json' attachment is open", async (ctx) => { await openJson(ctx.step.values[0] as string); });
      when("searching for '[]'", async (ctx) => { await searchFor(ctx.step.valuesRaw[0]); });
      then("'[]' is highlighted with status '1 of 1'", async (ctx) => {
        await expectActiveText(ctx.step.valuesRaw[0]);
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[1]);
      });
      and("replacing the query with '{}' highlights '{}' with status '1 of 1'", async (ctx) => {
        await searchInput().fill(ctx.step.valuesRaw[0]);
        await expectActiveText(ctx.step.valuesRaw[1]);
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[2]);
      });
    });

    scenario("Navigating '50' database fields in 'collections.json' scrolls only the JSON viewport", () => {
      given("the large 'collections.json' attachment is searching for 'database'", async (ctx) => {
        await openJson(ctx.step.values[0] as string);
        await searchFor(ctx.step.values[1] as string);
        await expectActiveText(ctx.step.values[1] as string);
      });
      when("using 'Shift+Enter' to wrap to the final matching field", async (ctx) => {
        await page().keyboard.press(ctx.step.values[0] as string);
      });
      then("status is '50 of 50', 'database' is highlighted under 'Error', and window scroll stays '0'", async (ctx) => {
        await expectActiveText(ctx.step.values[1] as string);
        expect(await searchPanel().getByRole('status').textContent()).toContain(ctx.step.values[0]);
        expect(await toggle(rootField(ctx.step.values[2] as string)).getAttribute('aria-expanded')).toBe('true');
        expect(await page().evaluate(() => window.scrollY)).toBe(ctx.step.values[3]);
        expect(await preview().evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      });
    });

    scenario("Copy and Download retain the complete 'search.json' while searching for 'name'", () => {
      given("the 'search.json' attachment is searching for 'name'", async (ctx) => {
        await openJson(ctx.step.values[0] as string);
        await searchFor(ctx.step.values[1] as string);
        await page().evaluate(() => {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: async (text: string) => { document.documentElement.dataset.copiedJson = text; } },
          });
          HTMLAnchorElement.prototype.click = function () { document.documentElement.dataset.downloadHref = this.href; };
        });
      });
      when("closing search with 'Escape', then selecting 'Copy' and 'Download'", async (ctx) => {
        await page().keyboard.press(ctx.step.values[0] as string);
        for (const label of ctx.step.values.slice(1) as string[]) {
          await page().getByRole('button', { name: label, exact: true }).click();
        }
      });
      then("copied and downloaded JSON both keep 'untouched' with description 'not a search result' and 'numbers' as '[false,0,null,[],{}]'", async (ctx) => {
        const [untouched, description, numbers, expected] = ctx.step.values;
        const contents = await page().evaluate(() => {
          const data = document.documentElement.dataset;
          const encoded = data.downloadHref!.split(',')[1];
          const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
          return { copied: JSON.parse(data.copiedJson!), downloaded: JSON.parse(new TextDecoder().decode(bytes)) };
        });
        for (const content of [contents.copied, contents.downloaded]) {
          expect(content[untouched as string].description).toBe(description);
          expect(content[numbers as string]).toEqual(expected);
        }
        expect(contents.copied).toEqual(contents.downloaded);
      });
    });
});
