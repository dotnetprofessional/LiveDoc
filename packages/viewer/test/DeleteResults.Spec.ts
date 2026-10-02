import { afterAll, beforeAll, expect } from 'vitest';
import { feature, scenario, scenarioOutline, given, when, Then as then } from '@swedevtools/livedoc-vitest';
import { useBrowser } from '@swedevtools/livedoc-vitest/playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createServer, type ViteDevServer } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { page } = useBrowser();
let server: ViteDevServer;
let url: string;

const records = [
  ['unit-1', 'Demo.UnitTests', 0],
  ['integration-1', 'Demo.IntegrationTests', 1_000],
  ['unit-2', 'Demo.UnitTests', 120_000],
  ['integration-2', 'Demo.IntegrationTests', 121_000],
  ['keep-1', 'Other', 240_000],
  ['unicode-1', 'Research/測試', 360_000],
  ['unicode-valid', '測試Suite', 480_000],
  ['orphan-1', 'Demo.SmokeTests', 600_000],
] as const;
const epoch = Date.parse('2026-05-15T01:00:00Z');
const allRuns = records.map(([runId, project, offset]) => ({
  protocolVersion: '1.0', runId, project, environment: 'local', framework: 'vitest',
  timestamp: new Date(epoch + offset).toISOString(), duration: 100, status: 'passed',
  summary: { total: 1, passed: 1, failed: 0, pending: 0, skipped: 0 }, documents: [],
}));

type MockState = {
  requests: string[];
  paths: string[];
  fail: Map<string, number>;
  failHierarchy: boolean;
  holdDelete: boolean;
  releaseDelete?: () => void;
  deletedProjects: Set<string>;
  deletedRuns: Set<string>;
};

async function openFixture(raw = false, staticMode = false): Promise<MockState> {
  const state: MockState = {
    requests: [], paths: [], fail: new Map(), failHierarchy: false, holdDelete: false,
    deletedProjects: new Set(), deletedRuns: new Set(),
  };
  await page().unrouteAll();
  await page().route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const visible = allRuns.filter((run) =>
      !state.deletedProjects.has(run.project) && !state.deletedRuns.has(run.runId));
    if (request.method() === 'DELETE') {
      const match = /^\/api\/v1\/(projects|runs)\/(.+)$/.exec(path);
      if (!match) throw new Error(`Unexpected DELETE: ${path}`);
      const id = decodeURIComponent(match[2]!);
      state.requests.push(`${match[1]}:${id}`);
      state.paths.push(path);
      if (state.holdDelete) await new Promise<void>((resolve) => { state.releaseDelete = resolve; });
      const status = state.fail.get(id) ?? (id.includes('/') ? 400 : 200);
      if (status !== 200) {
        await route.fulfill({ status, json: { error: status === 409 ? 'Run has dependent partials' : status === 400 ? 'Invalid project ID' : 'Deletion unavailable' } });
        return;
      }
      if (match[1] === 'projects') state.deletedProjects.add(id);
      else state.deletedRuns.add(id);
      await route.fulfill({ json: { success: true } });
      return;
    }
    if (path === '/api/v1/runs') {
      await route.fulfill({ json: visible });
      return;
    }
    if (path === '/api/v1/hierarchy') {
      if (state.failHierarchy) {
        await route.fulfill({ status: 500, json: { error: 'Hierarchy unavailable' } });
        return;
      }
      await route.fulfill({ json: { projects: [...new Set(visible.map((run) => run.project))].map((name) => {
        const history = visible.filter((run) => run.project === name);
        return { name, environments: [{
          name: 'local', latestRun: history[history.length - 1],
          historyCount: history.length, history: history.slice().reverse().map(({ runId, timestamp, status, summary }) => ({ runId, timestamp, status, summary })),
        }] };
      }) } });
      return;
    }
    throw new Error(`Unexpected API request: ${path}`);
  });
  await page().goto(`${url}${raw ? '?raw' : staticMode ? '?static' : ''}`);
  await page().getByRole('button', { name: 'Select project', exact: true }).waitFor();
  return state;
}

async function chooseDelete(menu: 'project' | 'run', name: string): Promise<void> {
  await page().getByRole('button', { name: `Select ${menu}`, exact: true }).click();
  await page().getByRole('menuitem', { name }).click();
  await page().getByRole('alertdialog').waitFor();
}

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
  if (!address || typeof address === 'string') throw new Error('Fixture server has no port');
  url = `http://127.0.0.1:${address.port}/delete-results-fixture.html`;
});
afterAll(async () => { await server?.close(); });

