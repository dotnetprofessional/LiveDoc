import type { Reporter } from 'vitest/reporters';
import type { File, Task, TaskResultPack } from '@vitest/runner';
import type { Vitest } from 'vitest/node';
import { discoverServer } from '@livedoc/server';
import type { StartRunRequest, StartRunResponse, Feature, Scenario, Step, StepType, TestStatus } from '@livedoc/server';

export default class LiveDocServerReporter implements Reporter {
    private serverUrl: string | null = null;
    private runId: string | null = null;
    private isAvailable = false;
    private project = "Unknown Project";
    private environment = "local";

    constructor() {
        console.log("[LiveDoc] Reporter constructor called");
    }

    async onInit(ctx: Vitest) {
        console.log("[LiveDoc] onInit called");
        this.project = ctx.config.name || "LiveDoc Project";
        
        // Try to discover server
        const serverInfo = await discoverServer();
        if (serverInfo) {
            this.serverUrl = serverInfo.url;
            this.isAvailable = true;
            console.log(`[LiveDoc] Connected to server at ${this.serverUrl}`);
        } else {
            console.log(`[LiveDoc] Server not found. Reporter disabled.`);
        }
    }

    async onTestRunEnd(files: any) {
        console.log(`[LiveDoc] onTestRunEnd called with ${files?.length} files`);
        if (!this.isAvailable || !this.serverUrl) return;

        // Start run
        try {
            const req: StartRunRequest = {
                project: this.project,
                environment: this.environment,
                framework: 'vitest',
                timestamp: new Date().toISOString()
            };

            console.log(`[LiveDoc] Sending start run request to ${this.serverUrl}/api/runs/start`);
            const res = await fetch(`${this.serverUrl}/api/runs/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req)
            });

            if (res.ok) {
                const data = await res.json() as StartRunResponse;
                this.runId = data.runId;
                console.log(`[LiveDoc] Run started with ID: ${this.runId}`);
                
                // Send all data
                await this.sendAllData(files);
                
                // Complete run
                await this.post(`/api/runs/${this.runId}/complete`, {});
                console.log(`[LiveDoc] Run ${this.runId} completed and sent to server.`);

            } else {
                console.error(`[LiveDoc] Failed to start run. Status: ${res.status} ${res.statusText}`);
            }
        } catch (e) {
            console.error(`[LiveDoc] Failed to start run:`, e);
            this.isAvailable = false;
        }
    }

    private async sendAllData(testModules: any[]) {
        for (const module of testModules) {
            // In Vitest 2.x/3.x/4.x, the structure might be different.
            // LiveDocSpecReporter uses module.task.tasks
            // Let's try to be robust.
            const file = module.task || module;
            
            if (file && file.tasks) {
                for (const task of file.tasks) {
                    if (task.type === 'suite') {
                        await this.processSuite(task);
                    }
                }
            }
        }
    }

    private async processSuite(task: Task) {
        if (task.type !== 'suite') return;

        if (task.name.startsWith('Feature:')) {
            await this.sendFeature(task);
            if (task.tasks) {
                for (const child of task.tasks) {
                    await this.processSuite(child);
                }
            }
        } else if (task.name.startsWith('Scenario:')) {
            await this.sendScenario(task);
            if (task.tasks) {
                for (const child of task.tasks) {
                    await this.processStep(child);
                }
            }
        } else {
            // Regular suite or describe, recurse
            if (task.tasks) {
                for (const child of task.tasks) {
                    await this.processSuite(child);
                }
            }
        }
    }

    private async processStep(task: Task) {
        if (task.type === 'test') {
            await this.sendStep(task);
        }
    }


    private async sendFeature(task: Task) {
        const feature: Feature = {
            id: task.id,
            title: task.name.replace('Feature:', '').trim(),
            filename: task.file?.name || '',
            status: 'running',
            duration: 0,
            scenarios: [],
            statistics: { total: 0, passed: 0, failed: 0, pending: 0, skipped: 0, duration: 0 }
        };

        await this.post(`/api/runs/${this.runId}/features`, feature);
    }

    private async sendScenario(task: Task) {
        const parentId = task.suite?.id;
        if (!parentId) return;

        const scenario: Scenario = {
            id: task.id,
            type: 'Scenario',
            title: task.name.replace('Scenario:', '').trim(),
            status: 'running',
            duration: 0,
            steps: []
        };

        await this.post(`/api/runs/${this.runId}/scenarios`, {
            featureId: parentId,
            ...scenario
        });
    }

    private async sendStep(task: Task) {
        // We need to find the parent scenario ID
        const parentId = task.suite?.id;
        if (!parentId) return;

        // Parse step type from name (Given/When/Then)
        const typeMatch = task.name.match(/^(Given|When|Then|And|But)\s/i);
        const type = (typeMatch ? typeMatch[1] : 'Given') as StepType;
        const title = task.name.replace(/^(Given|When|Then|And|But)\s/i, '').trim();

        const step: Step = {
            id: task.id,
            type: type,
            title: title,
            status: this.mapStatus(task.result?.state),
            duration: task.result?.duration || 0
        };

        // The server API might expect adding a step to a scenario
        // POST /api/runs/:runId/steps with body { scenarioId, step }
        // Wait, the backlog says: POST /api/runs/:runId/steps -> Add step
        // I need to check the server implementation for what body it expects.
        
        await this.post(`/api/runs/${this.runId}/steps`, {
            scenarioId: parentId,
            ...step
        });
    }

    private mapStatus(state?: string): TestStatus {
        switch (state) {
            case 'pass': return 'passed';
            case 'fail': return 'failed';
            case 'skip': return 'skipped';
            case 'run': return 'running';
            default: return 'pending';
        }
    }

    private async post(endpoint: string, data: any) {
        if (!this.isAvailable || !this.serverUrl) return;
        try {
            await fetch(`${this.serverUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch (e) {
            console.error(`[LiveDoc] Failed to post to ${endpoint}`, e);
        }
    }
}
