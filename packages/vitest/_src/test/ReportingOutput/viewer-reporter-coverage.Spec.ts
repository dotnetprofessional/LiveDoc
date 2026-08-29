import { feature, scenario, given, when, Then as then, and } from "@swedevtools/livedoc-vitest";
import { expect } from "vitest";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";
import LiveDocSpecReporter from "../../app/reporter/LiveDocSpecReporter";
import { ExecutionResults } from "../../app/model";

feature(`Viewer reporter coverage
    @reporting @coverage
    Coverage artifacts are optional run evidence. They should enrich the viewer without changing test pass/fail status.
    `, () => {
    scenario("Publishing a completed run with optional coverage evidence", () => {
        let tempDir: string;
        let postedCompletion: any;
        let report: ReturnType<LiveDocViewerReporter["buildTestRun"]>;

        given("an Istanbul coverage-summary artifact with line coverage '75' percent below threshold '80'", async (ctx) => {
            const [linePct, threshold] = ctx.step.values;
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "livedoc-vitest-coverage-"));
            const coverageDir = path.join(tempDir, "coverage");
            await fs.mkdir(coverageDir, { recursive: true });
            await fs.writeFile(
                path.join(coverageDir, "coverage-summary.json"),
                JSON.stringify({
                    total: {
                        lines: { total: 100, covered: linePct, skipped: 0, pct: linePct },
                        statements: { total: 100, covered: linePct, skipped: 0, pct: linePct },
                        functions: { total: 10, covered: 8, skipped: 0, pct: 80 },
                        branches: { total: 20, covered: 15, skipped: 0, pct: linePct },
                    },
                    [path.join(tempDir, "src", "calculator.ts")]: {
                        lines: { total: 100, covered: linePct, skipped: 0, pct: linePct },
                        statements: { total: 100, covered: linePct, skipped: 0, pct: linePct },
                        functions: { total: 10, covered: 8, skipped: 0, pct: 80 },
                        branches: { total: 20, covered: 15, skipped: 0, pct: linePct },
                    },
                }),
                "utf8"
            );

            const reporter = new LiveDocViewerReporter({
                project: "coverage-project",
                environment: "local",
                silent: true,
                coverage: { enabled: true, thresholds: { lines: threshold } },
            });

            report = reporter.buildTestRun(new ExecutionResults(), {
                coverageContext: {
                    enabled: true,
                    rootDir: tempDir,
                    reportsDirectory: coverageDir,
                    runStartedAt: Date.now() - 1000,
                },
            });
        });

        when("the viewer reporter posts the completed run", async () => {
            const originalFetch = globalThis.fetch;
            postedCompletion = undefined;

            (globalThis as any).fetch = async (url: any, init?: any) => {
                const urlString = String(url);
                if (urlString.includes("/api/v1/runs/start")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({ protocolVersion: "1.0", runId: "run-coverage", websocketUrl: "" }),
                        text: async () => "",
                    };
                }
                if (urlString.includes("/api/v1/runs/run-coverage/complete")) {
                    postedCompletion = init?.body ? JSON.parse(String(init.body)) : undefined;
                    return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
                }
                return { ok: true, status: 200, json: async () => ({ success: true }), text: async () => "" };
            };

            try {
                const reporter = new LiveDocViewerReporter({
                    server: "http://localhost:3100",
                    project: "coverage-project",
                    environment: "local",
                    silent: true,
                    coverage: { enabled: true, thresholds: { lines: 80 } },
                });
                await reporter.execute(new ExecutionResults(), {
                    coverageContext: {
                        enabled: true,
                        rootDir: tempDir,
                        reportsDirectory: path.join(tempDir, "coverage"),
                        runStartedAt: Date.now() - 1000,
                    },
                });
            } finally {
                globalThis.fetch = originalFetch;
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        then("the exported run keeps status 'passed' while coverage lines are '75' percent", (ctx) => {
            const [expectedStatus, expectedPct] = ctx.step.values;
            expect(report.status).toBe(expectedStatus);
            expect(report.coverage?.summary?.lines?.pct).toBe(expectedPct);
        });

        and("the exported run contains '1' file-level coverage entry", (ctx) => {
            expect(report.coverage?.files).toHaveLength(ctx.step.values[0]);
            expect(report.coverage?.files?.[0]?.path).toBe("src/calculator.ts");
        });

        and("the completion request includes threshold status 'warning'", (ctx) => {
            expect(postedCompletion?.coverage?.thresholds?.[0]?.status).toBe(ctx.step.values[0]);
            expect(postedCompletion?.status).toBe("passed");
        });
    });

    scenario("Publishing coverage directly from Vitest's in-memory coverage map", () => {
        let coverageMap: unknown;
        let report: ReturnType<LiveDocViewerReporter["buildTestRun"]>;

        given("Vitest reports branch coverage '75' percent across '20' branches in memory", (ctx) => {
            const [branchPct, branchTotal] = ctx.step.values;
            const filePath = path.join(process.cwd(), "src", "calculator.ts");
            const summary = {
                branches: {
                    total: branchTotal,
                    covered: branchTotal * branchPct / 100,
                    skipped: 0,
                    pct: branchPct,
                },
            };
            const coverageSummary = { toJSON: () => summary };

            coverageMap = {
                getCoverageSummary: () => coverageSummary,
                files: () => [filePath],
                fileCoverageFor: () => ({
                    toSummary: () => coverageSummary,
                }),
            };
        });

        when("the LiveDoc reporter receives coverage before filesystem reporters finish", () => {
            const specReporter = new LiveDocSpecReporter({ detailLevel: "silent" });
            specReporter.onCoverage(coverageMap);
            const coverageContext = (
                specReporter as unknown as { coverageContext: Record<string, unknown> }
            ).coverageContext;

            report = new LiveDocViewerReporter({
                project: "coverage-map-project",
                environment: "local",
                silent: true,
            }).buildTestRun(new ExecutionResults(), { coverageContext });
        });

        then("the published report contains branch coverage '75' percent", (ctx) => {
            expect(report.coverage?.summary?.branches?.pct).toBe(ctx.step.values[0]);
        });

        and("the published report contains '1' file at 'src/calculator.ts'", (ctx) => {
            const [fileCount, expectedPath] = ctx.step.values;
            expect(report.coverage?.files).toHaveLength(fileCount);
            expect(report.coverage?.files?.[0]?.path).toBe(expectedPath);
        });
    });
});
