import { expect } from "vitest";
import { livedoc as reporterLivedoc } from "@swedevtools/livedoc-vitest";
import { ExecutionResults } from "../../app/model/index";
import { PublishOptions } from "../../app/PublishOptions";
import LiveDocSpecReporter from "../../app/reporter/LiveDocSpecReporter";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";
import { specification, rule } from "../../app/livedoc";

type DiscoveryResult = { url: string; port: number } | null;
type ReporterDiscoveryHarness = {
    discoverDefaultLocalServer(): Promise<DiscoveryResult>;
    applyPublishEnvironmentOverrides(): string | undefined;
};
type PublishOptionsSnapshot = {
    enabled: boolean;
    server: string;
    project: string;
    environment: string;
};

const publishEnvNames = [
    "LIVEDOC_SERVER_URL",
    "LIVEDOC_PUBLISH_SERVER",
    "LIVEDOC_VIEWER_SERVER",
    "LIVEDOC_PROJECT",
    "LIVEDOC_PUBLISH_PROJECT",
    "LIVEDOC_VIEWER_PROJECT",
    "LIVEDOC_ENVIRONMENT",
    "LIVEDOC_PUBLISH_ENV",
    "LIVEDOC_VIEWER_ENV",
];

function snapshotPublishOptions(): PublishOptionsSnapshot {
    return {
        enabled: reporterLivedoc.options.publish.enabled,
        server: reporterLivedoc.options.publish.server,
        project: reporterLivedoc.options.publish.project,
        environment: reporterLivedoc.options.publish.environment,
    };
}

function restorePublishOptions(snapshot: PublishOptionsSnapshot): void {
    reporterLivedoc.options.publish.enabled = snapshot.enabled;
    reporterLivedoc.options.publish.server = snapshot.server;
    reporterLivedoc.options.publish.project = snapshot.project;
    reporterLivedoc.options.publish.environment = snapshot.environment;
}

function disablePublishingForReporterUnderTest(): void {
    reporterLivedoc.options.publish.enabled = false;
    reporterLivedoc.options.publish.server = "http://localhost:3100";
    reporterLivedoc.options.publish.project = "livedoc";
    reporterLivedoc.options.publish.environment = "local";
}

function snapshotPublishEnvironment(): Record<string, string | undefined> {
    return Object.fromEntries(publishEnvNames.map((name) => [name, process.env[name]]));
}

function restorePublishEnvironment(snapshot: Record<string, string | undefined>): void {
    for (const name of publishEnvNames) {
        const value = snapshot[name];
        if (value === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = value;
        }
    }
}

function discoveryHarness(reporter: LiveDocSpecReporter): ReporterDiscoveryHarness {
    return reporter as unknown as ReporterDiscoveryHarness;
}

specification(`LiveDocSpecReporter Viewer Discovery
    @reporting @viewer @auto-discovery
    The reporter must publish when a local viewer is running, even if server
    discovery cannot find its temporary port file.
    `, () => {

    rule("Health check fallback calls 'http://localhost:3100/api/health' and returns server 'http://localhost:3100' with port '3100'", async (ctx) => {
        const [expectedHealthUrl, expectedServerUrl, expectedPort] = ctx.rule.values;
        const originalFetch = globalThis.fetch;
        let requestedHealthUrl = "";
        let discovered: DiscoveryResult = null;

        (globalThis as any).fetch = async (url: any) => {
            requestedHealthUrl = String(url);
            return {
                ok: requestedHealthUrl === String(expectedHealthUrl),
                status: requestedHealthUrl === String(expectedHealthUrl) ? 200 : 404,
                json: async () => ({}),
                text: async () => "",
            } as any;
        };

        try {
            const reporter = new LiveDocSpecReporter({ detailLevel: "silent" });
            discovered = await discoveryHarness(reporter).discoverDefaultLocalServer();
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(requestedHealthUrl).toBe(String(expectedHealthUrl));
        expect(discovered?.url).toBe(String(expectedServerUrl));
        expect(discovered?.port).toBe(Number(expectedPort));
    });

    rule("Default project name for publishing and viewer output is 'livedoc'", (ctx) => {
        const [expectedProject] = ctx.rule.values;

        const publishOptions = new PublishOptions();
        const testRun = new LiveDocViewerReporter().buildTestRun(new ExecutionResults());

        expect(publishOptions.project).toBe(String(expectedProject));
        expect(testRun.project).toBe(String(expectedProject));
    });

    rule("Publish environment server 'http://localhost:3100' project 'livedoc' and environment 'local' enable publishing", (ctx) => {
        const [expectedServer, expectedProject, expectedEnvironment] = ctx.rule.values;
        const originalEnvironment = snapshotPublishEnvironment();
        const originalPublishOptions = snapshotPublishOptions();
        let configuredServer: string | undefined;
        let configuredPublishOptions: PublishOptionsSnapshot | undefined;

        try {
            disablePublishingForReporterUnderTest();
            process.env.LIVEDOC_SERVER_URL = String(expectedServer);
            process.env.LIVEDOC_PROJECT = String(expectedProject);
            process.env.LIVEDOC_ENVIRONMENT = String(expectedEnvironment);

            const reporter = new LiveDocSpecReporter({ detailLevel: "silent" });
            configuredServer = discoveryHarness(reporter).applyPublishEnvironmentOverrides();
            configuredPublishOptions = snapshotPublishOptions();
        } finally {
            restorePublishEnvironment(originalEnvironment);
            restorePublishOptions(originalPublishOptions);
        }

        expect(configuredServer).toBe(String(expectedServer));
        expect(configuredPublishOptions?.enabled).toBe(true);
        expect(configuredPublishOptions?.server).toBe(String(expectedServer));
        expect(configuredPublishOptions?.project).toBe(String(expectedProject));
        expect(configuredPublishOptions?.environment).toBe(String(expectedEnvironment));
    });
});
