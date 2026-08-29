import { expect } from 'vitest';
import { specification, rule } from '../../app/livedoc';
import { ExecutionResults } from '../../app/model';
import { LiveDocViewerReporter } from '../../app/reporter/LiveDocViewerReporter';

async function captureStartRequest(runType?: 'full' | 'partial'): Promise<Record<string, unknown>> {
    const originalFetch = globalThis.fetch;
    let request: Record<string, unknown> = {};
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        request = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        return new Response(JSON.stringify({
            protocolVersion: '1.0',
            runId: 'run-1',
            websocketUrl: '/ws',
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        });
    }) as typeof fetch;

    try {
        const reporter = new LiveDocViewerReporter({
            server: 'http://localhost:3100',
            project: 'RunTypeProject',
            environment: 'local',
            runType,
        });
        await reporter.startRunSession();
        return request;
    } finally {
        globalThis.fetch = originalFetch;
    }
}

specification(`Viewer Reporter Run Type
    @reporting-output @partial-runs
    Developers and agents can identify focused server-backed runs without changing full-run defaults.
    `, () => {
    rule("An explicit run type 'partial' is sent in the start request", async (ctx) => {
        const request = await captureStartRequest(ctx.rule.values[0]);

        expect(request.runType).toBe(ctx.rule.values[0]);
    });

    rule("An omitted run type defaults the start request to 'full'", async (ctx) => {
        const request = await captureStartRequest();

        expect(request.runType).toBe(ctx.rule.values[0]);
    });

    rule("Direct export rejects run type 'partial' with code 'partial-export-unsupported'", (ctx) => {
        const [runType, expectedCode] = ctx.rule.valuesRaw;
        const reporter = new LiveDocViewerReporter({ runType: runType as 'partial' });

        expect(() => reporter.buildTestRun(new ExecutionResults())).toThrow(expectedCode);
    });
});
