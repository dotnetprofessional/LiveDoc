import { afterAll, beforeAll, expect } from 'vitest';
import { feature, scenario, given, when, Then as then, and } from '@swedevtools/livedoc-vitest';
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

feature('Interactive JSON Attachment Previews', () => {
  scenario("A 'tree.json' preview shows its title and MIME while root properties start expanded", () => {
    given("an attachment gallery with 'tree.json'", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'tree.json'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
    });

    then("the 'tree.json' header shows 'application/json', the 'ready' property, and nested 'profile' starts collapsed", async (ctx) => {
      const [title, mime, status, property] = ctx.step.values as string[];
      const preview = page().getByLabel('JSON preview');
      await preview.getByRole('button', { name: `Expand $.${property} object` }).waitFor({ state: 'visible' });
      expect(await page().getByRole('dialog').getByText(title).first().isVisible()).toBe(true);
      expect(await page().getByRole('dialog').getByText(mime, { exact: true }).isVisible()).toBe(true);
      expect(await preview.getByRole('button', { name: 'Collapse $ object' }).getAttribute('aria-expanded')).toBe('true');
      expect(await preview.getByText(JSON.stringify(status), { exact: true }).isVisible()).toBe(true);
      expect(await preview.getByText(JSON.stringify('Ada'), { exact: true }).count()).toBe(0);
    });
  });

  scenario("The 'tree.json' root can be collapsed and expanded with the keyboard", () => {
    given("a 'tree.json' preview with 'ready' visible", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByLabel('JSON preview').getByText(JSON.stringify(ctx.step.values[1]), { exact: true }).waitFor({ state: 'visible' });
    });

    when("pressing 'Enter' on 'Collapse $ object'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[1] as string }).focus();
      await page().keyboard.press(ctx.step.values[0] as string);
    });

    then("the 'ready' property is hidden and 'Expand $ object' has aria-expanded 'false'", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      const button = preview.getByRole('button', { name: ctx.step.values[1] as string });
      await button.waitFor({ state: 'visible' });
      expect(await button.getAttribute('aria-expanded')).toBe(String(ctx.step.values[2]));
      expect(await preview.getByText(JSON.stringify(ctx.step.values[0]), { exact: true }).count()).toBe(0);
    });

    and("pressing 'Space' on 'Expand $ object' restores the 'ready' property", async (ctx) => {
      const button = page().getByRole('button', { name: ctx.step.values[1] as string });
      await button.focus();
      await page().keyboard.press(ctx.step.values[0] as string);
      expect(await page().getByLabel('JSON preview').getByText(JSON.stringify(ctx.step.values[2]), { exact: true }).isVisible()).toBe(true);
    });
  });

  scenario("Space activates a 'tree.json' disclosure even inside a step gallery", () => {
    given("a step gallery showing 'tree.json'", async () => {
      await page().goto(`${baseUrl}?step-gallery`);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByLabel('JSON preview').getByRole('button', { name: 'Collapse $ object' }).waitFor({ state: 'visible' });
    });

    when("pressing 'Space' on 'Collapse $ object'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[1] as string }).focus();
      await page().keyboard.press(ctx.step.values[0] as string);
    });

    then("'Expand $ object' reports aria-expanded 'false' and hides 'ready'", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      const control = preview.getByRole('button', { name: ctx.step.values[0] as string });
      await control.waitFor({ state: 'visible' });
      expect(await control.getAttribute('aria-expanded')).toBe(String(ctx.step.values[1]));
      expect(await preview.getByText(JSON.stringify(ctx.step.values[2]), { exact: true }).count()).toBe(0);
    });
  });

  scenario("Nested 'profile' and 'options' reveal 'Ada' and 'night' independently", () => {
    given("a 'tree.json' preview with collapsed nested objects", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByRole('button', { name: 'Expand $.profile object' }).waitFor({ state: 'visible' });
    });

    when("expanding 'profile' then 'options'", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      await preview.getByRole('button', { name: `Expand $.${ctx.step.values[0]} object` }).click();
      await preview.getByRole('button', { name: `Expand $.${ctx.step.values[0]}.${ctx.step.values[1]} object` }).click();
    });

    then("both 'Ada' and 'night' are visible, and collapsing 'profile' hides both", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      const [name, theme, parent] = ctx.step.values as string[];
      expect(await preview.getByText(JSON.stringify(name), { exact: true }).isVisible()).toBe(true);
      expect(await preview.getByText(JSON.stringify(theme), { exact: true }).isVisible()).toBe(true);
      await preview.getByRole('button', { name: `Collapse $.${parent} object` }).click();
      expect(await preview.getByText(JSON.stringify(name), { exact: true }).count()).toBe(0);
      expect(await preview.getByText(JSON.stringify(theme), { exact: true }).count()).toBe(0);
    });
  });

  scenario("An 'entries' array reveals indexed objects and a nested 'tags' array", () => {
    given("a 'tree.json' preview with the 'entries' array collapsed", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByRole('button', { name: `Expand $.${ctx.step.values[1]} array` }).waitFor({ state: 'visible' });
    });

    when("expanding 'entries', index '0', and its 'tags'", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      const [array, index, nested] = ctx.step.values as string[];
      await preview.getByRole('button', { name: `Expand $.${array} array` }).click();
      await preview.getByRole('button', { name: `Expand $.${array}[${index}] object` }).click();
      await preview.getByRole('button', { name: `Expand $.${array}[${index}].${nested} array` }).click();
    });

    then("array values 'one' and 'two' are visible under index '0'", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      const [one, two, index] = ctx.step.values as string[];
      expect(await preview.getByText(JSON.stringify(one), { exact: true }).isVisible()).toBe(true);
      expect(await preview.getByText(JSON.stringify(two), { exact: true }).isVisible()).toBe(true);
      expect(await preview.getByText(index, { exact: true }).count()).toBeGreaterThan(0);
    });
  });

  scenario("A root 'numbers.json' array expands its nested object", () => {
    given("an attachment gallery with 'numbers.json'", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'numbers.json' and expanding index '1'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByLabel('JSON preview').getByRole('button', { name: `Expand $[${ctx.step.values[1]}] object` }).click();
    });

    then("the root array shows '1' and nested value 'two'", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      expect(await preview.getByRole('button', { name: 'Collapse $ array' }).getAttribute('aria-expanded')).toBe('true');
      expect(await preview.getByText(String(ctx.step.values[0]), { exact: true }).count()).toBeGreaterThan(0);
      expect(await preview.getByText(JSON.stringify(ctx.step.values[1]), { exact: true }).isVisible()).toBe(true);
    });
  });

  scenario("Switching from 'tree.json' to 'other.json' and back resets nested disclosure state", () => {
    given("the 'tree.json' profile is expanded to show 'Ada'", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByRole('button', { name: 'Expand $.profile object' }).click();
      await page().getByLabel('JSON preview').getByText(JSON.stringify(ctx.step.values[1]), { exact: true }).waitFor({ state: 'visible' });
    });

    when("switching to 'other.json'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByLabel('JSON preview').getByText(JSON.stringify('second'), { exact: true }).waitFor({ state: 'visible' });
    });

    then("'Ada' is gone while 'second' and a collapsed 'profile' are visible", async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      expect(await preview.getByText(JSON.stringify(ctx.step.values[0]), { exact: true }).count()).toBe(0);
      expect(await preview.getByText(JSON.stringify(ctx.step.values[1]), { exact: true }).isVisible()).toBe(true);
      expect(await preview.getByRole('button', { name: 'Expand $.profile object' }).getAttribute('aria-expanded')).toBe('false');
    });

    and("returning to 'tree.json' shows 'ready' with 'profile' collapsed", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      const preview = page().getByLabel('JSON preview');
      await preview.getByText(JSON.stringify(ctx.step.values[1]), { exact: true }).waitFor({ state: 'visible' });
      expect(await preview.getByRole('button', { name: 'Expand $.profile object' }).getAttribute('aria-expanded')).toBe('false');
      expect(await preview.getByText(JSON.stringify('Ada'), { exact: true }).count()).toBe(0);
    });
  });

  scenario("Copying a collapsed 'tree.json' preview still copies the full JSON", () => {
    given("a 'tree.json' preview with collapsed 'profile' and 'entries'", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByRole('button', { name: 'Expand $.entries array' }).waitFor({ state: 'visible' });
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

    then("the copied JSON includes hidden values 'Ada' and 'one'", async (ctx) => {
      const copied = await page().evaluate(() => document.documentElement.dataset.copiedJson);
      expect(copied).toBeDefined();
      expect(JSON.parse(copied!).profile.user).toBe(ctx.step.values[0]);
      expect(JSON.parse(copied!).entries[0].tags[0]).toBe(ctx.step.values[1]);
    });
  });

  scenario("Invalid 'invalid.json' shows raw source and remains copyable", () => {
    given("an attachment gallery with 'invalid.json'", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'invalid.json'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().evaluate(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async (text: string) => { document.documentElement.dataset.copiedJson = text; } },
        });
      });
    });

    then(`the warning and raw source appear without disclosure buttons
      """
      {"broken":,}
      """
      `, async (ctx) => {
      const preview = page().getByLabel('JSON preview');
      await preview.getByText(ctx.step.docString, { exact: true }).waitFor({ state: 'visible' });
      expect(await page().getByRole('alert').getByText('Invalid JSON — showing raw content').isVisible()).toBe(true);
      expect(await preview.getByRole('button', { name: /Expand|Collapse/ }).count()).toBe(0);
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
