require('chai').should();

import { V1TestRunSchema } from "@swedevtools/livedoc-schema";
import { expect, vi } from "vitest";
import { feature, given, scenario, Then as then, when } from "../../app/livedoc";
import { ExecutionResults, SpecStatus } from "../../app/model/index";
import { LiveDocGrammarParser } from "../../app/parser/Parser";
import { DefaultColorTheme } from "../../app/reporter/ColorTheme";
import { LiveDocReporterOptions, LiveDocSpec } from "../../app/reporter/LiveDocSpec";
import LiveDocSpecReporter from "../../app/reporter/LiveDocSpecReporter";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";

class TestableLiveDocSpec extends LiveDocSpec {
    public configure(options: LiveDocReporterOptions): void {
        this.setOptions(options);
    }
}

function parseTagsLine(tagsLine: string): string[] {
    return tagsLine
        .split(/\s+/)
        .map(tag => tag.trim().replace(/^@/, ""))
        .filter(tag => tag.length > 0);
}

feature("Specification tags render and serialize", () => {
    scenario("Rendering tags for specification documentation includes slash tags", () => {
        let results: ExecutionResults;
        let renderedOutput = "";

        given(
            "a Specification named 'Tagged Specification' with tags '@specification @name/name', a Rule named 'Tagged Rule' with tags '@rule @name/name', and a RuleOutline named 'Tagged Outline' with tags '@outline @name/name'",
            (ctx) => {
                const [
                    specificationTitle,
                    specificationTags,
                    ruleTitle,
                    ruleTags,
                    ruleOutlineTitle,
                    ruleOutlineTags,
                ] = ctx.step.values.map(String);

                const parser = new LiveDocGrammarParser();
                const specification = parser.createSpecification(
                    `${specificationTitle}\n${specificationTags}\nSpecification description`,
                    "D:\\repo\\specifications\\TaggedSpecification.Spec.ts"
                );

                const rule = parser.addRule(
                    specification,
                    `${ruleTitle}\n${ruleTags}\nRule description`
                );
                rule.setStatus(SpecStatus.pass, 1);

                const ruleOutline = parser.addRuleOutline(
                    specification,
                    `${ruleOutlineTitle}\n${ruleOutlineTags}\nRule outline description
                    Examples:
                    | value |
                    | one   |`
                );
                for (const example of ruleOutline.examples) {
                    example.setStatus(SpecStatus.pass, 1);
                }
                ruleOutline.status = SpecStatus.pass;

                results = new ExecutionResults();
                results.specifications = [specification];
            }
        );

        when("rendering specification details with the LiveDoc spec reporter", async () => {
            const lines: string[] = [];
            const consoleLog = vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
                lines.push(String(message ?? ""));
            });

            try {
                const renderer = new TestableLiveDocSpec(DefaultColorTheme, false);
                const options = new LiveDocReporterOptions();
                options.spec = true;
                renderer.configure(options);

                await renderer.executionEnd(results);
            } finally {
                consoleLog.mockRestore();
            }

            renderedOutput = lines.join("\n");
        });

        then("the rendered output includes tag lines '@specification @name/name', '@rule @name/name', and '@outline @name/name'", (ctx) => {
            for (const expectedTagLine of ctx.step.values.map(String)) {
                expect(renderedOutput).toContain(expectedTagLine);
            }
        });
    });

    scenario("Serializing specification tags preserves slash tags in viewer payloads", () => {
        let testRun: ReturnType<LiveDocViewerReporter["buildTestRun"]>;

        given(
            "a Vitest Specification task named 'Tagged Specification' with tags '@specification @name/name', a Rule named 'Tagged Rule' with tags '@rule @name/name', and a RuleOutline named 'Tagged Outline' with tags '@outline @name/name'",
            (ctx) => {
                const [
                    specificationTitle,
                    specificationTags,
                    ruleTitle,
                    ruleTags,
                    ruleOutlineTitle,
                    ruleOutlineTags,
                ] = ctx.step.values.map(String);

                const specTask = {
                    type: "suite",
                    name: `Specification: ${specificationTitle}\n${specificationTags}\nSpecification description`,
                    tasks: [
                        {
                            type: "test",
                            name: `Rule: ${ruleTitle}\n${ruleTags}\nRule description`,
                            meta: {
                                livedoc: {
                                    kind: "rule",
                                    rule: {
                                        title: ruleTitle,
                                        description: "Rule description",
                                        tags: parseTagsLine(ruleTags),
                                    },
                                },
                            },
                            result: { state: "pass", duration: 1 },
                        },
                        {
                            type: "suite",
                            name: `Rule Outline: ${ruleOutlineTitle}`,
                            tasks: [
                                {
                                    type: "test",
                                    name: `Example 1: ${ruleOutlineTitle}`,
                                    meta: {
                                        livedoc: {
                                            kind: "ruleExample",
                                            ruleOutline: {
                                                title: ruleOutlineTitle,
                                                description: "Rule outline description",
                                                tags: parseTagsLine(ruleOutlineTags),
                                                tables: [
                                                    {
                                                        name: "",
                                                        description: "",
                                                        dataTable: [
                                                            ["value"],
                                                            ["one"],
                                                        ],
                                                    },
                                                ],
                                                example: {
                                                    sequence: 1,
                                                    values: { value: "one" },
                                                    valuesRaw: { value: "one" },
                                                },
                                            },
                                        },
                                    },
                                    result: { state: "pass", duration: 1 },
                                },
                            ],
                        },
                    ],
                };

                const reporter = new LiveDocSpecReporter({ detailLevel: "silent" });
                const results = (reporter as unknown as { buildExecutionResults(testModules: readonly unknown[]): ExecutionResults })
                    .buildExecutionResults([
                        {
                            task: {
                                filepath: "D:\\repo\\specifications\\TaggedSpecification.Spec.ts",
                                tasks: [specTask],
                            },
                        },
                    ]);

                const viewerReporter = new LiveDocViewerReporter({
                    project: "vitest",
                    environment: "local",
                    silent: true,
                });
                testRun = viewerReporter.buildTestRun(results);
            }
        );

        when("validating the serialized TestRunV1 against V1TestRunSchema", () => {
            const parsed = V1TestRunSchema.safeParse(testRun);
            if (!parsed.success) {
                throw new Error(`Invalid TestRunV1 payload: ${JSON.stringify(parsed.error.format(), null, 2)}`);
            }
        });

        then(
            "the serialized Specification has tags 'specification,name/name', Rule has tags 'rule,name/name', and RuleOutline has tags 'outline,name/name'",
            (ctx) => {
                const [expectedSpecificationTags, expectedRuleTags, expectedRuleOutlineTags] = ctx.step.values
                    .map(value => String(value).split(","));

                const specification = testRun.documents.find(document => document.kind === "Specification");
                expect(specification).toBeTruthy();
                expect(specification?.tags).toEqual(expectedSpecificationTags);

                const rule = specification?.tests.find(test => test.kind === "Rule");
                expect(rule).toBeTruthy();
                expect(rule?.tags).toEqual(expectedRuleTags);

                const ruleOutline = specification?.tests.find(test => test.kind === "RuleOutline");
                expect(ruleOutline).toBeTruthy();
                expect(ruleOutline?.tags).toEqual(expectedRuleOutlineTags);
            }
        );
    });
});