feature(`Viewer Result Deletion
  @viewer-deletion
  Confirmation and server acknowledgement protect saved results from accidental removal.
`, () => {
  scenario("Cancelling a grouped project deletion makes '0' DELETE requests", () => {
    let mock: MockState;
    given("a grouped project in the selector", async () => { mock = await openFixture(); });
    when("the user opens deletion for 'Demo' and cancels", async (ctx) => {
      await chooseDelete('project', `Delete project group ${ctx.step.values[0]}`);
      expect(await page().getByRole('alertdialog').getByText('Demo.UnitTests').count()).toBeGreaterThan(0);
      expect(await page().getByRole('alertdialog').getByText('Demo.IntegrationTests').count()).toBeGreaterThan(0);
      await page().getByRole('button', { name: 'Cancel' }).click();
    });
    then("'0' DELETE requests were made and the group remains selectable", async (ctx) => {
      expect(mock.requests).toHaveLength(ctx.step.values[0] as number);
      await page().getByRole('button', { name: 'Select project', exact: true }).click();
      expect(await page().getByRole('menuitem', { name: /Demo Group/ }).count()).toBe(1);
    });
  });

  scenario("A static report has no delete action or server mutation", () => {
    let mock: MockState;
    given("the project selector is displayed in static mode", async () => { mock = await openFixture(false, true); });
    when("the user opens the project selector", async () => {
      await page().getByRole('button', { name: 'Select project', exact: true }).click();
    });
    then("no project deletion control appears and '0' DELETE requests are sent", async (ctx) => {
      expect(await page().getByRole('menuitem', { name: /Delete project/ }).count()).toBe(0);
      expect(mock.requests).toHaveLength(ctx.step.values[0] as number);
    });
  });

  scenario("Deleting 'Demo' removes both source projects across historical runs and retains 'Other'", () => {
    let mock: MockState;
    given("a grouped project with two source projects and an unrelated project", async () => { mock = await openFixture(); });
    when("the user confirms permanent deletion of 'Demo'", async (ctx) => {
      await chooseDelete('project', `Delete project group ${ctx.step.values[0]}`);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
    });
    then("'2' source projects were deleted while 'Other' and ungrouped 'Demo.SmokeTests' remain", async (ctx) => {
      expect(mock.requests).toEqual(['projects:Demo.IntegrationTests', 'projects:Demo.UnitTests']);
      expect(mock.deletedProjects.size).toBe(ctx.step.values[0]);
      await page().getByRole('button', { name: 'Select project', exact: true }).click();
      expect(await page().getByRole('menuitem', { name: /Demo Group/ }).count()).toBe(0);
      expect(await page().getByRole('menuitem', { name: ctx.step.values[1] as string, exact: true }).count()).toBe(1);
      expect(await page().getByRole('menuitem', { name: ctx.step.values[2] as string, exact: false }).count()).toBeGreaterThan(0);
      await page().keyboard.press('Escape');
      await page().getByRole('button', { name: 'Simulate late run response' }).click();
      await page().getByRole('button', { name: 'Select project', exact: true }).click();
      expect(await page().getByRole('menuitem', { name: /Demo Group/ }).count()).toBe(0);
    });
  });

  scenario("Deleting one raw run removes exactly 'unit-2' and replaces its deep link", () => {
    let mock: MockState;
    given("a selected raw run with a deep link", async () => {
      mock = await openFixture(true);
      await page().evaluate(() => {
        history.replaceState(null, '', '#/?project=Demo.UnitTests&environment=local&run=unit-2');
      });
    });
    when("the user deletes run 'unit-2'", async (ctx) => {
      await chooseDelete('run', 'Delete run Latest');
      expect(await page().getByRole('alertdialog').getByText(ctx.step.values[0] as string).count()).toBeGreaterThan(0);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
    });
    then("only 'unit-2' was deleted and its URL is gone", async (ctx) => {
      expect(mock.requests).toEqual([`runs:${ctx.step.values[0]}`]);
      expect(page().url()).not.toContain('run=unit-2');
      await page().getByRole('button', { name: 'Select run', exact: true }).click();
      expect(await page().getByRole('menuitem', { name: /unit-2/ }).count()).toBe(0);
    });
  });

  scenario("Deleting a grouped run names and deletes its '2' physical runs only", () => {
    let mock: MockState;
    given("two grouped executions", async () => { mock = await openFixture(); });
    when("the user confirms deleting 'Latest set'", async (ctx) => {
      await chooseDelete('run', `Delete run group ${ctx.step.values[0]}`);
      expect(await page().getByRole('alertdialog').getByText('unit-2').count()).toBeGreaterThan(0);
      expect(await page().getByRole('alertdialog').getByText('integration-2').count()).toBeGreaterThan(0);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
    });
    then("exactly '2' raw run IDs were sent and older runs remain", async (ctx) => {
      expect(mock.requests.sort()).toEqual(['runs:integration-2', 'runs:unit-2']);
      expect(mock.deletedRuns.size).toBe(ctx.step.values[0]);
      expect(mock.deletedRuns.has('unit-1')).toBe(false);
    });
  });

  scenario("A partial group deletion reports '409' and retries only the remaining source", () => {
    let mock: MockState;
    given("the second source project refuses deletion", async () => {
      mock = await openFixture();
      mock.fail.set('Demo.UnitTests', 409);
    });
    when("the user confirms deletion of 'Demo'", async (ctx) => {
      await chooseDelete('project', `Delete project group ${ctx.step.values[0]}`);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
    });
    then("the dialog reports '409' while the remaining source stays available", async (ctx) => {
      await page().getByRole('alert').getByText(/HTTP 409/).waitFor();
      expect(await page().getByRole('alertdialog').isVisible()).toBe(true);
      expect(mock.deletedProjects.has('Demo.UnitTests')).toBe(false);
      expect(mock.deletedProjects.has('Demo.IntegrationTests')).toBe(true);
      expect(await page().getByRole('alertdialog').getByText('Demo.UnitTests').count()).toBeGreaterThan(0);
      expect(ctx.step.values[0]).toBe(409);
      mock.fail.clear();
      await page().getByRole('button', { name: 'Retry deletion' }).click();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
      expect(mock.requests).toEqual(['projects:Demo.IntegrationTests', 'projects:Demo.UnitTests', 'projects:Demo.UnitTests']);
    });
  });

  scenario("Failed refresh after partial deletion still offers the remaining source for retry", () => {
    let mock: MockState;
    given("a group whose second source conflicts and whose hierarchy refresh fails", async () => {
      mock = await openFixture();
      mock.fail.set('Demo.UnitTests', 409);
      mock.failHierarchy = true;
    });
    when("the user confirms deleting 'Demo'", async (ctx) => {
      await chooseDelete('project', `Delete project group ${ctx.step.values[0]}`);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
    });
    then("after refresh succeeds the still-present 'Demo.UnitTests' must be deleted separately", async (ctx) => {
      await page().getByRole('alert').getByText(/Hierarchy unavailable/).waitFor();
      mock.failHierarchy = false;
      await page().getByRole('button', { name: 'Retry refresh' }).click();
      await page().getByRole('alert').getByText(/still remain/).waitFor();
      expect(await page().getByRole('alertdialog').isVisible()).toBe(true);
      mock.fail.clear();
      await page().getByRole('button', { name: 'Retry deletion' }).click();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
      expect(mock.deletedProjects.has(ctx.step.values[0] as string)).toBe(true);
      expect(mock.requests).toEqual(['projects:Demo.IntegrationTests', 'projects:Demo.UnitTests', 'projects:Demo.UnitTests']);
    });
  });

  scenarioOutline(`Server errors keep the run dialog open for retry
    Examples:
    | status |
    | 400    |
    | 404    |
    | 500    |
    | 409    |
  `, () => {
    let mock: MockState;
    given("a selected raw run whose DELETE returns <status>", async (ctx) => {
      mock = await openFixture(true);
      mock.fail.set('unit-2', ctx.example.status as number);
    });
    when("the user tries to delete 'unit-2'", async () => {
      await chooseDelete('run', 'Delete run Latest');
      await page().getByRole('button', { name: 'Delete permanently' }).click();
    });
    then("HTTP <status> is visible and the run was not removed", async (ctx) => {
      await page().getByRole('alert').getByText(`HTTP ${ctx.example.status}`, { exact: false }).waitFor();
      expect(await page().getByRole('alertdialog').isVisible()).toBe(true);
      expect(mock.deletedRuns.size).toBe(0);
      await page().getByRole('button', { name: 'Cancel' }).click();
      expect(await page().getByRole('button', { name: 'Select run', exact: true }).isVisible()).toBe(true);
    });
  });

  scenario("Encoded slash in a source project is rejected with '400' rather than deleting a different project", () => {
    let mock: MockState;
    given("a source project named 'Research/測試'", async () => { mock = await openFixture(true); });
    when("the user confirms deletion of 'Research/測試'", async (ctx) => {
      await chooseDelete('project', `Delete project ${ctx.step.values[0]}`);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
    });
    then("HTTP '400' remains visible and no project is removed", async (ctx) => {
      await page().getByRole('alert').getByText(`HTTP ${ctx.step.values[0]}`, { exact: false }).waitFor();
      expect(mock.requests).toEqual(['projects:Research/測試']);
      expect(mock.deletedProjects.size).toBe(0);
    });
  });

  scenario("A Unicode project '測試Suite' is encoded and deleted without affecting other projects", () => {
    let mock: MockState;
    given("a source project named '測試Suite'", async () => { mock = await openFixture(true); });
    when("the user confirms deletion of '測試Suite'", async (ctx) => {
      await chooseDelete('project', `Delete project ${ctx.step.values[0]}`);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
    });
    then("only '測試Suite' was sent as one encoded path segment", async (ctx) => {
      expect(mock.requests).toEqual([`projects:${ctx.step.values[0]}`]);
      expect(mock.paths).toEqual([`/api/v1/projects/${encodeURIComponent(ctx.step.values[0] as string)}`]);
      expect(mock.deletedProjects.size).toBe(1);
    });
  });

  scenario("A successful deletion with a failed refresh offers retry without another DELETE", () => {
    let mock: MockState;
    given("the updated hierarchy cannot be loaded", async () => {
      mock = await openFixture(true);
      mock.failHierarchy = true;
    });

    when("the user deletes exact run 'unit-2'", async (ctx) => {
      await chooseDelete('run', 'Delete run Latest');
      expect(await page().getByRole('alertdialog').getByText(ctx.step.values[0] as string).count()).toBeGreaterThan(0);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
    });
    then("refresh error remains, and retry refresh does not delete 'unit-2' twice", async (ctx) => {
      await page().getByRole('alert').getByText(/Hierarchy unavailable/).waitFor();
      expect(mock.requests).toEqual([`runs:${ctx.step.values[0]}`]);
      mock.failHierarchy = false;
      await page().getByRole('button', { name: 'Retry refresh' }).click();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
      expect(mock.requests).toEqual([`runs:${ctx.step.values[0]}`]);
    });
  });

  scenario("An in-flight deletion disables repeat confirmation and cancel", () => {
    let mock: MockState;
    given("a raw run whose DELETE response is held", async () => {
      mock = await openFixture(true);
      mock.holdDelete = true;
    });
    when("the user confirms deleting 'unit-2'", async (ctx) => {
      await chooseDelete('run', 'Delete run Latest');
      expect(await page().getByRole('alertdialog').getByText(ctx.step.values[0] as string).count()).toBeGreaterThan(0);
      await page().getByRole('button', { name: 'Delete permanently' }).click();
    });
    then("confirmation and cancel are disabled until the '1' request completes", async (ctx) => {
      expect(await page().getByRole('button', { name: 'Deleting…' }).isDisabled()).toBe(true);
      expect(await page().getByRole('button', { name: 'Cancel' }).isDisabled()).toBe(true);
      expect(mock.requests).toHaveLength(ctx.step.values[0] as number);
      mock.releaseDelete?.();
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
      expect(mock.requests).toHaveLength(ctx.step.values[0] as number);
    });
  });

  scenarioOutline(`Confirmation remains within the viewport
    Examples:
    | width |
    | 390   |
    | 1280  |
  `, () => {
    given("a <width>px project selector", async (ctx) => {
      await page().setViewportSize({ width: ctx.example.width as number, height: 720 });
      await openFixture();
    });
    when("the user opens deletion for 'Demo'", async (ctx) => {
      await chooseDelete('project', `Delete project group ${ctx.step.values[0]}`);
    });
    then("the confirmation fits within the <width>px viewport", async (ctx) => {
      const bounds = await page().getByRole('alertdialog').boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(ctx.example.width as number);
      await page().getByRole('button', { name: 'Cancel' }).click();
    });
  });

  scenario("Keyboard opens a delete dialog and Escape restores focus to the selector", () => {
    given("a raw project selector", async () => { await openFixture(true); });
    when("the user presses Enter on the project selector and its 'Demo.UnitTests' delete action", async (ctx) => {
      await page().getByRole('button', { name: 'Select project', exact: true }).focus();
      await page().keyboard.press('Enter');
      await page().getByRole('menuitem', { name: `Delete project ${ctx.step.values[0]}` }).focus();
      await page().keyboard.press('Enter');
      await page().getByRole('alertdialog').waitFor();
    });
    then("Escape closes the confirmation and focus returns to 'Select project'", async (ctx) => {
      await page().keyboard.press('Escape');
      await page().getByRole('alertdialog').waitFor({ state: 'hidden' });
      expect(await page().getByRole('button', { name: ctx.step.values[0] as string, exact: true }).evaluate((element) =>
        element === document.activeElement)).toBe(true);
    });
  });
});
