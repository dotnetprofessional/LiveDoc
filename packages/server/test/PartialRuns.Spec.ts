import { feature, scenario, background, given, when, Then, and } from '@swedevtools/livedoc-vitest';
import { expect } from 'vitest';
import { createServer, RunStoreError, type LiveDocServer } from '../src/index.js';
import { promises as fs } from 'fs';
import path from 'path';

function testCase(id: string, title: string, testId: string, status: 'passed' | 'failed') {
  return {
    id,
    kind: 'Feature',
    title,
    tests: [{ id: testId, kind: 'Rule', title: testId, execution: { status, duration: 1 } }],
    statistics: { total: 1, passed: status === 'passed' ? 1 : 0, failed: status === 'failed' ? 1 : 0, pending: 0, skipped: 0 },
  };
}

async function start(baseUrl: string, project: string, environment: string, framework: string, runType: 'full' | 'partial' = 'full'): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/runs/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, environment, framework, runType }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body));
  return body.runId;
}

async function complete(baseUrl: string, runId: string, status: 'passed' | 'failed' = 'passed'): Promise<void> {
  const response = await fetch(`${baseUrl}/api/v1/runs/${runId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, duration: 1 }),
  });
  expect(response.status).toBe(200);
}

feature(`V1 partial run lifecycle
  @integration @partial-runs
  Completed physical runs are retained while latest responses expose their combined lineage.
  `, () => {
  let server: LiveDocServer;
  let baseUrl: string;
  let dataDir: string;

  background('an isolated running server', (ctx) => {
    given('a server data directory named \'.partial-runs\'', async (ctx) => {
      dataDir = path.join(process.cwd(), String(ctx.step.values[0]));
      await fs.rm(dataDir, { recursive: true, force: true });
      server = createServer({ port: 0, host: 'localhost', dataDir });
      baseUrl = `http://localhost:${await server.listen()}`;
    });

    ctx.afterBackground(async () => {
      await server.stop();
      await fs.rm(dataDir, { recursive: true, force: true });
    });
  });

  scenario('A full baseline and two partial runs expose cumulative combined data while preserving physical data', () => {
    let fullId: string;
    let firstPartialId: string;
    let secondPartialId: string;
    let physical: any;
    let combined: any;
    let latest: any;

    given('a completed full run for project \'partial-project\' environment \'ci\' framework \'vitest\' with failed rule \'rule-a\'', async (ctx) => {
      const [project, environment, framework, testId] = ctx.step.values;
      fullId = await start(baseUrl, project, environment, framework);
      await fetch(`${baseUrl}/api/v1/runs/${fullId}/testcases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCase: testCase('case-a', 'Baseline', testId, 'failed') }),
      });
      await complete(baseUrl, fullId, 'failed');
    });

    when('two partial runs update rule \'rule-a\' to passed and add rule \'rule-b\'', async (ctx) => {
      const [firstRule, secondRule] = ctx.step.values;
      firstPartialId = await start(baseUrl, 'partial-project', 'ci', 'vitest', 'partial');
      await fetch(`${baseUrl}/api/v1/runs/${firstPartialId}/testcases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCase: testCase('case-a', 'Update', firstRule, 'passed') }),
      });
      await complete(baseUrl, firstPartialId);
      secondPartialId = await start(baseUrl, 'partial-project', 'ci', 'vitest', 'partial');
      await fetch(`${baseUrl}/api/v1/runs/${secondPartialId}/testcases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCase: testCase('case-b', 'Added', secondRule, 'passed') }),
      });
      await complete(baseUrl, secondPartialId);
    });

    Then('the second partial physical view contains only \'1\' document and references its full baseline', async (ctx) => {
      physical = await (await fetch(`${baseUrl}/api/v1/runs/${secondPartialId}?view=physical`)).json();
      expect(physical.documents).toHaveLength(ctx.step.values[0]);
      expect(physical.baselineRunId).toBe(fullId);
    });

    and('the second partial combined view contains \'2\' documents with \'2\' passed tests', async (ctx) => {
      combined = await (await fetch(`${baseUrl}/api/v1/runs/${secondPartialId}?view=combined`)).json();
      expect(combined.documents).toHaveLength(ctx.step.values[0]);
      expect(combined.summary.passed).toBe(ctx.step.values[1]);
    });

    and('the latest view remains the combined second partial while completed history has \'3\' physical runs', async (ctx) => {
      latest = await (await fetch(`${baseUrl}/api/v1/projects/partial-project/ci/latest`)).json();
      const hierarchy = await (await fetch(`${baseUrl}/api/v1/hierarchy`)).json();
      expect(latest.runId).toBe(secondPartialId);
      expect(hierarchy.projects[0].environments[0].historyCount).toBe(ctx.step.values[0]);
      expect(hierarchy.projects[0].environments[0].history[0].runType).toBe('partial');
    });
  });

  scenario('Partial starts require a matching completed full baseline and only one active run', () => {
    let response: Response;

    when('starting a partial run without a baseline for project \'rejections\' returns code \'no-baseline\'', async (ctx) => {
      const [project, expectedCode] = ctx.step.values;
      response = await fetch(`${baseUrl}/api/v1/runs/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, environment: 'ci', framework: 'vitest', runType: 'partial' }),
      });
      expect((await response.json()).code).toBe(expectedCode);
    });

    Then('the no-baseline response status is \'409\'', (ctx) => {
      expect(response.status).toBe(ctx.step.values[0]);
    });

    and('an overlapping full start for project \'overlap\' returns code \'run-active\'', async (ctx) => {
      const [project, expectedCode] = ctx.step.values;
      await start(baseUrl, project, 'ci', 'vitest');
      response = await fetch(`${baseUrl}/api/v1/runs/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, environment: 'ci', framework: 'vitest' }),
      });
      expect((await response.json()).code).toBe(expectedCode);
    });

    and('the overlap response status is \'409\'', (ctx) => {
      expect(response.status).toBe(ctx.step.values[0]);
    });

    and('a partial framework \'jest\' against full framework \'vitest\' returns code \'framework-mismatch\' and status \'409\'', async (ctx) => {
      const [partialFramework, fullFramework, expectedCode, expectedStatus] = ctx.step.values;
      const baselineId = await start(baseUrl, 'framework', 'ci', fullFramework);
      await complete(baseUrl, baselineId);
      response = await fetch(`${baseUrl}/api/v1/runs/start`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: 'framework', environment: 'ci', framework: partialFramework, runType: 'partial' }),
      });
      expect((await response.json()).code).toBe(expectedCode);
      expect(response.status).toBe(expectedStatus);
    });
  });

  scenario('Cancelling an active run fences later mutations while the latest completed run remains available', () => {
    let fullId: string;
    let partialId: string;
    let mutation: Response;
    let latestDuringPartial: any;
    let legacyLatestDuringPartial: any;
    let latest: any;

    given('a completed full run for project \'cancellation\' environment \'ci\' framework \'vitest\'', async (ctx) => {
      const [project, environment, framework] = ctx.step.values;
      fullId = await start(baseUrl, project, environment, framework);
      await complete(baseUrl, fullId);
    });

    when('a partial run is cancelled and receives a later test case mutation', async () => {
      partialId = await start(baseUrl, 'cancellation', 'ci', 'vitest', 'partial');
      latestDuringPartial = await (await fetch(`${baseUrl}/api/v1/projects/cancellation/ci/latest`)).json();
      legacyLatestDuringPartial = await (await fetch(`${baseUrl}/api/projects/cancellation/ci/latest`)).json();
      await fetch(`${baseUrl}/api/v1/runs/${partialId}/cancel`, { method: 'POST' });
      mutation = await fetch(`${baseUrl}/api/v1/runs/${partialId}/testcases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCase: testCase('case-late', 'Late', 'rule-late', 'passed') }),
      });
      latest = await (await fetch(`${baseUrl}/api/v1/projects/cancellation/ci/latest`)).json();
    });

    Then('the fenced mutation returns status \'410\' and code \'run-cancelled\'', async (ctx) => {
      const [status, code] = ctx.step.values;
      expect(mutation.status).toBe(status);
      expect((await mutation.json()).code).toBe(code);
    });

    and('the latest view remains the completed full baseline while the partial is active', () => {
      expect(latestDuringPartial.runId).toBe(fullId);
      expect(legacyLatestDuringPartial.runId).toBe(fullId);
    });

    and('the latest completed run remains the full baseline', () => {
      expect(latest.runId).toBe(fullId);
    });
  });

  scenario('Restarting rebuilds the latest combined run from physical history', () => {
    let fullId: string;
    let partialId: string;
    let latest: any;

    given('a completed full and partial run for project \'restart\' environment \'ci\' framework \'vitest\'', async (ctx) => {
      const [project, environment, framework] = ctx.step.values;
      fullId = await start(baseUrl, project, environment, framework);
      await fetch(`${baseUrl}/api/v1/runs/${fullId}/testcases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCase: testCase('baseline-case', 'Baseline', 'baseline-rule', 'failed') }),
      });
      await complete(baseUrl, fullId, 'failed');
      partialId = await start(baseUrl, project, environment, framework, 'partial');
      await fetch(`${baseUrl}/api/v1/runs/${partialId}/testcases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCase: testCase('partial-case', 'Partial', 'partial-rule', 'passed') }),
      });
      await complete(baseUrl, partialId);
    });

    when('the server restarts from the same data directory', async () => {
      await server.stop();
      server = createServer({ port: 0, host: 'localhost', dataDir });
      baseUrl = `http://localhost:${await server.listen()}`;
      latest = await (await fetch(`${baseUrl}/api/v1/projects/restart/ci/latest`)).json();
    });

    Then('the restored latest run is partial and combines \'2\' documents from physical history', (ctx) => {
      expect(latest.runId).toBe(partialId);
      expect(latest.runType).toBe('partial');
      expect(latest.documents).toHaveLength(ctx.step.values[0]);
    });
  });

  scenario('Deleting a baseline or middle partial is blocked while a newer partial depends on it', () => {
    let baselineError: RunStoreError | undefined;
    let middleError: RunStoreError | undefined;
    let activeDependencyError: RunStoreError | undefined;
    let latestPartialId: string;

    given('a full run with two partials exists for project \'deletion\' environment \'ci\' framework \'vitest\'', async (ctx) => {
      const [project, environment, framework] = ctx.step.values;
      const baselineId = await start(baseUrl, project, environment, framework);
      await complete(baseUrl, baselineId);
      const middlePartialId = await start(baseUrl, project, environment, framework, 'partial');
      await complete(baseUrl, middlePartialId);
      latestPartialId = await start(baseUrl, project, environment, framework, 'partial');
      await complete(baseUrl, latestPartialId);

      try {
        await server.getRunStore().deleteRun(baselineId);
      } catch (error) {
        baselineError = error as RunStoreError;
      }
      try {
        await server.getRunStore().deleteRun(middlePartialId);
      } catch (error) {
        middleError = error as RunStoreError;
      }
      await start(baseUrl, project, environment, framework, 'partial');
      try {
        await server.getRunStore().deleteRun(latestPartialId);
      } catch (error) {
        activeDependencyError = error as RunStoreError;
      }
    });

    when('the baseline and middle partial deletion errors are inspected', () => {
      expect(baselineError).toBeInstanceOf(RunStoreError);
      expect(middleError).toBeInstanceOf(RunStoreError);
      expect(activeDependencyError).toBeInstanceOf(RunStoreError);
    });

    Then('both deletions report code \'dependent-run\'', (ctx) => {
      expect(baselineError?.code).toBe(ctx.step.values[0]);
      expect(middleError?.code).toBe(ctx.step.values[0]);
      expect(activeDependencyError?.code).toBe(ctx.step.values[0]);
    });

    and('the latest combined run remains the newest partial', () => {
      expect(server.getRunStore().getLatestRun('deletion', 'ci')?.runId).toBe(latestPartialId);
    });
  });

  scenario('Completing a partial as cancelled excludes it from physical history and the combined latest view', () => {
    let baselineId: string;
    let partialId: string;
    let hierarchy: any;
    let physicalResponse: Response;
    let lateMutation: Response;

    given('a completed full baseline for project \'cancelled-completion\' environment \'ci\' framework \'vitest\'', async (ctx) => {
      const [project, environment, framework] = ctx.step.values;
      baselineId = await start(baseUrl, project, environment, framework);
      await complete(baseUrl, baselineId);
    });

    when('a partial run completes with status \'cancelled\' and then receives a late mutation', async (ctx) => {
      partialId = await start(baseUrl, 'cancelled-completion', 'ci', 'vitest', 'partial');
      await fetch(`${baseUrl}/api/v1/runs/${partialId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: ctx.step.values[0], duration: 1 }),
      });
      hierarchy = await (await fetch(`${baseUrl}/api/v1/hierarchy`)).json();
      physicalResponse = await fetch(`${baseUrl}/api/v1/runs/${partialId}?view=physical`);
      lateMutation = await fetch(`${baseUrl}/api/v1/runs/${partialId}/testcases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testCase: testCase('late-case', 'Late', 'late-rule', 'passed') }),
      });
    });

    Then('completed history still contains only the \'1\' full baseline', (ctx) => {
      expect(hierarchy.projects[0].environments[0].historyCount).toBe(ctx.step.values[0]);
      expect(hierarchy.projects[0].environments[0].latestRun.runId).toBe(baselineId);
    });

    and('the cancelled physical run returns \'404\' while its late mutation returns \'410\'', (ctx) => {
      const [physicalStatus, mutationStatus] = ctx.step.values;
      expect(physicalResponse.status).toBe(physicalStatus);
      expect(lateMutation.status).toBe(mutationStatus);
    });
  });
});
