import { afterAll, beforeAll, expect } from 'vitest';
import { feature, scenario, given, when, Then as then } from '@swedevtools/livedoc-vitest';
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
  if (!address || typeof address === 'string') throw new Error('Background fixture server has no port');
  baseUrl = `http://127.0.0.1:${address.port}/background-fixture.html`;
});

afterAll(async () => {
  await server?.close();
});

feature('Shared Background in the Viewer', () => {
  scenario("A scenario with its own Given displays '1' Background Given and '1' scenario Given", () => {
    given("a feature with shared setup and a scenario named 'A scenario adds its own Given'", async (ctx) => {
      await page().goto(baseUrl);
      await page().getByRole('button', { name: ctx.step.values[0] }).waitFor({ state: 'visible' });
    });

    when("opening 'A scenario adds its own Given'", async (ctx) => {
      await page().getByRole('button', { name: ctx.step.values[0] }).click();
      await page().getByRole('heading', { name: 'Background: Shared setup' }).waitFor({ state: 'visible' });
    });

    then("separate Background and Scenario sections show '1' shared Given and '1' local Given", async (ctx) => {
      const [sharedCount, localCount] = ctx.step.values as number[];
      expect(await page().getByRole('heading', { name: 'Background: Shared setup' }).count()).toBe(1);
      expect(await page().getByRole('heading', { name: 'Scenario: A scenario adds its own Given' }).count()).toBe(1);
      expect(await page().getByText('the account starts with 10 credits', { exact: true }).count()).toBe(sharedCount);
      expect(await page().getByText('the account receives 2 more credits', { exact: true }).count()).toBe(localCount);
      expect(await page().getByText('the account is ready', { exact: true }).count()).toBe(1);
    });
  });
});
