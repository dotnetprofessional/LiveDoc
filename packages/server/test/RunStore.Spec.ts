import { feature, scenario, background, given, when, Then, and } from "@swedevtools/livedoc-vitest";
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

    scenario("Rejecting overlapping runs for the same project and environment", () => {
        let error: unknown;

        given("a run exists for project 'Project1' environment 'dev'", () => {
            store.createRun("run-1", "Project1", "dev", "vitest", new Date().toISOString());
        });

        when("another run is created for the same project and environment", () => {
            try {
                store.createRun("run-2", "Project1", "dev", "vitest", new Date().toISOString());
            } catch (caught) {
                error = caught;
            }
        });

        Then("the second start should be rejected with code 'run-active'", (ctx) => {
            expect((error as { code?: string } | undefined)?.code).toBe(ctx.step.values[0]);
        });
    });

    scenario("Adding a feature to a run", () => {
        let run: ReturnType<typeof store.getRun>;

        given("a run 'run-1' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
        });

        when("a test case 'User Authentication' is added to the run", () => {
            store.upsertTestCase("run-1", {
                id: "feature-1",
                kind: "Feature",
                title: "User Authentication",
                tests: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
            run = store.getRun("run-1");
        });

        Then("the run should have '1' test case", (ctx) => {
            expect(run?.documents).toHaveLength(ctx.step.values[0]);
        });

        and("the test case title should be 'User Authentication'", (ctx) => {
            expect(run?.documents[0].title).toBe(ctx.step.values[0]);
        });
    });

    scenario("Adding a scenario to a feature", () => {
        let run: ReturnType<typeof store.getRun>;

        given("a run with test case 'feature-1' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
            store.upsertTestCase("run-1", {
                id: "feature-1",
                kind: "Feature",
                title: "User Authentication",
                tests: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
        });

        when("a scenario 'Valid login' is added to the test case", () => {
            store.upsertTest("run-1", "feature-1", {
                id: "scenario-1",
                kind: "Scenario",
                title: "Valid login",
                steps: [],
                execution: { status: "pending", duration: 0 }
            });
            run = store.getRun("run-1");
        });

        Then("the test case should have '1' scenario", (ctx) => {
            expect(run?.documents[0].tests).toHaveLength(ctx.step.values[0]);
        });

        and("the scenario title should be 'Valid login'", (ctx) => {
            expect(run?.documents[0].tests[0].title).toBe(ctx.step.values[0]);
        });
    });

    scenario("Adding a step to a scenario", () => {
        let scenario: any;

        given("a run with a scenario 'scenario-1' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
            store.upsertTestCase("run-1", {
                id: "feature-1",
                kind: "Feature",
                title: "Feature",
                tests: [{
                    id: "scenario-1",
                    kind: "Scenario",
                    title: "Test scenario",
                    steps: [],
                    execution: { status: "pending", duration: 0 }
                }],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
        });

        when("a step 'a registered user' of type 'Given' with status 'passed' is added", () => {
            store.replaceScenarioSteps("run-1", "scenario-1", [{
                id: "step-1",
                kind: "Step",
                title: "a registered user",
                keyword: "given",
                execution: {
                    status: "passed",
                    duration: 10
                }
            }]);
            const run = store.getRun("run-1");
            scenario = run?.documents[0].tests[0];
        });

        Then("the scenario should have '1' step", (ctx) => {
            expect(scenario?.steps).toHaveLength(ctx.step.values[0]);
        });

        and("the step title should be 'a registered user'", (ctx) => {
            expect(scenario?.steps[0].title).toBe(ctx.step.values[0]);
        });

        and("the step status should be 'passed'", (ctx) => {
            expect(scenario?.steps[0].execution.status).toBe(ctx.step.values[0]);
        });
    });

    scenario("A failed test does not complete an active run", () => {
        let run: ReturnType<typeof store.getRun>;

        given("a running test run exists", () => {
            store.createRun("run-with-failure", "Project", "dev", "xunit", new Date().toISOString());
        });

        when("a test case reports '1' failed scenario while the invocation is still active", (ctx) => {
            store.upsertTestCase("run-with-failure", {
                id: "feature-with-failure",
                kind: "Feature",
                title: "Failure during active run",
                tests: [{
                    id: "failed-scenario",
                    kind: "Scenario",
                    title: "A scenario fails",
                    steps: [{
                        id: "failed-step",
                        kind: "Step",
                        keyword: "then",
                        title: "an assertion fails",
                        execution: { status: "failed", duration: 10 }
                    }],
                    execution: { status: "failed", duration: 10 }
                }],
                statistics: { total: 1, passed: 0, failed: ctx.step.values[0], pending: 0, skipped: 0 }
            });
            run = store.getRun("run-with-failure");
        });

        Then("the active run status remains 'running'", (ctx) => {
            expect(run?.status).toBe(ctx.step.values[0]);
        });

        and("the live summary still reports '1' failed test", (ctx) => {
            expect(run?.summary.failed).toBe(ctx.step.values[0]);
        });
    });

    scenario("A late test update cannot replace a terminal run status", () => {
        let completing: Promise<NonNullable<ReturnType<typeof store.getRun>>>;
        let releasePersistence: () => void = () => {};
        let run: ReturnType<typeof store.getRun>;

        given("a run has '1' pending test and '1' skipped test", (ctx) => {
            store.createRun("run-with-late-update", "Project", "dev", "xunit", new Date().toISOString());
            store.upsertTestCase("run-with-late-update", {
                id: "mixed-results",
                kind: "Specification",
                title: "Mixed results",
                tests: [{
                    id: "pending-rule",
                    kind: "Rule",
                    title: "Pending rule",
                    execution: { status: "pending", duration: 0 }
                }, {
                    id: "skipped-rule",
                    kind: "Rule",
                    title: "Skipped rule",
                    execution: { status: "skipped", duration: 0 }
                }],
                statistics: {
                    total: 2,
                    passed: 0,
                    failed: 0,
                    pending: ctx.step.values[0],
                    skipped: ctx.step.values[1]
                }
            });
        });

        when("completion reports terminal status 'passed' before a late duration update arrives", async (ctx) => {
            const storeInternals = store as unknown as {
                writeJsonAtomically(filePath: string, value: unknown): Promise<void>;
            };
            const writeJsonAtomically = storeInternals.writeJsonAtomically.bind(store);
            let delayNextWrite = true;
            const persistenceGate = new Promise<void>((resolve) => {
                releasePersistence = resolve;
            });
            storeInternals.writeJsonAtomically = async (filePath: string, value: unknown) => {
                if (delayNextWrite) {
                    delayNextWrite = false;
                    await persistenceGate;
                }
                return writeJsonAtomically(filePath, value);
            };

            completing = store.completeRun("run-with-late-update", ctx.step.values[0], 100);
            store.patchTestExecution("run-with-late-update", "pending-rule", { duration: 25 });
            releasePersistence();
            await completing;
            run = store.getRun("run-with-late-update");
        });

        Then("the completed run status remains 'passed'", (ctx) => {
            expect(run?.status).toBe(ctx.step.values[0]);
        });

        and("the recomputed summary still reports '1' pending and '1' skipped test", (ctx) => {
            expect(run?.summary.pending).toBe(ctx.step.values[0]);
            expect(run?.summary.skipped).toBe(ctx.step.values[1]);
        });
    });

    scenario("Updating a node preserves existing template step docString", () => {
        let outline: any;

        given("a run with a scenarioOutline 'outline-1' with template step 't-step-1' docString 'Template <value>' exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
            store.upsertTestCase("run-1", {
                id: "feature-1",
                kind: "Feature",
                title: "Feature",
                tests: [],
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            });
            store.upsertTest("run-1", "feature-1", {
                id: "outline-1",
                kind: "ScenarioOutline",
                title: "Outline",
                steps: [{
                    id: "t-step-1",
                    kind: "Step",
                    title: "a step",
                    keyword: "given",
                    docString: { content: "Template <value>", mediaType: "text/plain" },
                    execution: { status: "pending", duration: 0 }
                }],
                examples: [],
                exampleResults: [],
                execution: { status: "pending", duration: 0 },
                statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0 }
            } as any);
        });

        when("the scenarioOutline step 't-step-1' is updated without a docString", () => {
            store.replaceScenarioSteps("run-1", "outline-1", [{
                id: "t-step-1",
                kind: "Step",
                title: "a step",
                keyword: "given",
                execution: { status: "passed", duration: 1 }
            }] as any);
            const run = store.getRun("run-1");
            outline = run?.documents[0].tests[0] as any;
        });

        Then("the template step 't-step-1' should no longer have a docString after an explicit steps replacement", () => {
            expect(outline?.steps?.[0]?.docString).toBeUndefined();
        });
    });

    scenario("Completing a run", () => {
        let run: ReturnType<typeof store.getRun>;

        given("a running test run exists", () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
        });

        when("the run is completed with status 'passed' duration '1500'", async (ctx) => {
            await store.completeRun("run-1", "passed", ctx.step.values[1]);
            run = store.getRun("run-1");
        });

        Then("the run status should be 'passed'", (ctx) => {
            expect(run?.status).toBe(ctx.step.values[0]);
        });

        and("the run duration should be '1500' milliseconds", (ctx) => {
            expect(run?.duration).toBe(ctx.step.values[0]);
        });
    });

    scenario("Deleting a completed run", () => {
        let deleted: boolean;

        given("a completed run 'run-1' exists", async () => {
            store.createRun("run-1", "Project", "dev", "vitest", new Date().toISOString());
            await store.completeRun("run-1", "passed", 0);
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
        let projects: ReturnType<typeof store.getProjectHierarchy>;

        given("completed runs exist for project 'Project1' in environments 'dev' and 'prod'", async () => {
            store.createRun("run-1", "Project1", "dev", "vitest", new Date().toISOString());
            await store.completeRun("run-1", "passed", 0);
            store.createRun("run-2", "Project1", "prod", "vitest", new Date().toISOString());
            await store.completeRun("run-2", "passed", 0);
        });

        and("a completed run exists for project 'Project2' in environment 'dev'", async () => {
            store.createRun("run-3", "Project2", "dev", "vitest", new Date().toISOString());
            await store.completeRun("run-3", "passed", 0);
        });

        when("listing all projects", () => {
            projects = store.getProjectHierarchy();
        });

        Then("there should be '2' projects", (ctx) => {
            expect(projects).toHaveLength(ctx.step.values[0]);
        });
    });

    scenario("Getting project hierarchy", () => {
        let hierarchy: ReturnType<typeof store.getProjectHierarchy>;

        given("completed runs exist for project 'HierarchyProject' in environments 'staging' and 'production'", async () => {
            store.createRun("run-h1", "HierarchyProject", "staging", "vitest", new Date().toISOString());
            await store.completeRun("run-h1", "passed", 0);
            store.createRun("run-h2", "HierarchyProject", "production", "vitest", new Date().toISOString());
            await store.completeRun("run-h2", "passed", 0);
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
