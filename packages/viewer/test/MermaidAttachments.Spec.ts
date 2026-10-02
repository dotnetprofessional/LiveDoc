import { afterAll, beforeAll, expect } from 'vitest';
import { feature, scenario, scenarioOutline, given, when, Then as then, and, specification, rule, ruleOutline } from '@swedevtools/livedoc-vitest';
import { useBrowser } from '@swedevtools/livedoc-vitest/playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const { page, browser, context } = useBrowser();
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
  if (!address || typeof address === 'string') throw new Error('Mermaid fixture server has no port');
  baseUrl = `http://127.0.0.1:${address.port}/mermaid-fixture.html`;
});

afterAll(async () => {
  await server?.close();
});

async function observeWheel() {
  await page().evaluate(() => {
    document.addEventListener('wheel', (event) => {
      document.documentElement.dataset.observedWheel = JSON.stringify({
        prevented: event.defaultPrevented, ctrl: event.ctrlKey, trusted: event.isTrusted,
      });
    });
  });
}

async function settlePreview() {
  await page().evaluate(async () => {
    await Promise.all(document.getAnimations().filter((animation) =>
      animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {})));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function openWheelAttachment(title: string) {
  await page().setViewportSize({ width: 1280, height: 720 });
  await page().goto(`${baseUrl}?wheel-cases`, { waitUntil: 'domcontentloaded' });
  await observeWheel();
  await page().getByRole('button', { name: 'Open attachment gallery' }).click();
  if (title !== 'large-image.svg') await page().getByRole('button', { name: title, exact: true }).click();
  const region = page().getByRole('region', { name: title.endsWith('.mmd') ? 'Mermaid diagram viewport' : 'Image viewport' });
  await region.locator('img').evaluate((image: HTMLImageElement) => image.decode());
  await settlePreview();
  await page().getByRole('button', { name: 'Actual size' }).click();
  await settlePreview();
  return region;
}

async function actualWheel(target: ReturnType<ReturnType<typeof page>['locator']>, delta: number, ctrl = true) {
  const bounds = (await target.boundingBox())!;
  await page().evaluate(() => { delete document.documentElement.dataset.observedWheel; });
  await page().mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height * 0.45);
  if (ctrl) await page().keyboard.down('Control');
  try {
    await page().mouse.wheel(0, delta);
    await page().waitForFunction(() => document.documentElement.dataset.observedWheel !== undefined);
  } finally {
    if (ctrl) await page().keyboard.up('Control');
  }
  await settlePreview();
  return page().evaluate(() => JSON.parse(document.documentElement.dataset.observedWheel!) as {
    prevented: boolean; ctrl: boolean; trusted: boolean;
  });
}

async function pageMetrics() {
  return page().evaluate(() => ({
    scale: window.visualViewport!.scale, width: window.innerWidth, height: window.innerHeight,
    clientWidth: document.documentElement.clientWidth, pageX: window.scrollX, pageY: window.scrollY,
    pixelRatio: window.devicePixelRatio,
  }));
}

specification(`Attachment modifier-wheel zoom
  Readers can inspect images and Mermaid diagrams without changing the page zoom.
  Browser rules use a 1280 by 720 desktop viewport and trusted mouse input.
`, () => {
  ruleOutline(`Ctrl-wheel <delta>px changes <title> from '100'% to <percent>% with dimension factor <factor> within '0.003' and prevents page zoom
    Examples:
    | title             | delta | percent | factor |
    | large-image.svg   | -100  | 150     | 1.5    |
    | large-image.svg   | 100   | 67      | 0.666667 |
    | large-sequence.mmd | -100 | 150     | 1.5    |
    | large-sequence.mmd | 100  | 67      | 0.666667 |
  `, async (ctx) => {
    const region = await openWheelAttachment(ctx.example.title as string);
    const before = (await region.locator('img').boundingBox())!;
    const metrics = await pageMetrics();
    const wheel = await actualWheel(region, ctx.example.delta as number);
    const after = (await region.locator('img').boundingBox())!;
    expect(wheel).toEqual({ prevented: true, ctrl: true, trusted: true });
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent())
      .toBe(`${ctx.example.percent}%`);
    const tolerance = ctx.rule.values[1] as number;
    expect(Math.abs(after.width / before.width - (ctx.example.factor as number))).toBeLessThan(tolerance);
    expect(Math.abs(after.height / before.height - (ctx.example.factor as number))).toBeLessThan(tolerance);
    expect(await pageMetrics()).toEqual(metrics);
  });

  ruleOutline(`Ctrl-wheel zoom on <title> keeps the image point beneath the pointer within '1.5' CSS pixels after panning '300'px horizontally and '350'px vertically, starting fitted <fit>
    Examples:
    | title             | delta | fit |
    | large-image.svg   | -100  | false |
    | large-image.svg   | 100   | false |
    | large-sequence.mmd | -100 | false |
    | large-sequence.mmd | 100  | false |
    | large-image.svg   | -100 | true |
    | large-image.svg   | 100 | true |
    | large-sequence.mmd | -100 | true |
    | large-sequence.mmd | 100 | true |
  `, async (ctx) => {
    const [tolerance, left, top] = ctx.rule.values as number[];
    const region = await openWheelAttachment(ctx.example.title as string);
    if (ctx.example.fit) {
      await page().getByRole('button', { name: ctx.example.title === 'large-image.svg' ? 'Fit image' : 'Fit diagram' }).click();
      await settlePreview();
    }
    await region.evaluate((element, offsets) => {
      element.scrollLeft = offsets.left; element.scrollTop = offsets.top;
    }, { left, top });
    const viewport = (await region.boundingBox())!;
    const pointer = { x: viewport.x + viewport.width * 0.4, y: viewport.y + viewport.height * 0.45 };
    const before = (await region.locator('img').boundingBox())!;
    const point = { x: (pointer.x - before.x) / before.width, y: (pointer.y - before.y) / before.height };
    await actualWheel(region, ctx.example.delta as number);
    const after = (await region.locator('img').boundingBox())!;
    expect(Math.abs(after.x + point.x * after.width - pointer.x)).toBeLessThan(tolerance);
    expect(Math.abs(after.y + point.y * after.height - pointer.y)).toBeLessThan(tolerance);
  });

  ruleOutline(`Unmodified wheel '100'px scrolls <title> without prevention or changing '100'% zoom
    Examples:
    | title |
    | large-image.svg |
    | large-sequence.mmd |
  `, async (ctx) => {
    const [delta, percent] = ctx.rule.values as number[];
    const region = await openWheelAttachment(ctx.example.title as string);
    const wheel = await actualWheel(region, delta, false);
    await page().waitForFunction((name) => document.querySelector(`[aria-label="${name}"]`)!.scrollTop > 0,
      await region.getAttribute('aria-label'));
    expect(wheel).toEqual({ prevented: false, ctrl: false, trusted: true });
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${percent}%`);
  });

  ruleOutline(`After Ctrl-wheel '-100'px zoom, <title> still pans by dragging '80'px left and '60'px up within '1.5'px, and keyboard 'Enter' on Fit restores the complete preview
    Examples:
    | title |
    | large-image.svg |
    | large-sequence.mmd |
  `, async (ctx) => {
    const [delta, left, top, tolerance, key] = ctx.rule.values as [number, number, number, number, string];
    const region = await openWheelAttachment(ctx.example.title as string);
    await actualWheel(region, delta);
    const before = await region.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
    const bounds = (await region.boundingBox())!;
    const origin = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await page().mouse.move(origin.x, origin.y);
    await page().mouse.down();
    await page().mouse.move(origin.x - left, origin.y - top);
    await page().mouse.up();
    const after = await region.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
    expect(Math.abs(after.left - before.left - left)).toBeLessThan(tolerance);
    expect(Math.abs(after.top - before.top - top)).toBeLessThan(tolerance);
    const fit = page().getByRole('button', { name: ctx.example.title === 'large-image.svg' ? 'Fit image' : 'Fit diagram' });
    await fit.press(key);
    await settlePreview();
    expect(await fit.getAttribute('aria-pressed')).toBe('true');
    const image = (await region.locator('img').boundingBox())!;
    expect(image.x).toBeGreaterThanOrEqual(bounds.x);
    expect(image.y).toBeGreaterThanOrEqual(bounds.y);
    expect(image.x + image.width).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(image.y + image.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  });

  ruleOutline(`Ctrl-wheel <delta>px at the <percent>% zoom limit on <title> remains prevented without page zoom or dimension changes
    Examples:
    | title | control | percent | delta |
    | large-image.svg | Zoom in | 400 | -100 |
    | large-image.svg | Zoom out | 5 | 100 |
    | large-sequence.mmd | Zoom in | 400 | -100 |
    | large-sequence.mmd | Zoom out | 5 | 100 |
  `, async (ctx) => {
    const region = await openWheelAttachment(ctx.example.title as string);
    const control = page().getByRole('button', { name: ctx.example.control as string, exact: true });
    while (await control.isEnabled()) await control.click();
    await settlePreview();
    const before = (await region.locator('img').boundingBox())!;
    const metrics = await pageMetrics();
    const wheel = await actualWheel(region, ctx.example.delta as number);
    const after = (await region.locator('img').boundingBox())!;
    expect(wheel.prevented).toBe(true);
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent())
      .toBe(`${ctx.example.percent}%`);
    expect(await pageMetrics()).toEqual(metrics);
  });

  rule("A '100000'px square image fitted at '1'% stays '1000'px wide when Ctrl-wheel scrolls down '100'px below the manual minimum", async (ctx) => {
    const [naturalWidth, percent, width, delta] = ctx.rule.values as number[];
    await openWheelAttachment('large-image.svg');
    await page().getByRole('button', { name: 'oversized-image.svg', exact: true }).click();
    const region = page().getByRole('region', { name: 'Image viewport' });
    await region.locator('img').evaluate((image: HTMLImageElement) => image.decode());
    await settlePreview();
    expect(await region.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(naturalWidth);
    const metrics = await pageMetrics();
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${percent}%`);
    await expect.poll(async () => (await region.locator('img').boundingBox())!.width).toBe(width);
    expect((await actualWheel(region, delta)).prevented).toBe(true);
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${percent}%`);
    expect((await region.locator('img').boundingBox())!.width).toBe(width);
    expect(await pageMetrics()).toEqual(metrics);
  });

  ruleOutline(`After leaving an image, Ctrl-wheel '-100'px over <target> stays native for <title>
    Examples:
    | title | target |
    | tree.json | JSON preview |
    | long-log.txt | Text preview |
    | report.pdf | header |
    | broken.mmd | Mermaid source |
    | invalid-image.png | Image viewport |
    | large-sequence.mmd | Mermaid source |
    | large-image.svg | header |
  `, async (ctx) => {
    await openWheelAttachment('large-image.svg');
    if (ctx.example.title !== 'large-image.svg') {
      await page().getByRole('button', { name: ctx.example.title as string, exact: true }).click();
    }
    if (ctx.example.title === 'large-sequence.mmd') {
      await page().getByRole('button', { name: 'View source', exact: true }).click();
    }
    const target = ctx.example.target === 'header'
      ? page().getByRole('dialog').locator('header')
      : page().getByLabel(ctx.example.target as string, { exact: true });
    await target.waitFor({ state: 'visible' });
    await settlePreview();
    expect((await actualWheel(target, ctx.rule.values[0] as number)).prevented).toBe(false);
  });

  rule("Changing 'large-image.svg' to 'second-image.svg' and reopening starts fitted; one Ctrl-wheel '-100'px then zooms '100'% to '150'%", async (ctx) => {
    const [first, second, delta, start, end] = ctx.rule.values as [string, string, number, number, number];
    await openWheelAttachment(first);
    await page().getByRole('button', { name: second, exact: true }).click();
    const region = page().getByRole('region', { name: 'Image viewport' });
    await region.locator('img').evaluate((image: HTMLImageElement) => image.decode());
    await settlePreview();
    expect(await page().getByRole('button', { name: 'Fit image' }).getAttribute('aria-pressed')).toBe('true');
    await page().getByRole('button', { name: 'Close viewer' }).click();
    await page().getByRole('dialog').waitFor({ state: 'hidden' });
    await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    await page().getByRole('button', { name: 'Actual size' }).click();
    await settlePreview();
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${start}%`);
    expect((await actualWheel(region, delta)).prevented).toBe(true);
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${end}%`);
  });

  rule("A loading '1800' by '1400' image leaves Ctrl-wheel '-100'px native until decoded, then zooms '100'% to '150'%", async (ctx) => {
    const [width, height, delta, start, end] = ctx.rule.values as number[];
    let release!: () => void;
    const loaded = new Promise<void>((resolve) => { release = resolve; });
    await page().route('**/wheel-loading.svg', async (route) => {
      await loaded;
      await route.fulfill({ contentType: 'image/svg+xml', body:
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="blue"/></svg>` });
    });
    try {
      await openWheelAttachment('large-image.svg');
      await page().getByRole('button', { name: 'loading-image.svg', exact: true }).click();
      const region = page().getByRole('region', { name: 'Image viewport' });
      await region.getByRole('img', { name: 'loading-image.svg' }).waitFor({ state: 'attached' });
      await settlePreview();
      expect((await actualWheel(region, delta)).prevented).toBe(false);
      release();
      await region.locator('img').evaluate((image: HTMLImageElement) => image.decode());
      await page().getByRole('button', { name: 'Actual size' }).click();
      await settlePreview();
      expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${start}%`);
      expect((await actualWheel(region, delta)).prevented).toBe(true);
      expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${end}%`);
    } finally {
      release();
      await page().unrouteAll({ behavior: 'wait' });
    }
  });

  rule("'10' continuous Ctrl-wheel '-10'px inputs zoom an image from '100'% to '150'% without changing page scale", async (ctx) => {
    const [count, delta, start, end] = ctx.rule.values as number[];
    const region = await openWheelAttachment('large-image.svg');
    const bounds = (await region.boundingBox())!;
    const metrics = await pageMetrics();
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${start}%`);
    await page().mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page().keyboard.down('Control');
    try {
      for (let i = 0; i < count; i++) await page().mouse.wheel(0, delta);
      await expect.poll(async () => page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent())
        .toBe(`${end}%`);
    } finally {
      await page().keyboard.up('Control');
    }
    expect(await pageMetrics()).toEqual(metrics);
  });

  rule("While 'large-sequence.mmd' is rendering, Ctrl-wheel '-100'px stays native; the decoded preview then zooms '100'% to '150'%", async (ctx) => {
    const [title, delta, start, end] = ctx.rule.values as [string, number, number, number];
    await openWheelAttachment('large-image.svg');
    let release!: () => void;
    const loaded = new Promise<void>((resolve) => { release = resolve; });
    await page().route(/\/mermaid\.js(?:\?|$)/, async (route) => {
      await loaded;
      await route.continue();
    });
    try {
      await page().getByRole('button', { name: title, exact: true }).click();
      const status = page().getByText('Rendering Mermaid diagram…', { exact: true });
      await status.waitFor({ state: 'visible' });
      await settlePreview();
      expect((await actualWheel(status, delta)).prevented).toBe(false);
      release();
      const region = page().getByRole('region', { name: 'Mermaid diagram viewport' });
      await region.locator('img').evaluate((image: HTMLImageElement) => image.decode());
      await page().getByRole('button', { name: 'Actual size' }).click();
      await settlePreview();
      expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${start}%`);
      expect((await actualWheel(region, delta)).prevented).toBe(true);
      expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent()).toBe(`${end}%`);
    } finally {
      release();
      await page().unrouteAll({ behavior: 'wait' });
    }
  });

  ruleOutline(`DOM Ctrl-wheel <delta> in <mode> units renders <percent>% from '100'% with dimension factor <factor> within '0.003', without page zoom
    These supplemental DOM inputs cover wheel units that browser mouse APIs cannot select.
    Examples:
    | mode  | delta | percent | factor |
    | pixel | -10000 | 150 | 1.5 |
    | line  | -6.25 | 150 | 1.5 |
    | page  | -1 | 150 | 1.5 |
    | pixel | 0 | 100 | 1 |
    | pixel | -1 | 100 | 1.004063 |
  `, async (ctx) => {
    const region = await openWheelAttachment('large-image.svg');
    const metrics = await pageMetrics();
    const before = (await region.locator('img').boundingBox())!;
    const prevented = await region.evaluate((element, input) => {
      const bounds = element.getBoundingClientRect();
      const event = new WheelEvent('wheel', {
        bubbles: true, cancelable: true, ctrlKey: true,
        deltaY: input.delta, deltaMode: input.mode === 'line' ? 1 : input.mode === 'page' ? 2 : 0,
        clientX: bounds.x + bounds.width / 2, clientY: bounds.y + bounds.height / 2,
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }, { delta: ctx.example.delta as number, mode: ctx.example.mode as string });
    await settlePreview();
    const after = (await region.locator('img').boundingBox())!;
    expect(prevented).toBe(true);
    expect(await page().getByRole('toolbar', { name: /zoom/ }).getByRole('status').textContent())
      .toBe(`${ctx.example.percent}%`);
    expect(Math.abs(after.width / before.width - (ctx.example.factor as number))).toBeLessThan(ctx.rule.values[1] as number);
    expect(await pageMetrics()).toEqual(metrics);
  });
});

