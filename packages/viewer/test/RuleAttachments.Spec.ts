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
  const viewerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../src/client');
  server = await createServer({
    configFile: false,
    root: viewerRoot,
    plugins: [react(), tailwindcss()],
    define: { __LIVEDOC_VIEWER_VERSION__: JSON.stringify('test') },
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Attachment fixture server has no port');
  baseUrl = `http://127.0.0.1:${address.port}/attachment-fixture.html`;
});

afterAll(async () => {
  await server?.close();
});

feature('Outline and Rule Evidence in the Viewer', () => {
  scenario("An unselected scenario outline has '0' attachment buttons", () => {
    given("an outline with '3' examples and no selection", async (ctx) => {
      await page().goto(`${baseUrl}?kind=scenario-outline`);
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).waitFor({ state: 'visible' });
    });

    when("checking the template step's evidence controls", async () => {
      await page().getByText('the example is loaded').waitFor({ state: 'visible' });
    });

    then("there are '0' step or example attachment buttons", async (ctx) => {
      expect(await page().getByRole('button', { name: '1 attachment', exact: true }).count()).toBe(ctx.step.values[0]);
      expect(await page().getByRole('button', { name: /attachments? for this example/ }).count()).toBe(ctx.step.values[0]);
    });
  });

  scenarioOutline(`Scenario outlines show a passive count of examples with evidence
    Examples:
    | surface          | count |
    | feature-list     | 2     |
    | feature-children | 2     |
    `, () => {
    given('a <surface> with scenario outline step and row evidence', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when('viewing the scenario outline indicator', async () => {
      await page().getByText('Each scenario example owns its step evidence').waitFor({ state: 'visible' });
    });

    then('the indicator reports <count> attached examples and is not a gallery button', async (ctx) => {
      const label = `${ctx.example.count} examples with attachments in scenario outline Each scenario example owns its step evidence`;
      expect(await page().getByRole('note', { name: label }).textContent()).toContain(String(ctx.example.count));
      expect(await page().getByRole('button', { name: label }).count()).toBe(0);
    });
  });

  scenario("Navigating from the outline list opens 'first.json' on selected row '1'", () => {
    given("the scenario outline list reports '2' attached examples", async (ctx) => {
      await page().goto(`${baseUrl}?kind=feature-list`);
      await page().getByRole('note', {
        name: `${ctx.step.values[0]} examples with attachments in scenario outline Each scenario example owns its step evidence`,
      }).waitFor({ state: 'visible' });
    });

    when("navigating via the evidence indicator, selecting row '1', and opening its '1' attachment", async (ctx) => {
      const note = await page().getByRole('note', { name: /attachments in scenario outline/ }).boundingBox();
      expect(note).not.toBeNull();
      await page().mouse.click(note!.x + note!.width / 2, note!.y + note!.height / 2);
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: `View all ${ctx.step.values[1]} attachment for this example` }).click();
    });

    then("the selected example gallery contains 'first.json' but not 'second.json', 'row.json', or 'unknown-row.json'", async (ctx) => {
      const [first, second, row, unknownRow] = ctx.step.values as string[];
      const dialog = page().getByRole('dialog');
      await dialog.getByText(first).first().waitFor({ state: 'visible' });
      for (const name of [second, row, unknownRow]) {
        expect(await dialog.getByText(name).count()).toBe(0);
      }
    });
  });

  scenario("Selecting row '2' previews its '2' attachments and row '3' has none", () => {
    given("a scenario outline with '3' examples", async (ctx) => {
      await page().goto(`${baseUrl}?kind=scenario-outline`);
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).waitFor({ state: 'visible' });
    });

    when("selecting row '2' and opening its '2' attachments", async (ctx) => {
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: `View all ${ctx.step.values[1]} attachments for this example` }).click();
    });

    then("the gallery contains 'row.json' and 'second.json' but not 'first.json' or 'unrelated.json'", async (ctx) => {
      const [row, second, first, unrelated] = ctx.step.values as string[];
      const dialog = page().getByRole('dialog');
      await dialog.getByRole('button', { name: row }).click();
      await dialog.getByText(row).first().waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: second }).click();
      await dialog.getByText(second).first().waitFor({ state: 'visible' });
      expect(await dialog.getByText(first).count()).toBe(0);
      expect(await dialog.getByText(unrelated).count()).toBe(0);
    });

    and("after selecting unattached row '3' there are '0' attachment buttons", async (ctx) => {
      await page().keyboard.press('Escape');
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      expect(await page().getByRole('button', { name: /attachments? for this example/ }).count()).toBe(ctx.step.values[1]);
      expect(await page().getByRole('button', { name: '1 attachment', exact: true }).count()).toBe(ctx.step.values[1]);
    });
  });

  scenario("An unrelated outline result offers '0' attachments for example '1'", () => {
    given("a list containing a scenario outline without example evidence", async () => {
      await page().goto(`${baseUrl}?kind=feature-list`);
      await page().getByRole('button', { name: 'A scenario outline without example evidence' }).click();
    });

    when("selecting example '1' despite template and unrelated outline attachments", async (ctx) => {
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
    });

    then("there are '0' example or step attachment controls", async (ctx) => {
      expect(await page().getByRole('button', { name: /attachments? for this example/ }).count()).toBe(ctx.step.values[0]);
      expect(await page().getByRole('button', { name: '1 attachment', exact: true }).count()).toBe(ctx.step.values[0]);
    });
  });

  scenario("Selecting scenario outline row '1' opens only its 'first.json' evidence", () => {
    given("an outline with '3' examples", async (ctx) => {
      await page().goto(`${baseUrl}?kind=scenario-outline`);
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).waitFor({ state: 'visible' });
    });

    when("selecting row '1' and opening its '1' attachment", async (ctx) => {
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: `${ctx.step.values[1]} attachment`, exact: true }).click();
    });

    then("the gallery contains 'first.json' without 'second.json' or 'unrelated.json'", async (ctx) => {
      const [first, second, unrelated] = ctx.step.values as string[];
      const dialog = page().getByRole('dialog');
      await dialog.getByText(first).first().waitFor({ state: 'visible' });
      expect(await dialog.getByText(second).count()).toBe(0);
      expect(await dialog.getByText(unrelated).count()).toBe(0);
    });
  });

  scenario("Switching scenario outline examples isolates evidence and leaves row '3' unattached", () => {
    given("row '1' is selected in an outline with '3' examples", async (ctx) => {
      await page().goto(`${baseUrl}?kind=scenario-outline`);
      await page().getByRole('button', { name: `Select example ${ctx.step.values[1]}` }).waitFor({ state: 'visible' });
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: '1 attachment', exact: true }).waitFor({ state: 'visible' });
    });

    when("switching to row '2' and opening its '1' attachment", async (ctx) => {
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: `${ctx.step.values[1]} attachment`, exact: true }).click();
    });

    then("the gallery contains 'second.json' without 'first.json' or 'unrelated.json'", async (ctx) => {
      const [second, first, unrelated] = ctx.step.values as string[];
      const dialog = page().getByRole('dialog');
      await dialog.getByText(second).first().waitFor({ state: 'visible' });
      expect(await dialog.getByText(first).count()).toBe(0);
      expect(await dialog.getByText(unrelated).count()).toBe(0);
    });

    and("after selecting unattached row '3', there are '0' step attachment buttons", async (ctx) => {
      await page().keyboard.press('Escape');
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      expect(await page().getByRole('button', { name: '1 attachment', exact: true }).count()).toBe(ctx.step.values[1]);
    });
  });

  scenarioOutline(`Paperclips precede aligned durations and statuses in rule lists
    Examples:
    | surface  | width |
    | list     | 960   |
    | children | 960   |
    | list     | 380   |
    | children | 380   |
    `, () => {
    type Bounds = { left: number; right: number };
    type RowBounds = { time: Bounds; status: Bounds; badge?: Bounds; badgeCount: number; right: number };
    const rect = (element: Element): Bounds => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    };
    let attached: RowBounds;
    let outline: RowBounds;
    let plain: RowBounds;

    given('a <width>px-wide <surface> of rules', async (ctx) => {
      await page().setViewportSize({ width: ctx.example.width as number, height: 720 });
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
      await page().getByTestId('navigation-state').waitFor({ state: 'visible' });
    });

    when("measuring 'A rule with evidence' at '3ms', 'A rule with row evidence' at '<1ms', and 'A rule without evidence' at '1ms', all 'passed'", async (ctx) => {
      const [attachedTitle, attachedTime, outlineTitle, outlineTime, plainTitle, plainTime, statusTitle] = ctx.step.valuesRaw;
      const measure = async (title: string, duration: string, badgeRole?: 'button' | 'note'): Promise<RowBounds> => {
        const row = page().getByRole('listitem').filter({ has: page().getByText(title, { exact: true }) });
        await row.waitFor({ state: 'visible' });
        const time = await row.getByText(duration, { exact: true }).evaluate(rect);
        const status = await row.locator(`[title="${statusTitle}"]`).evaluate(rect);
        const badge = badgeRole ? await row.getByRole(badgeRole, { name: /attachments? (for rule|in rule outline)/ }).evaluate(rect) : undefined;
        const badgeCount = await row.getByRole('button', { name: /attachments? for rule/ }).count()
          + await row.getByRole('note', { name: /attachments? in rule outline/ }).count();
        const right = await row.evaluate((element) => element.getBoundingClientRect().right);
        return { time, status, badge, badgeCount, right };
      };
      attached = await measure(attachedTitle, attachedTime, 'button');
      outline = await measure(outlineTitle, outlineTime, 'note');
      plain = await measure(plainTitle, plainTime);
    });

    then("both paperclips sit left of duration, times and ticks align within '1'px, and empty rows reserve space", async (ctx) => {
      const tolerance = ctx.step.values[0] as number;
      expect(attached.badge).toBeDefined();
      expect(outline.badge).toBeDefined();
      expect(attached.badge!.right).toBeLessThan(attached.time.left);
      expect(outline.badge!.right).toBeLessThan(outline.time.left);
      for (const row of [outline, plain]) {
        expect(Math.abs(attached.time.right - row.time.right)).toBeLessThanOrEqual(tolerance);
        expect(Math.abs(attached.status.left - row.status.left)).toBeLessThanOrEqual(tolerance);
        expect(row.status.right).toBeLessThanOrEqual(row.right + tolerance);
      }
      expect(plain.badgeCount).toBe(0);
    });
  });

  scenarioOutline(`Failed rule status remains part of the navigation target
    Examples:
    | surface  |
    | list     |
    | children |
    `, () => {
    given('a <surface> with a failed rule', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when("selecting the status of 'A failed rule with evidence'", async (ctx) => {
      const row = page().getByRole('listitem').filter({
        has: page().getByText(ctx.step.values[0] as string, { exact: true }),
      });
      const status = await row.locator('[title="failed"]').boundingBox();
      expect(status).not.toBeNull();
      await page().mouse.click(status!.x + status!.width / 2, status!.y + status!.height / 2);
    });

    then("the selected detail is 'rule-failed'", async (ctx) => {
      expect(await page().getByTestId('navigation-state').textContent()).toBe(`node:${ctx.step.values[0]}`);
    });
  });

  scenarioOutline(`Selecting passive evidence navigates to its outline or scenario
    Examples:
    | surface          | title                           | selected   |
    | list             | A rule with row evidence        | outline-1  |
    | children         | A rule with row evidence        | outline-1  |
    | feature-list     | A passed scenario with evidence | scenario-1 |
    | feature-children | A passed scenario with evidence | scenario-1 |
    `, () => {
    given('a <surface> with passive evidence for <title>', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when('clicking the evidence note for <title> with the mouse', async (ctx) => {
      const row = page().getByRole('listitem').filter({
        has: page().getByText(ctx.example.title, { exact: true }),
      });
      const note = await row.getByRole('note', { name: /attachments/ }).boundingBox();
      expect(note).not.toBeNull();
      await page().mouse.click(note!.x + note!.width / 2, note!.y + note!.height / 2);
    });

    then('the selected detail is <selected>', async (ctx) => {
      expect(await page().getByTestId('navigation-state').textContent()).toBe(`node:${ctx.example.selected}`);
    });
  });

  scenarioOutline(`Clicking rule evidence opens its gallery without navigating
    Examples:
    | surface  | rule                 | count | file       |
    | list     | A rule with evidence | 4     | order.json |
    | children | A rule with evidence | 4     | order.json |
    `, () => {
    given('the <surface> contains <rule> with <count> attachments', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when('clicking the evidence button for <rule> with the mouse', async (ctx) => {
      await page().getByRole('button', {
        name: `View ${ctx.example.count} attachments for rule ${ctx.example.rule}`,
      }).click();
    });

    then('the gallery contains <file> and the list remains selected', async (ctx) => {
      await page().getByRole('dialog').getByText(ctx.example.file).first().waitFor({ state: 'visible' });
      expect(await page().getByTestId('navigation-state').textContent()).toBe('group:specification-1');
    });
  });

  scenarioOutline(`Rule list evidence opens the owning gallery without navigating
    Examples:
    | surface  | rule                         | count | file         |
    | list     | A rule with evidence         | 4     | order.json   |
    | children | A rule with evidence         | 4     | order.json   |
    | list     | A failed rule with evidence  | 1     | failure.json |
    | children | A failed rule with evidence  | 1     | failure.json |
    `, () => {
    given('the <surface> contains a rule with <count> attachments', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
      await page().getByTestId('navigation-state').waitFor({ state: 'visible' });
    });

    when('opening evidence for <rule> with the keyboard', async (ctx) => {
      const { rule, count } = ctx.example;
      const badge = page().getByRole('button', {
        name: `View ${count} attachment${count === 1 ? '' : 's'} for rule ${rule}`,
      });
      await badge.focus();
      await page().keyboard.press('Enter');
    });

    then('the gallery contains <file> and the list has not navigated', async (ctx) => {
      await page().getByRole('dialog').getByText(ctx.example.file).first().waitFor({ state: 'visible' });
      expect(await page().getByTestId('navigation-state').textContent()).toBe('group:specification-1');
    });
  });

  scenarioOutline(`A rule outline counts examples with evidence but does not open a combined gallery
    Examples:
    | surface  | count |
    | list     | 2     |
    | children | 2     |
    `, () => {
    given('a <surface> with evidence on <count> outline examples', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when('viewing the rule outline entry', async () => {
      await page().getByRole('note', { name: /examples with attachments in rule outline/ }).waitFor({ state: 'visible' });
    });

    then('the passive indicator says <count> examples and offers no gallery button', async (ctx) => {
      const count = ctx.example.count as number;
      const label = `${count} examples with attachments in rule outline A rule with row evidence`;
      expect(await page().getByRole('note', { name: label }).textContent()).toContain(String(count));
      expect(await page().getByRole('button', { name: label }).count()).toBe(0);
    });
  });

  scenarioOutline(`Rule outlines report step-only evidence once per known example
    Examples:
    | surface  | count |
    | list     | 1     |
    | children | 1     |
    `, () => {
    given('a <surface> with step attachments on one outline example', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when('viewing the outline with step evidence', async () => {
      await page().getByText('An outline with step evidence').waitFor({ state: 'visible' });
    });

    then('the passive indicator counts <count> example despite multiple steps and unrelated results', async (ctx) => {
      const label = `${ctx.example.count} example with attachments in rule outline An outline with step evidence`;
      expect(await page().getByRole('note', { name: label }).textContent()).toContain(String(ctx.example.count));
      expect(await page().getByRole('button', { name: label }).count()).toBe(0);
    });
  });

  scenario("Selecting step-only row '1' shows its 'policy.json' evidence, but row '2' has none", () => {
    given("a list showing '1' outline example with step evidence", async (ctx) => {
      await page().goto(`${baseUrl}?kind=list`);
      await page().getByRole('note', {
        name: `${ctx.step.values[0]} example with attachments in rule outline An outline with step evidence`,
      }).waitFor({ state: 'visible' });
    });

    when("opening the outline, selecting row '1' and its '1' attachment", async (ctx) => {
      await page().getByRole('button', { name: 'An outline with step evidence' }).click();
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: `${ctx.step.values[1]} attachment`, exact: true }).first().click();
    });

    then("the step gallery shows 'policy.json' without 'unknown-row.json' or 'another-outline.json', and row '2' has no step evidence", async (ctx) => {
      const [owned, unknownRow, unrelated, emptyRow] = ctx.step.values as [string, string, string, number];
      const dialog = page().getByRole('dialog');
      await dialog.getByText(owned).first().waitFor({ state: 'visible' });
      expect(await dialog.getByText(unknownRow).count()).toBe(0);
      expect(await dialog.getByText(unrelated).count()).toBe(0);
      await page().keyboard.press('Escape');
      await page().getByRole('button', { name: `Select example ${emptyRow}` }).click();
      expect(await page().getByRole('button', { name: '1 attachment', exact: true }).count()).toBe(0);
    });
  });

  scenario("An unselected rule outline template offers '0' attachment buttons", () => {
    given("a rule outline with '1' attached example", async (ctx) => {
      await page().goto(`${baseUrl}?kind=list`);
      await page().getByRole('note', {
        name: `${ctx.step.values[0]} example with attachments in rule outline An outline with step evidence`,
      }).waitFor({ state: 'visible' });
    });

    when("opening the outline without selecting a row", async () => {
      await page().getByRole('button', { name: 'An outline with step evidence' }).click();
      await page().getByRole('button', { name: 'Select example 1' }).waitFor({ state: 'visible' });
    });

    then("there are '0' template step attachment buttons", async (ctx) => {
      expect(await page().getByRole('button', { name: '1 attachment', exact: true }).count()).toBe(ctx.step.values[0]);
    });
  });

  scenario("Selecting an outline with '2' attached examples still previews only 'standard.json' from row '1'", () => {
    given("the rule outline list shows '2' attached examples", async (ctx) => {
      await page().goto(`${baseUrl}?kind=list`);
      await page().getByRole('note', {
        name: `${ctx.step.values[0]} examples with attachments in rule outline A rule with row evidence`,
      }).waitFor({ state: 'visible' });
    });

    when("navigating to the outline and choosing row '1'", async (ctx) => {
      await page().getByRole('button', { name: /A rule with row evidence/ }).click();
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: 'View all 1 attachment for this example' }).click();
    });

    then("the gallery shows 'standard.json' without 'express.json' or 'wrong-row.json'", async (ctx) => {
      const [first, second, unrelated] = ctx.step.values as string[];
      const dialog = page().getByRole('dialog');
      await dialog.getByText(first).first().waitFor({ state: 'visible' });
      expect(await dialog.getByText(second).count()).toBe(0);
      expect(await dialog.getByText(unrelated).count()).toBe(0);
    });
  });

  scenarioOutline(`Passed scenarios show a passive count of execution and step attachments
    Examples:
    | surface          | count |
    | feature-list     | 2     |
    | feature-children | 2     |
    `, () => {
    given('a passed scenario in the <surface>', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when('viewing its execution and step evidence', async () => {
      await page().getByRole('note', { name: /attachments in scenario A passed scenario with evidence/ }).waitFor({ state: 'visible' });
    });

    then('the scenario indicates <count> attachments without an attachment action', async (ctx) => {
      const label = `${ctx.example.count} attachments in scenario A passed scenario with evidence and its steps`;
      expect(await page().getByRole('note', { name: label }).textContent()).toContain(String(ctx.example.count));
      expect(await page().getByRole('button', { name: label }).count()).toBe(0);
      expect(await page().getByRole('note', { name: /feature/i }).count()).toBe(0);
    });
  });

  scenarioOutline(`A passed scenario reports evidence from either its execution or a step
    Examples:
    | title                                   | count |
    | A scenario with execution evidence only | 1     |
    | A scenario with step evidence only      | 1     |
    `, () => {
    given('a feature list containing <title>', async () => {
      await page().goto(`${baseUrl}?kind=feature-list`);
    });

    when('checking the indicator for <title>', async (ctx) => {
      await page().getByRole('note', {
        name: `${ctx.example.count} attachment in scenario ${ctx.example.title} and its steps`,
      }).waitFor({ state: 'visible' });
    });

    then('the passive count is <count>', async (ctx) => {
      const label = `${ctx.example.count} attachment in scenario ${ctx.example.title} and its steps`;
      expect(await page().getByRole('note', { name: label }).textContent()).toContain(String(ctx.example.count));
      expect(await page().getByRole('button', { name: label }).count()).toBe(0);
    });
  });

  scenarioOutline(`Entries without owned attachments show no outline evidence badge
    Examples:
    | surface  | count |
    | list     | 0     |
    | children | 0     |
    `, () => {
    given('a <surface> with empty rules and outlines', async (ctx) => {
      await page().goto(`${baseUrl}?kind=${ctx.example.surface}`);
    });

    when('checking rule and outline entries despite unrelated row evidence', async () => {
      await page().getByText('A rule without evidence').waitFor({ state: 'visible' });
      await page().getByText('An outline without evidence').waitFor({ state: 'visible' });
    });

    then('the <surface> has <count> evidence badges on empty entries', async (ctx) => {
      const empty = ctx.example.count as number;
      expect(await page().getByRole('note', { name: /without evidence/ }).count()).toBe(empty);
      expect(await page().getByRole('button', { name: /attachments? for rule A rule without evidence/ }).count()).toBe(empty);
      await page().goto(`${baseUrl}?kind=feature-list`);
      await page().getByText('A scenario without evidence').waitFor({ state: 'visible' });
      expect(await page().getByRole('note', { name: /A scenario without evidence/ }).count()).toBe(empty);
      await page().getByText('A scenario outline without example evidence').waitFor({ state: 'visible' });
      expect(await page().getByRole('note', { name: /A scenario outline without example evidence/ }).count()).toBe(empty);
    });
  });

  scenario("A rule without steps opens all '4' attachments, including JSON, image, screenshot and PDF", () => {
    given('a rule report with execution-level evidence', async () => {
      await page().goto(baseUrl);
    });

    when("opening '4' rule attachments", async (ctx) => {
      await page().getByRole('button', { name: `View all ${ctx.step.values[0]} attachments for this rule` }).click();
    });

    then("the preview opens 'order.json' showing '1', then 'chart.png', 'capture.png' and 'receipt.pdf'", async (ctx) => {
      const [json, value, image, screenshot, pdf] = ctx.step.values as [string, number, string, string, string];
      const dialog = page().getByRole('dialog');
      await dialog.getByRole('button', { name: json }).waitFor({ state: 'visible' });
      await dialog.getByLabel('JSON preview').getByText(String(value), { exact: true }).waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: image }).click();
      await dialog.getByRole('img', { name: image }).waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: screenshot }).click();
      await dialog.getByRole('img', { name: screenshot }).waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: pdf }).click();
      await dialog.getByRole('heading', { name: pdf }).waitFor({ state: 'visible' });
    });
  });

  scenario("Selecting row '1' previews 'standard.json' alone", () => {
    given('a rule outline report with per-example evidence', async () => {
      await page().goto(`${baseUrl}?kind=outline`);
    });

    when("selecting example '1' and opening its preview", async (ctx) => {
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
      await page().getByRole('button', { name: 'View all 1 attachment for this example' }).click({ timeout: 5_000 });
    });

    then("the preview contains 'standard.json' but not 'express.json'", async (ctx) => {
      const [first, second] = ctx.step.values as string[];
      await page().getByRole('dialog').getByText(first).first().waitFor({ state: 'visible' });
      expect(await page().getByRole('dialog').getByText(second).count()).toBe(0);
    });
  });

  scenario("Switching from row '1' to row '2' replaces 'standard.json' with 'express.json'", () => {
    given("example '1' is selected in a rule outline", async (ctx) => {
      await page().goto(`${baseUrl}?kind=outline`);
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).click();
    });

    when("switching to example '2' with the keyboard", async (ctx) => {
      await page().getByRole('button', { name: `Select example ${ctx.step.values[0]}` }).focus();
      await page().keyboard.press('Enter');
    });

    then("the selected example previews 'express.json' but not 'standard.json' or 'wrong-row.json'", async (ctx) => {
      const [selected, prior, unrelated] = ctx.step.values as string[];
      await page().getByRole('button', { name: 'View all 1 attachment for this example' }).click({ timeout: 5_000 });
      const dialog = page().getByRole('dialog');
      await dialog.getByText(selected).first().waitFor({ state: 'visible' });
      expect(await dialog.getByText(prior).count()).toBe(0);
      expect(await dialog.getByText(unrelated).count()).toBe(0);
    });
  });

  scenario("An unselected rule outline row does not show an attachment button", () => {
    given('a rule outline report with no selected example', async () => {
      await page().goto(`${baseUrl}?kind=outline`);
    });

    when('checking the available evidence controls', async () => {
      await page().getByRole('button', { name: 'Select example 1' }).waitFor({ state: 'visible' });
    });

    then('no example attachment button is offered', async () => {
      expect(await page().getByRole('button', { name: /attachment for this example/ }).count()).toBe(0);
    });
  });

  scenario("A rule without evidence offers no attachment button", () => {
    given('a rule report with no execution attachments', async () => {
      await page().goto(`${baseUrl}?kind=empty-rule`);
    });

    when('viewing the rule', async () => {
      await page().getByRole('heading', { name: 'Rule: A rule without evidence' }).waitFor({ state: 'visible' });
    });

    then('no rule attachment button is offered', async () => {
      expect(await page().getByRole('button', { name: /attachment for this rule/ }).count()).toBe(0);
    });
  });

  scenario("A scenario step keeps its 'step.png' gallery entry", () => {
    given('a scenario report with step evidence', async () => {
      await page().goto(`${baseUrl}?kind=scenario`);
    });

    when('opening the scenario gallery', async () => {
      await page().getByRole('button', { name: 'View all 1 attachment for this scenario' }).click();
    });

    then("the preview includes 'step.png'", async (ctx) => {
      await page().getByRole('dialog').getByRole('img', { name: ctx.step.values[0] as string }).waitFor({ state: 'visible' });
    });
  });
});
