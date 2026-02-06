import { feature, scenario, background, given, when, Then, and } from "@swedevtools/livedoc-vitest";
import { expect } from "vitest";
import { createServer, type LiveDocServer } from "../src/index.js";
import os from "os";
import path from "path";
import { promises as fs } from "fs";

feature(`Server API - Health and Discovery
    @integration @api
    The LiveDoc server exposes REST endpoints for health checks and project discovery.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({
                port: 0,
                host: "localhost",
                dataDir: testDataDir
            });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;
        });

        ctx.afterBackground(async () => {
            if (server) {
                await server.stop();
            }
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    scenario("Health check returns server status", () => {
        let response: Response;
        let data: any;

        when("requesting the health endpoint", async () => {
            response = await fetch(`${baseUrl}/api/health`);
            data = await response.json();
        });

        Then("the response status should be '200'", async (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });

        and("the status should be 'ok'", (ctx) => {
            expect(data.status).toBe(ctx.step.values[0]);
        });

        and("the version should be '1.0'", () => {
            expect(data.version).toBe("1.0");
        });
    });

    scenario("Listing projects when runs exist", () => {
        let response: Response;
        let data: any;

        given("runs exist for projects 'Project1' and 'Project2'", async () => {
            await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "Project1", environment: "dev", framework: "vitest" })
            });
            await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "Project2", environment: "prod", framework: "vitest" })
            });
        });

        when("requesting the projects endpoint", async () => {
            response = await fetch(`${baseUrl}/api/projects`);
            data = await response.json();
        });

        Then("the response should contain '2' projects", (ctx) => {
            expect(data.projects).toHaveLength(ctx.step.values[0]);
        });
    });

    scenario("Getting project hierarchy", () => {
        let response: Response;
        let data: any;

        given("runs exist for 'HierarchyProject' in environments 'staging' and 'production'", async () => {
            await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "HierarchyProject", environment: "staging", framework: "vitest" })
            });
            await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "HierarchyProject", environment: "production", framework: "vitest" })
            });
        });

        when("requesting the hierarchy endpoint", async () => {
            response = await fetch(`${baseUrl}/api/hierarchy`);
            data = await response.json();
        });

        Then("the hierarchy should include 'HierarchyProject' with '2' environments", (ctx) => {
            const project = data.projects.find((p: any) => p.name === "HierarchyProject");
            expect(project).toBeDefined();
            expect(project.environments).toHaveLength(ctx.step.values[1]);
        });
    });
});

feature(`Server API - Run Management
    @integration @api
    The server provides endpoints to start, update, and complete test runs.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({
                port: 0,
                host: "localhost",
                dataDir: testDataDir
            });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;
        });

        ctx.afterBackground(async () => {
            if (server) {
                await server.stop();
            }
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    scenario("Starting a new test run", () => {
        let response: Response;
        let data: any;

        when("starting a run for project 'TestProject' environment 'local' framework 'vitest'", async () => {
            response = await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    project: "TestProject",
                    environment: "local",
                    framework: "vitest"
                })
            });
            data = await response.json();
        });

        Then("the response status should be '201'", async (ctx) => {
            if (response.status !== 201) { console.log(JSON.stringify(data, null, 2)); } expect(response.status).toBe(ctx.step.values[0]);
        });

        and("a runId should be returned", () => {
            expect(data.runId).toBeDefined();
        });

        and("the websocketUrl should be '/ws'", (ctx) => {
            expect(data.websocketUrl).toBe(ctx.step.values[0]);
        });
    });

    scenario("Getting run details", () => {
        let runId: string;
        let response: Response;
        let data: any;

        given("a run exists for project 'TestProject'", async () => {
            const startResponse = await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "TestProject", environment: "local", framework: "vitest" })
            });
            const result = await startResponse.json();
            runId = result.runId;
        });

        when("requesting the run details", async () => {
            response = await fetch(`${baseUrl}/api/runs/${runId}`);
            data = await response.json();
        });

        Then("the response status should be '200'", async (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });

        and("the project should be 'TestProject'", (ctx) => {
            expect(data.project).toBe(ctx.step.values[0]);
        });

        and("the status should be 'running'", (ctx) => {
            expect(data.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("Getting a non-existent run returns 404", () => {
        let response: Response;

        when("requesting a run that does not exist", async () => {
            response = await fetch(`${baseUrl}/api/runs/non-existent`);
        });

        Then("the response status should be '404'", async (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("Deleting a run", () => {
        let runId: string;
        let deleteResponse: Response;
        let getResponse: Response;

        given("a run exists", async () => {
            const startResponse = await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "TestProject", environment: "local", framework: "vitest" })
            });
            const result = await startResponse.json();
            runId = result.runId;
        });

        when("deleting the run", async () => {
            deleteResponse = await fetch(`${baseUrl}/api/runs/${runId}`, { method: "DELETE" });
        });

        Then("the delete response status should be '200'", (ctx) => {
            expect(deleteResponse.status).toBe(ctx.step.values[0]);
        });

        and("the run should no longer be accessible", async () => {
            getResponse = await fetch(`${baseUrl}/api/runs/${runId}`);
            expect(getResponse.status).toBe(404);
        });
    });
});

feature(`Server API - BDD Data Streaming
    @integration @api
    The server accepts streaming BDD data: features, scenarios, and steps.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;
    let runId: string;

    background("Running server with active run", (ctx) => {
        given("a LiveDoc server is running with an active run", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({
                port: 0,
                host: "localhost",
                dataDir: testDataDir
            });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;

            const startResponse = await fetch(`${baseUrl}/api/runs/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: "TestProject", environment: "local", framework: "vitest" })
            });
            const result = await startResponse.json();
            runId = result.runId;
        });

        ctx.afterBackground(async () => {
            if (server) {
                await server.stop();
            }
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    scenario("Adding a feature to a run", () => {
        let response: Response;
        let run: any;

        when("adding a feature 'User Login' to the run", async () => {
            response = await fetch(`${baseUrl}/api/runs/${runId}/nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node: {
                        id: "feature-1",
                        kind: "feature",
                        title: "User Login",
                        tags: [],
                        children: [],
                        stats: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
                    }
                })
            });
        });

        Then("the response status should be '200'", async (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });

        and("the run should contain the feature 'User Login'", async () => {
            const runResponse = await fetch(`${baseUrl}/api/runs/${runId}`);
            run = await runResponse.json();
            expect(run.documents).toHaveLength(1);
            expect(run.documents[0].title).toBe("User Login");
        });
    });

    scenario("Adding a scenario to a feature", () => {
        let response: Response;
        let run: any;

        given("a feature 'feature-1' exists in the run", async () => {
            await fetch(`${baseUrl}/api/runs/${runId}/nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node: {
                        id: "feature-1",
                        kind: "feature",
                        title: "User Login",
                        tags: [],
                        children: [],
                        stats: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
                    }
                })
            });
        });

        when("adding a scenario 'Valid credentials' to the feature", async () => {
            response = await fetch(`${baseUrl}/api/runs/${runId}/nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parentId: "feature-1",
                    node: {
                        id: "scenario-1",
                        kind: "scenario",
                        title: "Valid credentials",
                        tags: [],
                        children: [],
                        stats: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
                    }
                })
            });
        });

        Then("the response status should be '200'", async (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });

        and("the feature should contain the scenario 'Valid credentials'", async () => {
            const runResponse = await fetch(`${baseUrl}/api/runs/${runId}`);
            run = await runResponse.json();
            expect(run.documents[0].children).toHaveLength(1);
            expect(run.documents[0].children[0].title).toBe("Valid credentials");
        });
    });

    scenario("Adding a step to a scenario", () => {
        let response: Response;
        let run: any;

        given("a scenario 'scenario-1' exists in the run", async () => {
            await fetch(`${baseUrl}/api/runs/${runId}/nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    node: {
                        id: "feature-1",
                        kind: "feature",
                        title: "Feature",
                        tags: [],
                        children: [],
                        stats: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
                    }
                })
            });
            await fetch(`${baseUrl}/api/runs/${runId}/nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parentId: "feature-1",
                    node: {
                        id: "scenario-1",
                        kind: "scenario",
                        title: "Test scenario",
                        tags: [],
                        children: [],
                        stats: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
                    }
                })
            });
        });

        when("adding a step 'a registered user' with status 'passed' and duration '15'", async () => {
            response = await fetch(`${baseUrl}/api/runs/${runId}/nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parentId: "scenario-1",
                    node: {
                        id: "step-1",
                        kind: "step",
                        title: "a registered user",
                        keyword: "given",
                        execution: {
                            status: "passed",
                            duration: 15
                        }
                    }
                })
            });
        });

        Then("the response status should be '200'", async (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });

        and("the scenario should contain the step 'a registered user'", async () => {
            const runResponse = await fetch(`${baseUrl}/api/runs/${runId}`);
            run = await runResponse.json();
            const scenario = run.documents[0].children[0];
            expect(scenario.children).toHaveLength(1);
            expect(scenario.children[0].title).toBe("a registered user");
        });
    });

    scenario("Completing a run", () => {
        let response: Response;
        let run: any;

        when("completing the run with status 'passed' and duration '2500'", async () => {
            response = await fetch(`${baseUrl}/api/runs/${runId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "passed",
                    duration: 2500
                })
            });
        });

        Then("the response status should be '200'", async (ctx) => {
            expect(response.status).toBe(ctx.step.values[0]);
        });

        and("the run status should be 'passed'", async () => {
            const runResponse = await fetch(`${baseUrl}/api/runs/${runId}`);
            run = await runResponse.json();
            expect(run.status).toBe("passed");
        });

        and("the run duration should be '2500'", () => {
            expect(run.duration).toBe(2500);
        });
    });
});

feature(`Server API - Batch Mode
    @integration @api
    The server accepts complete test runs in batch mode for CI/CD integration.
    `, () => {
    let server: LiveDocServer;
    let testDataDir: string;
    let baseUrl: string;

    background("Running server", (ctx) => {
        given("a LiveDoc server is running", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-api-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            server = createServer({
                port: 0,
                host: "localhost",
                dataDir: testDataDir
            });
            const port = await server.listen();
            baseUrl = `http://localhost:${port}`;
        });

        ctx.afterBackground(async () => {
            if (server) {
                await server.stop();
            }
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    scenario("Posting a complete run in batch mode", () => {
        let response: Response;
        let data: any;
        let run: any;

        when("posting a complete run for project 'BatchProject' with '1' feature", async () => {
            response = await fetch(`${baseUrl}/api/runs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    version: "1.0",
                    project: "BatchProject",
                    environment: "ci",
                    framework: "vitest",
                    timestamp: new Date().toISOString(),
                    duration: 5000,
                    status: "passed",
                    summary: {
                        total: 20,
                        passed: 20,
                        failed: 0,
                        pending: 0,
                        skipped: 0,
                        duration: 5000
                    },
                    features: [
                        {
                            id: "f1",
                            title: "Feature 1",
                            filename: "f1.ts",
                            status: "passed",
                            duration: 2500,
                            scenarios: [],
                            stats: { total: 10, passed: 10, failed: 0, pending: 0, skipped: 0, duration: 2500 }
                        }
                    ],
                    suites: []
                })
            });
            data = await response.json();
        });

        Then("the response status should be '201'", async (ctx) => {
            if (response.status !== 201) { console.log(JSON.stringify(data, null, 2)); } expect(response.status).toBe(ctx.step.values[0]);
        });

        and("a runId should be returned", () => {
            expect(data.runId).toBeDefined();
        });

        and("the run should be retrievable with project 'BatchProject'", async () => {
            const runResponse = await fetch(`${baseUrl}/api/runs/${data.runId}`);
            run = await runResponse.json();
            expect(run.project).toBe("BatchProject");
        });

        and("the run should have '1' feature", () => {
            expect(run.features).toHaveLength(1);
        });
    });
});

