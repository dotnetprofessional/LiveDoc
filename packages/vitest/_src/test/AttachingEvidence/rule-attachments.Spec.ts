import { expect, vi } from "vitest";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { Attachment, TestCase } from "@swedevtools/livedoc-schema";
import { V1ExecutionResultSchema, V1TestRunSchema, V1UpsertTestCaseRequestSchema } from "@swedevtools/livedoc-schema";
import { feature, scenario, given, when, Then as then, specification, rule, ruleOutline } from "../../app/livedoc";
import { Rule, RuleExample, RuleOutline, Specification, SpecStatus } from "../../app/model";
import LiveDocSpecReporter from "../../app/reporter/LiveDocSpecReporter";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";

specification(`Rule execution attachments
    @attaching-evidence @attachments
    Evidence belongs to the rule execution or the individual outline example that produced it.
    `, () => {
    rule("A rule attaches 'dGVzdA==' as 'image/png' kind 'image' titled 'Chart', a screenshot 'Snapshot', and JSON 'Résumé'", (ctx) => {
        const [base64, mimeType, kind, chartTitle, screenshotTitle, jsonTitle] = ctx.rule!.valuesRaw;
        const ruleContext = ctx.rule!;
        ruleContext.attach(base64, { mimeType, kind: kind as Attachment["kind"], title: chartTitle });
        ruleContext.attachScreenshot(base64, screenshotTitle);
        ruleContext.attachJSON({ title: jsonTitle }, jsonTitle);

        const execution = V1ExecutionResultSchema.safeParse({
            status: "passed", duration: 0, attachments: ruleContext.attachments,
        });
        expect(execution.success, execution.success ? undefined : execution.error.message).toBe(true);
        expect(ruleContext.attachments[0].kind).toBe("image");
        expect(ruleContext.attachments).toHaveLength(3);
        expect(ruleContext.attachments.map(({ kind, mimeType, title, base64 }) => ({ kind, mimeType, title, base64 }))).toEqual([
            { kind, mimeType, title: chartTitle, base64 },
            { kind: "screenshot", mimeType: "image/png", title: screenshotTitle, base64 },
            {
                kind: "file", mimeType: "application/json", title: jsonTitle,
                base64: Buffer.from(JSON.stringify({ title: jsonTitle }, null, 2)).toString("base64"),
            },
        ]);
        expect(new Set(ruleContext.attachments.map(attachment => attachment.id)).size).toBe(3);
    });

    let previousRowAttachments: Attachment[] | undefined;
    ruleOutline(`Example <value> attaches JSON, screenshot 'Snapshot', and file 'dGVzdA==' only to its own row
        Examples:
        | value |
        | alpha |
        | beta  |
        `, (ctx) => {
        const value = String(ctx.example!.value);
        ctx.rule!.attachJSON({ value }, value);
        ctx.rule!.attachScreenshot(ctx.rule!.valuesRaw[1], ctx.rule!.valuesRaw[0]);
        ctx.rule!.attach(ctx.rule!.valuesRaw[1], { title: value });
        expect(ctx.rule!.attachments).toHaveLength(3);
        expect(ctx.rule!.attachments.map(evidence => evidence.kind)).toEqual(["file", "screenshot", "file"]);
        expect(ctx.rule!.attachments.map(evidence => evidence.title)).toEqual([
            value, ctx.rule!.valuesRaw[0], value,
        ]);
        if (previousRowAttachments) {
            expect(ctx.rule!.attachments).not.toBe(previousRowAttachments);
            expect(ctx.rule!.attachments[0].id).not.toBe(previousRowAttachments[0].id);
            expect(previousRowAttachments[0].title).not.toBe(value);
        }
        previousRowAttachments = ctx.rule!.attachments;
    });

    rule(
        "A failed rule 'failed' and outline rows 'alpha' and 'beta' export attachments only on their matching executions",
        async (ctx) => {
            const [failedTitle, firstRow, secondRow] = ctx.rule!.valuesRaw;
            const specification = new Specification();
            specification.title = "Evidence export";
            specification.filename = "Evidence.Spec.ts";

            const failedRule = new Rule(specification);
            failedRule.title = failedTitle;
            failedRule.getRuleContext().attachScreenshot("cG5n", failedTitle);
            const failedAttachment = failedRule.attachments[0];

            const outline = new RuleOutline(specification);
            outline.title = "Rows <value>";
            outline.tables = [{
                name: "Examples", description: "",
                dataTable: [["value"], [firstRow], [secondRow]],
            } as RuleOutline["tables"][number]];
            const examples = [firstRow, secondRow].map((value, index) => {
                const example = new RuleExample(specification, outline);
                example.sequence = index + 1;
                example.title = `Rows ${value}`;
                example.example = { value };
                example.exampleRaw = { value };
                example.getRuleContext().attachJSON({ value }, value);
                example.getRuleContext().attachScreenshot("cG5n", value);
                example.getRuleContext().attach("dGVzdA==", { title: value });
                return example;
            });
            const exampleAttachments = examples.map(example => example.attachments);

            const failedTest = {
                type: "test", name: `Rule: ${failedTitle}`,
                meta: { livedoc: { kind: "rule", rule: {
                    title: failedTitle, description: "", tags: [], attachments: failedRule.attachments,
                } } },
                result: { state: "fail", duration: 1, errors: [{ message: "expected failure" }] },
            };
            const outlineTests = examples.map((example, index) => ({
                type: "test", name: `Example ${example.sequence}: ${example.title}`,
                meta: { livedoc: { kind: "ruleExample", ruleOutline: {
                    title: outline.title, description: "", tags: [], tables: outline.tables,
                    example: {
                        sequence: example.sequence, values: example.example, valuesRaw: example.exampleRaw,
                        attachments: example.attachments,
                    },
                } } },
                result: { state: index === 0 ? "pass" : "fail", duration: 1,
                    errors: index === 0 ? [] : [{ message: "example failure" }] },
            }));
            const task = {
                task: { filepath: specification.filename, tasks: [{
                    type: "suite", name: `Specification: ${specification.title}`,
                    tasks: [failedTest, {
                        type: "suite", name: `Rule Outline: ${outline.title}`, tasks: outlineTests,
                    }],
                }] },
            };
            const reconstructed = (new LiveDocSpecReporter({ detailLevel: "silent" }) as unknown as {
                buildExecutionResults(modules: unknown[]): {
                    specifications: Array<{ rules: Array<Rule | RuleOutline> }>;
                };
            }).buildExecutionResults([task]);
            const [reportedRule, reportedOutline] = reconstructed.specifications[0].rules;
            expect(reportedRule.status).toBe(SpecStatus.fail);
            expect(reportedRule.attachments).toEqual([failedAttachment]);
            expect(reportedOutline.attachments).toEqual([]);
            expect((reportedOutline as RuleOutline).examples.map(row => row.attachments)).toEqual(
                exampleAttachments,
            );

            const viewer = new LiveDocViewerReporter({ project: "vitest", silent: true });
            const run = viewer.buildTestRun(reconstructed as Parameters<typeof viewer.buildTestRun>[0]);
            expect(V1TestRunSchema.safeParse(run).success).toBe(true);
            const document = run.documents.find(doc => doc.kind === "Specification")!;
            const exportedRule = document.tests.find(test => test.kind === "Rule")!;
            const exportedOutline = document.tests.find(test => test.kind === "RuleOutline")!;
            expect(exportedRule.execution).toMatchObject({
                status: "failed", attachments: [failedAttachment],
            });
            expect(exportedOutline.execution.attachments).toBeUndefined();
            const rows = (exportedOutline as { exampleResults: Array<{ testId: string; result: {
                rowId: number; attachments?: Attachment[]; status: string;
            } }> }).exampleResults;
            expect(rows).toHaveLength(2);
            expect(rows.map(row => ({ testId: row.testId, result: row.result }))).toEqual([
                { testId: exportedOutline.id, result: expect.objectContaining({
                    rowId: 0, status: "passed", attachments: exampleAttachments[0],
                }) },
                { testId: exportedOutline.id, result: expect.objectContaining({
                    rowId: 1, status: "failed", attachments: exampleAttachments[1],
                }) },
            ]);

            const posted: TestCase[] = [];
            const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
                const path = String(input);
                if (path.endsWith("/start")) {
                    return { ok: true, json: async () => ({
                        protocolVersion: "1.0", runId: "evidence-run", websocketUrl: "",
                    }) } as Response;
                }
                if (path.endsWith("/testcases")) {
                    const payload = JSON.parse(String(init?.body));
                    expect(V1UpsertTestCaseRequestSchema.safeParse(payload).success).toBe(true);
                    posted.push(payload.testCase as TestCase);
                }
                return { ok: true, json: async () => ({}) } as Response;
            });
            try {
                await viewer.execute(reconstructed as Parameters<typeof viewer.execute>[0]);
            } finally {
                fetchMock.mockRestore();
            }
            const postedDocument = posted.find(doc => doc.kind === "Specification")!;
            expect(postedDocument.tests.find(test => test.kind === "Rule")?.execution.attachments).toEqual([failedAttachment]);
            expect((postedDocument.tests.find(test => test.kind === "RuleOutline") as typeof exportedOutline & {
                exampleResults: typeof rows;
            }).exampleResults.map(row => row.result.attachments)).toEqual(
                exampleAttachments,
            );
        },
    );

    rule("A real failed rule and failing example retain their evidence in TestRunV1 JSON", () => {
        const fixtures = resolve(process.cwd(), "_src/test/AttachingEvidence/fixtures");
        const output = resolve(fixtures, `attachment-export-${process.pid}-${Date.now()}.json`);
        const vitestCli = resolve(process.cwd(), "node_modules/vitest/vitest.mjs");
        expect(existsSync(output)).toBe(false);
        try {
            const run = spawnSync(process.execPath, [
                vitestCli, "run", "--config", resolve(fixtures, "rule-attachments.vitest.config.ts"),
            ], {
                cwd: process.cwd(), encoding: "utf8", timeout: 25_000,
                env: { ...process.env, LIVEDOC_RULE_EVIDENCE_OUTPUT: output },
            });
            expect(run.error).toBeUndefined();
            expect(run.status).toBe(1);
            expect(existsSync(output), run.stderr).toBe(true);
            const exported = JSON.parse(readFileSync(output, "utf8"));
            expect(V1TestRunSchema.safeParse(exported).success).toBe(true);
            const document = exported.documents.find((doc: TestCase) => doc.kind === "Specification");
            expect(document).toBeDefined();
            const reportedRule = document.tests.find((test: { kind: string; execution: { status: string } }) =>
                test.kind === "Rule" && test.execution.status === "passed");
            expect(reportedRule).toBeDefined();
            const reportedExecution = V1ExecutionResultSchema.safeParse(reportedRule.execution);
            expect(reportedExecution.success, reportedExecution.success ? undefined : reportedExecution.error.message).toBe(true);
            expect(reportedRule.execution.attachments[0]).toMatchObject({
                kind: "image", mimeType: "image/png", title: "Chart",
            });
            const failedRule = document.tests.find((test: { kind: string; execution: { status: string } }) =>
                test.kind === "Rule" && test.execution.status === "failed");
            expect(failedRule.execution.status).toBe("failed");
            expect(failedRule.execution.attachments[0].title).toBe("rule-failure");
            const outline = document.tests.find((test: { kind: string }) => test.kind === "RuleOutline");
            expect(outline.execution.attachments).toBeUndefined();
            expect(outline.exampleResults.map((entry: { result: { attachments: Attachment[] } }) =>
                entry.result.attachments[0].title)).toEqual(["first", "second"]);
            expect(outline.exampleResults.map((entry: { result: { attachments: Attachment[] } }) =>
                entry.result.attachments.map(attachment => attachment.kind))).toEqual([
                ["file", "screenshot", "file"],
                ["file", "screenshot", "file"],
            ]);
            expect(outline.exampleResults[0].result.attachments[0].id).not.toBe(
                outline.exampleResults[1].result.attachments[0].id,
            );
            expect(outline.exampleResults.map((entry: { result: { status: string } }) =>
                entry.result.status)).toEqual(["passed", "failed"]);
        } finally {
            rmSync(output, { force: true });
        }
    });
});

feature(`Step evidence remains step-scoped
    @attaching-evidence @attachments
    Rule attachment support must not change existing step behavior.
    `, () => {
    scenario("A step attaches 'dGVzdA==' with the default file metadata", () => {
        let evidence: Attachment[];
        given("the step begins without previous evidence", ctx => {
            expect(ctx.step!.attachments).toHaveLength(0);
        });
        when("attaching 'dGVzdA==' to the step", ctx => {
            ctx.step!.attach(ctx.step!.valuesRaw[0]);
            evidence = ctx.step!.attachments;
        });
        then("the step has '1' file attachment with mimeType 'application/octet-stream'", ctx => {
            expect(evidence).toHaveLength(ctx.step!.values[0]);
            expect(evidence[0]).toMatchObject({
                kind: "file", mimeType: ctx.step!.valuesRaw[1],
            });
        });
    });
});