feature('Mermaid Attachment Previews', () => {
  scenarioOutline(`Explicit Mermaid attachments render a UTF-8 diagram
    Examples:
    | title            |
    | mime-diagram     |
    | workflow.mmd     |
    | workflow.MERMAID |
    | legacy-diagram   |
    | alias-diagram    |
    | vendor-diagram   |
    `, () => {
    given('an attachment gallery with <title>', async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when('selecting <title>', async (ctx) => {
      await page().getByRole('button', { name: ctx.example.title as string }).click();
    });

    then("a rendered diagram shows the text 'Café 中文' and 'Ready'", async (ctx) => {
      const title = ctx.example.title as string;
      const image = page().getByRole('img', { name: `Mermaid diagram: ${title}` });
      await image.waitFor({ state: 'visible' });
      const rendered = await image.evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        return { width: element.naturalWidth, svg: await (await fetch(element.src)).text() };
      });
      expect(rendered.width).toBeGreaterThan(0);
      expect(rendered.svg).toContain('<svg');
      expect(rendered.svg).toContain(ctx.step.values[0]);
      expect(rendered.svg).toContain(ctx.step.values[1]);
      expect(await page().getByRole('alert').count()).toBe(0);
    });
  });

  scenario("Ordinary 'markdown.md' with a Mermaid fence remains text", () => {
    given("an attachment gallery with 'markdown.md'", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'markdown.md'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
    });

    then("the source contains '```mermaid' and no rendered diagram", async (ctx) => {
      await page().getByText(ctx.step.values[0] as string, { exact: false }).last().waitFor({ state: 'visible' });
      expect(await page().getByRole('img', { name: /Mermaid diagram:/ }).count()).toBe(0);
    });
  });

  scenario("The 'workflow.mmd' preview retains source and download actions", () => {
    given("an attachment gallery showing 'workflow.mmd'", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByRole('img', { name: `Mermaid diagram: ${ctx.step.values[0]}` }).waitFor({ state: 'visible' });
    });

    when("choosing 'View source' and downloading 'workflow.mmd' with 'Download'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      const downloadPromise = page().waitForEvent('download');
      await page().getByRole('button', { name: ctx.step.values[2] as string }).click();
      expect((await downloadPromise).suggestedFilename()).toBe(ctx.step.values[1]);
    });

    then("the 'Café 中文' source and 'Copy source' action are available", async (ctx) => {
      expect(await page().getByLabel('Mermaid source').textContent()).toContain(ctx.step.values[0]);
      expect(await page().getByRole('button', { name: ctx.step.values[1] as string }).count()).toBe(1);
    });
  });

  scenarioOutline(`Mermaid diagrams remain within the gallery at narrow and wide viewports
    Examples:
    | width |
    | 380   |
    | 960   |
    `, () => {
    given('a <width>px gallery containing a diagram', async (ctx) => {
      await page().setViewportSize({ width: ctx.example.width as number, height: 720 });
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'workflow.mmd'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByRole('img', { name: `Mermaid diagram: ${ctx.step.values[0]}` })
        .evaluate((element: HTMLImageElement) => element.decode());
    });

    then("the rendered 'workflow.mmd' diagram fits the <width>px viewport and source controls remain accessible", async (ctx) => {
      const image = await page().getByRole('img', { name: `Mermaid diagram: ${ctx.step.values[0]}` }).boundingBox();
      expect(image).not.toBeNull();
      expect(image!.width).toBeGreaterThan(0);
      expect(image!.x).toBeGreaterThanOrEqual(0);
      expect(image!.x + image!.width).toBeLessThanOrEqual(ctx.example.width as number);
      if ((ctx.example.width as number) < 640) {
        await page().getByRole('button', { name: 'Attachment actions' }).click();
        expect(await page().getByRole('menuitem', { name: 'View source' }).isVisible()).toBe(true);
        await page().keyboard.press('Escape');
      } else {
        expect(await page().getByRole('button', { name: 'View source' }).isVisible()).toBe(true);
      }
    });
  });

    scenarioOutline(`Large sequence diagrams start fitted and can be read at their actual size
      Examples:
      | width |
      | 390   |
      | 1280  |
      `, () => {
      given('a <width>px gallery showing the large sequence diagram', async (ctx) => {
        await page().setViewportSize({ width: ctx.example.width as number, height: 720 });
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('button', { name: 'large-sequence.mmd' }).click();
        await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' })
          .evaluate((element: HTMLImageElement) => element.decode());
      });

      when("choosing 'Fit diagram' for the full diagram", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      });

      then('the full image and source controls fit the gallery with no page overflow at <width>px', async (ctx) => {
        const region = page().getByRole('region', { name: 'Mermaid diagram viewport' });
        const image = page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' });
        const bounds = await region.boundingBox();
        const displayed = await image.boundingBox();
        expect(bounds).not.toBeNull();
        expect(displayed).not.toBeNull();
        expect(displayed!.width).toBeLessThan(bounds!.width);
        expect(displayed!.height).toBeLessThan(bounds!.height);
        expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ctx.example.width as number);
        const renderedSvg = await image.evaluate(async (element: HTMLImageElement) => (await (await fetch(element.src)).text()));
        expect(renderedSvg).toContain('Document history coordinator');
        expect(await page().getByRole('button', { name: 'Fit diagram' }).getAttribute('aria-pressed')).toBe('true');
        if ((ctx.example.width as number) < 640) {
          const trigger = await page().getByRole('button', { name: 'Attachment actions' }).boundingBox();
          expect(trigger!.x).toBeGreaterThanOrEqual(0);
          expect(trigger!.x + trigger!.width).toBeLessThanOrEqual(ctx.example.width as number);
          await page().getByRole('button', { name: 'Attachment actions' }).click();
          for (const label of ['View source', 'Copy source', 'Download']) {
            expect(await page().getByRole('menuitem', { name: label }).isVisible()).toBe(true);
          }
          await page().keyboard.press('Escape');
        } else {
          for (const label of ['View source', 'Copy source', 'Download']) {
            const button = await page().getByRole('button', { name: label }).boundingBox();
            expect(button).not.toBeNull();
            expect(button!.x).toBeGreaterThanOrEqual(0);
            expect(button!.x + button!.width).toBeLessThanOrEqual(ctx.example.width as number);
          }
        }
      });

      and("selecting 'Actual size' exposes both horizontal and vertical scrolling at readable resolution", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        const region = page().getByRole('region', { name: 'Mermaid diagram viewport' });
        const image = page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' });
        const measured = await image.evaluate((element: HTMLImageElement) => {
          const box = element.getBoundingClientRect();
          const viewport = element.closest('[aria-label="Mermaid diagram viewport"]')!;
          return {
            width: box.width, height: box.height,
            clientWidth: viewport.clientWidth, clientHeight: viewport.clientHeight,
            scrollWidth: viewport.scrollWidth, scrollHeight: viewport.scrollHeight,
          };
        });
        expect(measured.width).toBeGreaterThan(measured.clientWidth);
        expect(measured.height).toBeGreaterThan(measured.clientHeight);
        expect(measured.scrollWidth).toBeGreaterThan(measured.clientWidth);
        expect(measured.scrollHeight).toBeGreaterThan(measured.clientHeight);
        expect(await page().getByRole('toolbar', { name: 'Diagram zoom' }).getByRole('status').textContent()).toBe('100%');
        await region.evaluate((element) => {
          element.scrollLeft = element.scrollWidth / 2;
          element.scrollTop = element.scrollHeight / 2;
        });
        const scroll = await region.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
        expect(scroll.left).toBeGreaterThan(0);
        expect(scroll.top).toBeGreaterThan(0);
        expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(ctx.example.width as number);
      });
      and("the focused viewport responds to 'ArrowRight' by scrolling instead of changing attachments", async (ctx) => {
        const region = page().getByRole('region', { name: 'Mermaid diagram viewport' });
        await region.focus();
        await region.evaluate((element) => { element.scrollLeft = 0; });
        await region.press(ctx.step.values[0] as string);
        await page().waitForFunction(() =>
          document.querySelector('[aria-label="Mermaid diagram viewport"]')!.scrollLeft > 0);
        expect(await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' }).count()).toBe(1);
      });
    });

    scenario("Zooming a large sequence diagram changes its displayed size and can return to fit", () => {
      given("the 'large-sequence.mmd' diagram is fitted", async (ctx) => {
        await page().setViewportSize({ width: 1280, height: 720 });
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        await page().getByRole('img', { name: `Mermaid diagram: ${ctx.step.values[0]}` })
          .evaluate((element: HTMLImageElement) => element.decode());
        await page().getByRole('button', { name: 'Fit diagram' }).click();
      });

      when("the reader chooses 'Zoom in'", async (ctx) => {
        const image = page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' });
        const initial = await image.boundingBox();
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        await page().waitForFunction((width) =>
          document.querySelector('img[alt="Mermaid diagram: large-sequence.mmd"]')!.getBoundingClientRect().width > width,
        initial!.width);
      });

      then("choosing 'Fit diagram' restores the full diagram within its viewport", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        const image = await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' }).boundingBox();
        const viewport = await page().getByRole('region', { name: 'Mermaid diagram viewport' }).boundingBox();
        expect(image!.width).toBeLessThan(viewport!.width);
        expect(image!.height).toBeLessThan(viewport!.height);
      });
    });

  scenarioOutline(`Maximizing the gallery enlarges the diagram viewport without browser fullscreen
      Examples:
      | width |
      | 390   |
      | 1280  |
      `, () => {
      let initialImageWidth: number;
      given('a <width>px gallery showing a fitted large diagram', async (ctx) => {
        await page().setViewportSize({ width: ctx.example.width as number, height: 720 });
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('button', { name: 'large-sequence.mmd' }).click();
        await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' })
          .evaluate((element: HTMLImageElement) => element.decode());
      });

      when("choosing 'Maximize viewer'", async (ctx) => {
        const region = page().getByRole('region', { name: 'Mermaid diagram viewport' });
        const before = await region.boundingBox();
        initialImageWidth = (await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' }).boundingBox())!.width;
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        await page().waitForFunction((previous) =>
          document.querySelector('[aria-label="Mermaid diagram viewport"]')!.getBoundingClientRect().width > previous,
        before!.width);
      });

      then('the dialog fills the <width>px viewport and the fitted diagram grows', async (ctx) => {
        const dialog = await page().getByRole('dialog').boundingBox();
        const viewport = await page().getByRole('region', { name: 'Mermaid diagram viewport' }).boundingBox();
        const image = await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' }).boundingBox();
        expect(dialog!.x).toBe(0);
        expect(dialog!.y).toBe(0);
        expect(dialog!.width).toBe(ctx.example.width);
        expect(dialog!.height).toBe(720);
        expect(viewport!.x).toBeGreaterThanOrEqual(0);
        expect(viewport!.x + viewport!.width).toBeLessThanOrEqual(ctx.example.width as number);
        expect(image!.width).toBeGreaterThan(initialImageWidth);
        expect(image!.width).toBeLessThan(viewport!.width);
        expect(await page().evaluate(() => document.fullscreenElement)).toBeNull();
        expect(await page().getByRole('button', { name: 'Restore viewer' }).isVisible()).toBe(true);
      });
  });

  scenarioOutline(`The zoom toolbar stays in the header at narrow and wide viewport sizes
    Examples:
    | width | height |
    | 320   | 720    |
    | 380   | 720    |
    | 1280  | 720    |
    `, () => {
    given('a <width>px by <height>px gallery showing a Mermaid diagram', async (ctx) => {
      await page().setViewportSize({ width: ctx.example.width as number, height: ctx.example.height as number });
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: 'large-sequence.mmd' }).click();
      await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' })
        .evaluate((element: HTMLImageElement) => element.decode());
    });

    when("viewing 'Fit diagram', 'Zoom out', 'Zoom in', 'Actual size' and 'Maximize viewer' in the header", async (ctx) => {
      for (const name of ctx.step.values as string[]) {
        await page().getByRole('dialog').locator('header').getByRole('button', { name }).waitFor();
      }
      await page().getByRole('dialog').locator('header').getByRole('toolbar', { name: 'Diagram zoom' }).waitFor();
    });

    then('controls, filename, and preview remain visible within the <width>px viewport', async (ctx) => {
      const width = ctx.example.width as number;
      const header = page().getByRole('dialog').locator('header');
      const headerBox = (await header.boundingBox())!;
      const toolbar = (await header.getByRole('toolbar', { name: 'Diagram zoom' }).boundingBox())!;
      const name = (await header.locator('[title="large-sequence.mmd"]').boundingBox())!;
      const region = (await page().getByRole('region', { name: 'Mermaid diagram viewport' }).boundingBox())!;
      expect(name.width).toBeGreaterThan(40);
      expect(toolbar.y).toBeGreaterThanOrEqual(headerBox.y);
      expect(toolbar.y + toolbar.height).toBeLessThanOrEqual(headerBox.y + headerBox.height + 1);
      expect(region.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
      for (const button of await header.getByRole('button').all()) {
        const box = (await button.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        if (['Fit diagram', 'Zoom in', 'Zoom out', 'Actual size', 'Maximize viewer', 'Close viewer']
          .includes(await button.getAttribute('aria-label') ?? '')) {
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
      expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });

    and("maximizing with 'Maximize viewer' retains the header toolbar without page overflow", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      const width = ctx.example.width as number;
      const dialog = (await page().getByRole('dialog').boundingBox())!;
      const toolbar = (await page().getByRole('dialog').locator('header')
        .getByRole('toolbar', { name: 'Diagram zoom' }).boundingBox())!;
      expect(dialog.x).toBe(0);
      expect(dialog.width).toBe(width);
      expect(toolbar.x).toBeGreaterThanOrEqual(0);
      expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(width);
      expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  });

    scenarioOutline(`One gallery header shows the true scenario step and keeps the preview unobstructed
      Examples:
      | width |
      | 320   |
      | 380   |
      | 1280  |
      `, () => {
      given("a <width>px gallery with a Mermaid attachment on step '2' of '3'", async (ctx) => {
        await page().setViewportSize({ width: ctx.example.width as number, height: 720 });
        await page().goto(`${baseUrl}?step-context`);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('img', { name: 'Mermaid diagram: large-sequence.mmd' })
          .evaluate((element: HTMLImageElement) => element.decode());
      });

      when("reading 'Step 2 of 3' beside the gallery controls", async (ctx) => {
        await page().getByRole('dialog').locator('header').getByText(
          ctx.step.values[0] as string).waitFor();
      });

      then("exactly '1' header shows 'large-sequence.mmd', 'text/vnd.mermaid', '1 / 2', and 'the document is synchronized' above the preview", async (ctx) => {
        const dialog = page().getByRole('dialog');
        const header = dialog.locator('header');
        expect(await header.count()).toBe(ctx.step.values[0]);
        expect(await header.getByLabel('Passed').isVisible()).toBe(true);
        for (const detail of ctx.step.values.slice(1) as string[]) {
          expect(await header.getByText(detail, { exact: true }).isVisible()).toBe(true);
        }
        expect(await header.getByText(/^\d+(?:\.\d+)? (?:B|KB|MB)$/).isVisible()).toBe(true);
        expect(await dialog.getByRole('heading', { name: 'large-sequence.mmd' }).count()).toBe(1);
        const descriptionId = await dialog.getAttribute('aria-describedby');
        expect(descriptionId).toBeTruthy();
        const description = await page().evaluate((id) => document.getElementById(id!)?.textContent, descriptionId);
        expect(description).toContain(ctx.step.values[4]);
        expect(description).toContain(ctx.step.values[2]);
        const headerBox = (await header.boundingBox())!;
        const previewBox = (await page().getByRole('region', { name: 'Mermaid diagram viewport' }).boundingBox())!;
        expect(previewBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
        expect(previewBox.y - headerBox.y - headerBox.height).toBeLessThan(8);
        const width = ctx.example.width as number;
        if (width < 640) {
          await header.getByRole('button', { name: 'Attachment actions' }).click();
          for (const label of ['View source', 'Copy source', 'Download', 'Play slideshow']) {
            expect(await page().getByRole('menuitem', { name: label }).isVisible()).toBe(true);
          }
          await page().keyboard.press('Escape');
        } else {
          for (const label of ['View source', 'Copy source', 'Download', 'Play slideshow']) {
            expect(await header.getByRole('button', { name: label }).isVisible()).toBe(true);
          }
        }
        expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      });

      and("maximizing fills the <width>px viewport without creating another header", async (ctx) => {
        await page().getByRole('button', { name: 'Maximize viewer' }).click();
        const dialogBox = (await page().getByRole('dialog').boundingBox())!;
        expect(dialogBox.x).toBe(0);
        expect(dialogBox.width).toBe(ctx.example.width);
        expect(dialogBox.height).toBe(720);
        expect(await page().getByRole('dialog').locator('header').count()).toBe(1);
        expect(await page().getByRole('button', { name: 'Restore viewer' }).isVisible()).toBe(true);
      });
    });

    scenario("Switching to 'tree.json' updates the shared header to 'application/json', '2 / 2', and 'the result is inspected'", () => {
      given("a gallery with 'large-sequence.mmd' and 'tree.json' on separate steps", async () => {
        await page().goto(`${baseUrl}?step-context`);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      });

      when("advancing from 'large-sequence.mmd' to 'tree.json'", async (ctx) => {
        await page().getByRole('button', { name: 'Next attachment' }).click();
        await page().getByRole('dialog').locator('header').getByText(ctx.step.values[1] as string, { exact: true }).waitFor();
      });

      then("the header shows 'tree.json', 'application/json', '2 / 2', 'the result is inspected', and its size but not 'large-sequence.mmd'", async (ctx) => {
        const header = page().getByRole('dialog').locator('header');
        for (const detail of ctx.step.values.slice(0, 4) as string[]) {
          expect(await header.getByText(detail, { exact: true }).isVisible()).toBe(true);
        }
        expect(await header.getByText(/^\d+(?:\.\d+)? (?:B|KB|MB)$/).isVisible()).toBe(true);
        expect(await header.getByLabel('Failed').isVisible()).toBe(true);
        expect(await header.getByText(ctx.step.values[4] as string, { exact: true }).count()).toBe(0);
      });
    });

    scenarioOutline(`Shared headers retain file type, size, and gallery position for direct attachments
      Examples:
      | width | title              | mimeType           | position |
      | 320   | tree.json          | application/json   | 11 / 18  |
      | 320   | markdown.md        | text/markdown      | 8 / 18   |
      | 320   | report.pdf         | application/pdf    | 16 / 18  |
      | 320   | preview.png        | image/png          | 15 / 18  |
      | 1280  | large-sequence.mmd | text/vnd.mermaid   | 7 / 18   |
      `, () => {
      given('a <width>px gallery with <title>', async (ctx) => {
        await page().setViewportSize({ width: ctx.example.width as number, height: 720 });
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      });

      when('selecting <title>', async (ctx) => {
        await page().getByRole('button', { name: ctx.example.title as string }).click();
      });

      then('its header shows <title>, <mimeType>, readable size, and <position> without horizontal overflow', async (ctx) => {
        const header = page().getByRole('dialog').locator('header');
        expect(await header.count()).toBe(1);
        for (const detail of [ctx.example.title, ctx.example.mimeType, ctx.example.position] as string[]) {
          expect(await header.getByText(detail, { exact: true }).isVisible()).toBe(true);
        }
        expect(await header.getByText(/^\d+(?:\.\d+)? (?:B|KB|MB)$/).isVisible()).toBe(true);
        expect(await page().evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(ctx.example.width as number);
      });
    });

    scenario("When total steps are unknown, step '2' is not mislabelled 'Step 2 of 1'", () => {
      given("a gallery with only one attachment on step '2' and no scenario total", async (ctx) => {
        await page().goto(`${baseUrl}?step-sparse`);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('dialog').locator('header').getByText(`Step ${ctx.step.values[0]}`).waitFor();
      });

      when("inspecting its single shared header", async () => {
        await page().getByRole('dialog').locator('header').waitFor();
      });

      then("it shows 'Step 2', not a fabricated 'of 1' denominator", async (ctx) => {
        const header = page().getByRole('dialog').locator('header');
        expect(await header.count()).toBe(1);
        expect(await header.textContent()).toContain(ctx.step.values[0]);
        expect(await header.textContent()).not.toContain(ctx.step.values[1]);
      });
    });

      scenario("At '320'px, source, copy, and download work from the single gallery header", () => {
        given("a '320'px gallery showing the large step diagram", async (ctx) => {
          await page().setViewportSize({ width: ctx.step.values[0] as number, height: 720 });
          await context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
          await page().goto(`${baseUrl}?step-context`);
          await page().getByRole('button', { name: 'Open attachment gallery' }).click();
          await page().getByRole('button', { name: 'Attachment actions' }).waitFor();
        });

        when("using 'Attachment actions' and 'View source' with the keyboard", async (ctx) => {
          await page().getByRole('button', { name: ctx.step.values[0] as string }).focus();
          await page().keyboard.press('Enter');
          await page().getByRole('menuitem', { name: ctx.step.values[1] as string }).press('Enter');
        });

        then("the 'Document history coordinator' source appears beneath the only header", async (ctx) => {
          expect(await page().getByRole('dialog').locator('header').count()).toBe(1);
          expect(await page().getByLabel('Mermaid source').textContent()).toContain(ctx.step.values[0]);
        });

        and("'Copy source' copies the diagram text to the clipboard", async (ctx) => {
          await page().getByRole('button', { name: 'Attachment actions' }).click();
          await page().getByRole('menuitem', { name: ctx.step.values[0] as string }).click();
          expect(await page().evaluate(() => navigator.clipboard.readText())).toContain('Document history coordinator');
          await page().getByRole('button', { name: 'Attachment actions' }).click();
          expect(await page().getByRole('menuitem', { name: 'Copied' }).isVisible()).toBe(true);
          await page().keyboard.press('Escape');
        });

        and("'Download' saves 'large-sequence.mmd' without another metadata bar", async (ctx) => {
          await page().getByRole('button', { name: 'Attachment actions' }).click();
          const downloadPromise = page().waitForEvent('download');
          await page().getByRole('menuitem', { name: ctx.step.values[0] as string }).click();
          expect((await downloadPromise).suggestedFilename()).toBe(ctx.step.values[1]);
          expect(await page().getByRole('dialog').locator('header').count()).toBe(1);
        });
      });

    scenario("Navigating from step '2' to step '3' updates the single header and JSON actions", () => {
      given("a gallery with diagram and JSON previews across '3' scenario steps", async (ctx) => {
        await page().setViewportSize({ width: 1280, height: 720 });
        await page().goto(`${baseUrl}?step-context`);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('dialog').locator('header').getByText(`Step 2 of ${ctx.step.values[0]}`).waitFor();
      });

      when("jumping to step '3' with ']'", async (ctx) => {
        await page().keyboard.press(ctx.step.values[1] as string);
        await page().getByRole('dialog').locator('header').getByText(`Step ${ctx.step.values[0]} of 3`).waitFor();
      });

      then("the header exposes 'Copy' and 'Download' for the JSON preview with no inner toolbar", async (ctx) => {
        const dialog = page().getByRole('dialog');
        expect(await dialog.locator('header').count()).toBe(1);
        await dialog.getByRole('region', { name: 'JSON preview' }).waitFor({ state: 'visible' });
        for (const name of ctx.step.values as string[]) {
          expect(await dialog.locator('header').getByRole('button', { name }).isVisible()).toBe(true);
        }
        expect(await dialog.locator('header').getByRole('button', { name: 'Zoom in' }).count()).toBe(0);
      });
    });

    scenarioOutline(`Image, JSON, text and PDF galleries use the same compact header at mobile widths
      Examples:
      | title       | action      | preview      | zoom |
      | preview.png | Download    | Image viewport | yes |
      | tree.json   | Copy        | JSON preview | no   |
      | markdown.md | Copy text   | Text preview | no   |
      | report.pdf  | Copy Base64 |              | no   |
      `, () => {
      given("a '320'px gallery showing <title>", async (ctx) => {
        await page().setViewportSize({ width: ctx.step.values[0] as number, height: 720 });
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('button', { name: ctx.example.title as string }).click();
        if (ctx.example.zoom === 'yes') {
          await page().getByRole('button', { name: 'Fit image' }).waitFor();
        }
      });

      when("opening 'Attachment actions' from the gallery header", async (ctx) => {
        await page().getByRole('dialog').locator('header')
          .getByRole('button', { name: ctx.step.values[0] as string }).click();
      });

      then("the <action> action and <preview> remain usable without a nested metadata bar", async (ctx) => {
        expect(await page().getByRole('menuitem', { name: ctx.example.action as string }).isVisible()).toBe(true);
        await page().keyboard.press('Escape');
        const dialog = page().getByRole('dialog');
        expect(await dialog.locator('header').count()).toBe(1);
        if (ctx.example.preview) {
          await dialog.getByRole('region', { name: ctx.example.preview as string }).waitFor({ state: 'visible' });
        }
        if (ctx.example.zoom === 'no') {
          expect(await dialog.getByRole('button', { name: 'Zoom in' }).count()).toBe(0);
        }
        expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      });
    });

      scenarioOutline(`Long JSON and text previews remain scrollable beneath the shared header
        Examples:
        | title          | region       |
        | long-data.json | JSON preview |
        | long-log.txt   | Text preview |
        `, () => {
        given("a '320'px gallery showing <title>", async (ctx) => {
          await page().setViewportSize({ width: ctx.step.values[0] as number, height: 720 });
          await page().goto(baseUrl);
          await page().getByRole('button', { name: 'Open attachment gallery' }).click();
          await page().getByRole('button', { name: ctx.example.title as string }).click();
          await page().getByRole('region', { name: ctx.example.region as string }).waitFor({ state: 'visible' });
        });

        when("maximizing with 'Maximize viewer'", async (ctx) => {
          await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        });

        then("the <region> scrolls inside the viewport beneath exactly '1' header", async (ctx) => {
          const region = page().getByRole('region', { name: ctx.example.region as string });
          expect(await page().getByRole('dialog').locator('header').count()).toBe(ctx.step.values[0]);
          const geometry = await region.evaluate((node) => ({
            scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
            scrolled: (node.scrollTop = node.scrollHeight),
          }));
          expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
          expect(geometry.scrolled).toBeGreaterThan(0);
          expect(await page().evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
        });
      });

  scenarioOutline(`Zoomed Mermaid and image previews pan by dragging without changing the attachment
    Examples:
    | title              | viewport                 | zoomClicks |
    | large-sequence.mmd | Mermaid diagram viewport | 0          |
    | preview.png        | Image viewport           | 3          |
    `, () => {
    let initialScroll: { left: number; top: number };
    let initialSource: string;
    given("a '380'px gallery showing <title>", async (ctx) => {
      await page().setViewportSize({ width: ctx.step.values[0] as number, height: 720 });
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('button', { name: ctx.example.title as string }).click();
      await page().getByRole('img', { name: ctx.example.title === 'preview.png'
        ? 'preview.png' : 'Mermaid diagram: large-sequence.mmd' })
        .evaluate((element: HTMLImageElement) => element.decode());
    });

    when("choosing 'Actual size' then 'Zoom in' <zoomClicks> times", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      for (let index = 0; index < (ctx.example.zoomClicks as number); index++) {
        await page().getByRole('button', { name: ctx.step.values[1] as string }).click();
      }
      const region = page().getByRole('region', { name: ctx.example.viewport as string });
      await page().waitForFunction((label) => {
        const viewport = document.querySelector(`[aria-label="${label}"]`)!;
        return viewport.scrollWidth > viewport.clientWidth && viewport.scrollHeight > viewport.clientHeight;
      }, ctx.example.viewport);
      initialSource = await region.locator('img').getAttribute('src') ?? '';
      initialScroll = await region.evaluate((viewport) => {
        viewport.scrollLeft = viewport.scrollWidth / 3;
        viewport.scrollTop = viewport.scrollHeight / 3;
        return { left: viewport.scrollLeft, top: viewport.scrollTop };
      });
    });

    then("dragging '70'px left and '65'px up moves the preview at least '50'px right and '45'px down", async (ctx) => {
      const region = page().getByRole('region', { name: ctx.example.viewport as string });
      const box = (await region.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const pageScroll = await page().evaluate(() => document.documentElement.scrollTop);
      await page().mouse.move(x, y);
      await page().mouse.down();
      await page().mouse.move(x - (ctx.step.values[0] as number), y - (ctx.step.values[1] as number), { steps: 5 });
      await page().mouse.up();
      const scroll = await region.evaluate((viewport) => ({ left: viewport.scrollLeft, top: viewport.scrollTop }));
      expect(scroll.left - initialScroll.left).toBeGreaterThan(ctx.step.values[2] as number);
      expect(scroll.top - initialScroll.top).toBeGreaterThan(ctx.step.values[3] as number);
      expect(await region.locator('img').getAttribute('src')).toBe(initialSource);
      expect(await page().evaluate(() => document.documentElement.scrollTop)).toBe(pageScroll);
      await page().mouse.move(x, y);
      expect(await region.evaluate((viewport) => ({ left: viewport.scrollLeft, top: viewport.scrollTop }))).toEqual(scroll);
    });

    and("cancelling a pointer drag stops panning, while 'Fit diagram' or 'Fit image' remains available", async (ctx) => {
      const region = page().getByRole('region', { name: ctx.example.viewport as string });
      await region.evaluate((viewport) => {
        viewport.addEventListener('pointerdown', (event) => {
          viewport.dataset.pointerId = String(event.pointerId);
        }, { once: true });
      });
      const box = (await region.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page().mouse.move(x, y);
      await page().mouse.down();
      await region.evaluate((viewport) => {
        viewport.dispatchEvent(new PointerEvent('pointercancel', {
          bubbles: true, pointerId: Number(viewport.dataset.pointerId), pointerType: 'mouse',
        }));
      });
      const before = await region.evaluate((viewport) => ({ left: viewport.scrollLeft, top: viewport.scrollTop }));
      await page().mouse.move(x - 50, y - 45, { steps: 4 });
      await page().mouse.up();
      expect(await region.evaluate((viewport) => ({ left: viewport.scrollLeft, top: viewport.scrollTop }))).toEqual(before);
      await page().getByRole('button', { name: ctx.example.title === 'preview.png'
        ? ctx.step.values[1] as string : ctx.step.values[0] as string }).click();
      expect(await page().getByRole('region', { name: ctx.example.viewport as string }).isVisible()).toBe(true);
    });
  });

  scenario("Touch users can pan an enlarged Mermaid diagram without scrolling the page", () => {
    let moved: { left: number; top: number };
    given("the attachment gallery is available to a touch browser", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).waitFor();
    });

    when("swiping '100'px left and '100'px up in a '380'px viewer at 'Actual size'", async (ctx) => {
      const [horizontal, vertical, width, actualSize] = ctx.step.values as [number, number, number, string];
      const context = await browser().newContext({ hasTouch: true, isMobile: true, viewport: { width, height: 720 } });
      try {
        const touchPage = await context.newPage();
        await touchPage.goto(baseUrl);
        await touchPage.getByRole('button', { name: 'Open attachment gallery' }).click();
        await touchPage.getByRole('button', { name: 'large-sequence.mmd' }).click();
        await touchPage.getByRole('button', { name: actualSize }).click();
        const region = touchPage.getByRole('region', { name: 'Mermaid diagram viewport' });
        const initial = await region.evaluate((viewport) => {
          viewport.scrollLeft = viewport.scrollWidth / 3;
          viewport.scrollTop = viewport.scrollHeight / 3;
          return { left: viewport.scrollLeft, top: viewport.scrollTop };
        });
        const rect = (await region.boundingBox())!;
        const x = Math.floor(rect.x + rect.width / 2);
        const y = Math.floor(rect.y + rect.height / 2);
        const session = await context.newCDPSession(touchPage);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 5; step++) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: x - (horizontal * step / 5), y: y - (vertical * step / 5) }],
          });
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await touchPage.waitForFunction(([left, top]) => {
          const viewport = document.querySelector('[aria-label="Mermaid diagram viewport"]')!;
          return viewport.scrollLeft > left && viewport.scrollTop > top;
        }, [initial.left, initial.top]);
        const after = await region.evaluate((viewport) => ({
          left: viewport.scrollLeft, top: viewport.scrollTop,
          pageTop: document.documentElement.scrollTop,
        }));
        moved = { left: after.left - initial.left, top: after.top - initial.top };
        expect(after.pageTop).toBe(0);
      } finally {
        await context.close();
      }
    });

    then("the diagram moves at least '40'px horizontally and '40'px vertically", (ctx) => {
      expect(moved.left).toBeGreaterThan(ctx.step.values[0] as number);
      expect(moved.top).toBeGreaterThan(ctx.step.values[1] as number);
    });
  });

  scenario("Shared zoom controls change the displayed size of a raster image", () => {
      given("an attachment gallery showing 'preview.png'", async (ctx) => {
        await page().setViewportSize({ width: 1280, height: 720 });
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        await page().getByRole('img', { name: ctx.step.values[0] as string })
          .evaluate((element: HTMLImageElement) => element.decode());
      });

      when("choosing 'Actual size' displays the '320'px image before 'Zoom in'", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        await page().waitForFunction((width) =>
          Math.abs(document.querySelector('img[alt="preview.png"]')!.getBoundingClientRect().width - width) < 0.25,
        ctx.step.values[1] as number);
        await page().getByRole('button', { name: ctx.step.values[2] as string }).click();
      });

      then("the image grows to '480'px and 'Fit image' restores it to '320'px", async (ctx) => {
        const image = page().getByRole('img', { name: 'preview.png' });
        await page().waitForFunction((width) =>
          Math.abs(document.querySelector('img[alt="preview.png"]')!.getBoundingClientRect().width - width) < 0.25,
        ctx.step.values[0] as number);
        await page().getByRole('button', { name: ctx.step.values[1] as string }).click();
        expect(await page().getByRole('button', { name: ctx.step.values[1] as string }).getAttribute('aria-pressed')).toBe('true');
        await page().waitForFunction((width) =>
          Math.abs(document.querySelector('img[alt="preview.png"]')!.getBoundingClientRect().width - width) < 0.25,
        ctx.step.values[2] as number);
        expect((await image.boundingBox())!.width).toBeCloseTo(ctx.step.values[2] as number, 0);
      });
  });

  scenarioOutline(`Non-scalable previews can maximize without showing zoom controls
      Examples:
      | title       | preview      |
      | tree.json   | JSON preview |
      | markdown.md |             |
      | report.pdf  |             |
      `, () => {
      given("an attachment gallery showing <title>", async (ctx) => {
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        await page().getByRole('button', { name: ctx.example.title as string }).click();
      });

      when("choosing 'Maximize viewer'", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      });

      then('the <title> preview remains available without meaningless zoom actions', async (ctx) => {
        expect(await page().getByRole('dialog').isVisible()).toBe(true);
        await page().getByRole('button', { name: 'Zoom in' }).waitFor({ state: 'hidden' });
        expect(await page().getByRole('button', { name: 'Zoom in' }).count()).toBe(0);
        expect(await page().getByRole('button', { name: 'Restore viewer' }).isVisible()).toBe(true);
        if (ctx.example.preview) {
          const preview = page().getByRole('region', { name: ctx.example.preview as string });
          await preview.waitFor({ state: 'visible' });
          expect(await preview.isVisible()).toBe(true);
          expect(await preview.evaluate((node) => getComputedStyle(node).overflow)).toBe('auto');
        }
      });
  });

  scenario("Escape restores the maximized viewer before closing it and returns focus to the opener", () => {
      given('an open attachment gallery with keyboard focus inside the dialog', async () => {
        await page().goto(baseUrl);
        await page().getByRole('button', { name: 'Open attachment gallery' }).click();
        expect(await page().evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);
      });

      when("choosing 'Maximize viewer' and pressing 'Escape'", async (ctx) => {
        await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
        await page().keyboard.press(ctx.step.values[1] as string);
      });

      then("the dialog can be closed with 'Escape' and focus returns to 'Open attachment gallery'", async (ctx) => {
        await page().getByRole('button', { name: 'Maximize viewer' }).waitFor({ state: 'visible' });
        expect(await page().getByRole('button', { name: 'Maximize viewer' }).isVisible()).toBe(true);
        await page().keyboard.press(ctx.step.values[0] as string);
        await page().getByRole('dialog').waitFor({ state: 'detached' });
        expect(await page().getByRole('dialog').count()).toBe(0);
        await expect.poll(() => page().getByRole('button', { name: ctx.step.values[1] as string }).evaluate(
          (button) => document.activeElement === button)).toBe(true);
      });
  });

  scenario("An invalid 'broken.mmd' shows its source and an error, then 'workflow.mmd' renders cleanly", () => {
    given("an attachment gallery with 'broken.mmd' and 'workflow.mmd'", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'broken.mmd'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
    });

    then("a rendering error appears beside 'graph LR' source", async (ctx) => {
      await page().getByRole('alert').getByText(/Could not render this Mermaid diagram/).waitFor({ state: 'visible' });
      expect(await page().getByRole('dialog').getByLabel('Mermaid source').textContent()).toContain(ctx.step.values[0]);
    });

    and("switching to 'workflow.mmd' shows a diagram and no old error", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
      await page().getByRole('img', { name: `Mermaid diagram: ${ctx.step.values[0]}` }).waitFor({ state: 'visible' });
      expect(await page().getByRole('alert').count()).toBe(0);
    });
  });

  scenario("A diagram switched to 'markdown.md' leaves no old image or error", () => {
    given("a gallery showing 'mime-diagram'", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
      await page().getByRole('img', { name: `Mermaid diagram: ${ctx.step.values[0]}` }).waitFor({ state: 'visible' });
    });

    when("navigating to 'markdown.md'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
    });

    then("the Markdown source is visible without an image or rendering error", async () => {
      await page().getByText('```mermaid', { exact: false }).last().waitFor({ state: 'visible' });
      expect(await page().getByRole('img', { name: /Mermaid diagram:/ }).count()).toBe(0);
      expect(await page().getByRole('alert').count()).toBe(0);
    });
  });

  scenario("A hostile 'hostile.mmd' cannot execute script in the gallery", () => {
    given("an attachment gallery containing 'hostile.mmd'", async () => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: 'Open attachment gallery' }).click();
    });

    when("selecting 'hostile.mmd'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] as string }).click();
    });

    then("the 'hostile.mmd' preview displays a safe image or source error without executing script", async (ctx) => {
      const image = page().getByRole('img', { name: `Mermaid diagram: ${ctx.step.values[0]}` });
      await page().waitForFunction(() => Boolean(
        document.querySelector('img[alt="Mermaid diagram: hostile.mmd"], [role="alert"]')
      ), undefined, { timeout: 10_000 });
      if (await image.count()) {
        await image.evaluate((element: HTMLImageElement) => element.decode());
      } else {
        await page().getByRole('alert').waitFor({ state: 'visible' });
        expect(await page().getByLabel('Mermaid source').textContent()).toContain('onerror');
      }
      expect(await page().evaluate(() => window.__mermaidExecuted === true)).toBe(false);
      expect(await page().getByRole('dialog').locator('script, iframe, img[onerror], a[href^="javascript:"]').count()).toBe(0);
    });
  });
});
