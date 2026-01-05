import { feature, scenario, background, given, when, Then, and } from "@livedoc/vitest";
import { expect } from "vitest";
import { RunStore } from "../src/store.js";
import type { Feature, Scenario, Step, Statistics } from "../src/schema.js";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

feature(`RunStore Data Management
    @unit @store
    The RunStore manages test run data in memory and persists to disk.
    It supports the full BDD hierarchy: Run → Feature → Scenario → Step.
    `, () => {
    let store: RunStore;
    let testDataDir: string;

    background("Fresh store for each scenario", (ctx) => {
        given("a new RunStore with temporary storage", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            store = new RunStore(50, testDataDir);
            await store.initialize();
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup errors
            }
        });
    });

    scenario("Creating a new test run", () => {
        let run: ReturnType<typeof store.getRun>;

        when("a run is created with project 'MyProject' environment 'local' framework 'vitest'", () => {
            store.createRun("run-1", "MyProject", "local", "vitest", new Date().toISOString());
            run = store.getRun("run-1");
        });

        Then("the run should exist with status 'running'", () => {
            expect(run).toBeDefined();
            expect(run?.status).toBe("running");
        });

        and("the run should have project 'MyProject'", () => {
            expect(run?.project).toBe("MyProject");
        });

        and("the run should have environment 'local'", () => {
            expect(run?.environment).toBe("local");
        });

        and("the run should have framework 'vitest'", () => {
            expect(run?.framework).toBe("vitest");
        });

        and("the run should have empty features and suites", () => {
            expect(run?.documents).toEqual([]);
        });
    });

    scenario("Tracking multiple runs per project", () => {
        let runs: ReturnType<typeof store.getRunsForProject>;

        given("a run exists for project 'Project1' environment 'dev'", () => {
            store.createRun("run-1", "Project1", "dev", "vitest", new Date().toISOString());
        });

        when("another run is created for the same project and environment", () => {
            store.createRun("run-2", "Project1", "dev", "vitest", new Date().toISOString());
            runs = store.getRunsForProject("Project1", "dev");
        });

        Then("there should be '2' runs for that project", (ctx) => {
            expect(runs).toHaveLength(ctx.step.values[0]);
        });
    });

    scenario("Adding a feature to a run", () => {
        let run: ReturnType<typeof store.getRun>;

        given("a run 'run-1' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
        });

        when("a feature 'User Authentication' is added to the run", () => {
            store.addNode("run-1", undefined, {
                id: "feature-1",
                kind: "feature",
                title: "User Authentication",
                tags: [],
                children: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
            run = store.getRun("run-1");
        });

        Then("the run should have '1' feature", (ctx) => {
            expect(run?.documents).toHaveLength(ctx.step.values[0]);
        });

        and("the feature title should be 'User Authentication'", (ctx) => {
            expect(run?.documents[0].title).toBe(ctx.step.values[0]);
        });
    });

    scenario("Adding a scenario to a feature", () => {
        let run: ReturnType<typeof store.getRun>;

        given("a run with feature 'feature-1' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
            store.addNode("run-1", undefined, {
                id: "feature-1",
                kind: "feature",
                title: "User Authentication",
                tags: [],
                children: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
        });

        when("a scenario 'Valid login' is added to the feature", () => {
            store.addNode("run-1", "feature-1", {
                id: "scenario-1",
                kind: "scenario",
                title: "Valid login",
                tags: [],
                children: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
            run = store.getRun("run-1");
        });

        Then("the feature should have '1' scenario", (ctx) => {
            const feature = run?.documents[0] as any;
            expect(feature.children).toHaveLength(ctx.step.values[0]);
        });

        and("the scenario title should be 'Valid login'", (ctx) => {
            const feature = run?.documents[0] as any;
            expect(feature.children[0].title).toBe(ctx.step.values[0]);
        });
    });

    scenario("Adding a step to a scenario", () => {
        let scenario: any;

        given("a run with a scenario 'scenario-1' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
            store.addNode("run-1", undefined, {
                id: "feature-1",
                kind: "feature",
                title: "Feature",
                tags: [],
                children: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
            store.addNode("run-1", "feature-1", {
                id: "scenario-1",
                kind: "scenario",
                title: "Test scenario",
                tags: [],
                children: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
        });

        when("a step 'a registered user' of type 'Given' with status 'passed' is added", () => {
            store.addNode("run-1", "scenario-1", {
                id: "step-1",
                kind: "step",
                title: "a registered user",
                keyword: "given",
                execution: {
                    status: "passed",
                    duration: 10
                }
            });
            const run = store.getRun("run-1");
            const feature = run?.documents[0] as any;
            scenario = feature.children[0];
        });

        Then("the scenario should have '1' step", (ctx) => {
            expect(scenario?.children).toHaveLength(ctx.step.values[0]);
        });

        and("the step title should be 'a registered user'", (ctx) => {
            expect(scenario?.children[0].title).toBe(ctx.step.values[0]);
        });

        and("the step status should be 'passed'", (ctx) => {
            expect(scenario?.children[0].execution.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("Completing a run", () => {
        let run: ReturnType<typeof store.getRun>;

        given("a running test run exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
        });

        when("the run is completed with status 'passed' duration '1500'", (ctx) => {
            store.completeRun("run-1", "passed", 1500);
            run = store.getRun("run-1");
        });

        Then("the run status should be 'passed'", (ctx) => {
            expect(run?.status).toBe(ctx.step.values[0]);
        });

        and("the run duration should be '1500' milliseconds", (ctx) => {
            expect(run?.duration).toBe(ctx.step.values[0]);
        });
    });

    scenario("Deleting a run", () => {
        let deleted: boolean;

        given("a run 'run-1' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
        });

        when("the run is deleted", async () => {
            deleted = await store.deleteRun("run-1");
        });

        Then("the delete operation should return 'true'", (ctx) => {
            expect(deleted).toBe(ctx.step.values[0]);
        });

        and("the run should no longer exist", () => {
            expect(store.getRun("run-1")).toBeUndefined();
        });
    });

    scenario("Deleting a non-existent run", () => {
        let deleted: boolean;

        when("attempting to delete a run that does not exist", async () => {
            deleted = await store.deleteRun("non-existent");
        });

        Then("the delete operation should return 'false'", (ctx) => {
            expect(deleted).toBe(ctx.step.values[0]);
        });
    });
});

feature(`RunStore Project Organization
    @unit @store
    The RunStore organizes runs by project and environment for easy querying.
    `, () => {
    let store: RunStore;
    let testDataDir: string;

    background("Fresh store", (ctx) => {
        given("a new RunStore instance", async () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            store = new RunStore(50, testDataDir);
            await store.initialize();
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    scenario("Listing projects with environments", () => {
        let projects: ReturnType<typeof store.getProjects>;

        given("runs exist for project 'Project1' in environments 'dev' and 'prod'", () => {
            store.createRun("run-1", "Project1", "dev", "vitest", new Date().toISOString());
            store.createRun("run-2", "Project1", "prod", "vitest", new Date().toISOString());
        });

        and("a run exists for project 'Project2' in environment 'dev'", () => {
            store.createRun("run-3", "Project2", "dev", "vitest", new Date().toISOString());
        });

        when("listing all projects", () => {
            projects = store.getProjects();
        });

        Then("there should be '3' project-environment combinations", (ctx) => {
            expect(projects).toHaveLength(ctx.step.values[0]);
        });
    });

    scenario("Getting project hierarchy", () => {
        let hierarchy: ReturnType<typeof store.getProjectHierarchy>;

        given("runs exist for project 'HierarchyProject' in environments 'staging' and 'production'", () => {
            store.createRun("run-h1", "HierarchyProject", "staging", "vitest", new Date().toISOString());
            store.createRun("run-h2", "HierarchyProject", "production", "vitest", new Date().toISOString());
        });

        when("getting the project hierarchy", () => {
            hierarchy = store.getProjectHierarchy();
        });

        Then("the hierarchy should include a project named 'HierarchyProject'", () => {
            const project = hierarchy.find(p => p.name === "HierarchyProject");
            expect(project).toBeDefined();
        });

        and("the project 'HierarchyProject' should have name 'HierarchyProject'", () => {
            const project = hierarchy.find(p => p.name === "HierarchyProject");
            expect(project!.name).toBe("HierarchyProject");
        });

        and("the project 'HierarchyProject' should have '2' environments", (ctx) => {
            const project = hierarchy.find(p => p.name === "HierarchyProject");
            expect(project!.environments).toHaveLength(ctx.step.values[1]);
        });
    });
});

feature(`RunStore Persistence
    @integration @store
    The RunStore persists completed runs to disk and reloads them on restart.
    `, () => {
    let store: RunStore;
    let testDataDir: string;

    background("Temporary storage directory", (ctx) => {
        given("a temporary data directory", () => {
            testDataDir = path.join(os.tmpdir(), `livedoc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        });

        ctx.afterBackground(async () => {
            try {
                await fs.rm(testDataDir, { recursive: true, force: true });
            } catch {
                // Ignore
            }
        });
    });

    scenario("Persisting and reloading completed runs", () => {
        let reloadedRun: ReturnType<typeof store.getRun>;

        given("a RunStore with a completed run", async () => {
            store = new RunStore(50, testDataDir);
            await store.initialize();
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
            store.completeRun("run-1", "passed", 1000, {
                total: 1, passed: 1, failed: 0, pending: 0, skipped: 0, duration: 1000
            });
        });

        when("the store is flushed and a new store loads from the same directory", async () => {
            // Wait for async save to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            await store.flush();

            const store2 = new RunStore(50, testDataDir);
            await store2.initialize();
            reloadedRun = store2.getRun("run-1");
        });

        Then("the reloaded run should exist", () => {
            expect(reloadedRun).toBeDefined();
        });

        and("the reloaded run should have status 'passed'", (ctx) => {
            expect(reloadedRun?.status).toBe(ctx.step.values[0]);
        });
    });
});
