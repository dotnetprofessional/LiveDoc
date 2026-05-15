import { V1TestRunSchema } from "@swedevtools/livedoc-schema";
import { expect, vi } from "vitest";
import { specification, rule } from "../../app/livedoc";
import { ExecutionResults, SpecStatus } from "../../app/model/index";
import { LiveDocGrammarParser } from "../../app/parser/Parser";
import { DefaultColorTheme } from "../../app/reporter/ColorTheme";
import { LiveDocReporterOptions, LiveDocSpec } from "../../app/reporter/LiveDocSpec";
import { LiveDocViewerReporter } from "../../app/reporter/LiveDocViewerReporter";

class TestableLiveDocSpec extends LiveDocSpec {
    public configure(options: LiveDocReporterOptions): void {
        this.setOptions(options);
    }
}

interface TaggedSpecificationInput {
    specificationTitle: string;
    specificationTagsLine: string;
    ruleTitle: string;
    ruleTagsLine: string;
    ruleOutlineTitle: string;
    ruleOutlineTagsLine: string;
}

function readTaggedSpecificationInput(values: unknown[]): TaggedSpecificationInput {
    const [
        specificationTitle,
        specificationTagsLine,
        ruleTitle,
        ruleTagsLine,
        ruleOutlineTitle,
        ruleOutlineTagsLine,
    ] = values.map(String);

    return {
        specificationTitle,
        specificationTagsLine,
        ruleTitle,
        ruleTagsLine,
        ruleOutlineTitle,
        ruleOutlineTagsLine,
    };
}

function createTaggedSpecificationResults(input: TaggedSpecificationInput): ExecutionResults {
    const parser = new LiveDocGrammarParser();
    const specification = parser.createSpecification(
        [
            input.specificationTitle,
            input.specificationTagsLine,
            "Specification description",
        ].join("\n"),
        "D:\\repo\\specifications\\TaggedSpecification.Spec.ts"
    );

    const taggedRule = parser.addRule(
        specification,
        [
            input.ruleTitle,
            input.ruleTagsLine,
            "Rule description",
        ].join("\n")
    );
    taggedRule.setStatus(SpecStatus.pass, 1);

    const taggedRuleOutline = parser.addRuleOutline(
        specification,
        [
            input.ruleOutlineTitle,
            input.ruleOutlineTagsLine,
            "Rule outline description",
            "Examples:",
            "| value |",
            "| one   |",
        ].join("\n")
    );
    for (const example of taggedRuleOutline.examples) {
        example.setStatus(SpecStatus.pass, 1);
    }
    taggedRuleOutline.status = SpecStatus.pass;

    const results = new ExecutionResults();
    results.specifications = [specification];
    return results;
}

async function renderSpecificationOutput(results: ExecutionResults): Promise<string> {
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

    return lines.join("\n");
}

function serializeForV1Viewer(results: ExecutionResults): ReturnType<LiveDocViewerReporter["buildTestRun"]> {
    const viewerReporter = new LiveDocViewerReporter({
        project: "vitest",
        environment: "local",
        silent: true,
    });

    return viewerReporter.buildTestRun(results);
}

specification(`Specification tags in reporting output
    @reporting-output @specification-tags
    Specification DSL tags must remain visible in console details and V1 viewer payloads.
    `, () => {
    rule(
        "Rendering Specification 'Tagged Specification' with tags '@specification @name/name', Rule 'Tagged Rule' with tags '@rule @name/name', and RuleOutline 'Tagged Outline' with tags '@outline @name/name' includes all three tag lines",
        async (ctx) => {
            const input = readTaggedSpecificationInput(ctx.rule.values);
            const expectedTagLines = [
                input.specificationTagsLine,
                input.ruleTagsLine,
                input.ruleOutlineTagsLine,
            ];
            const results = createTaggedSpecificationResults(input);

            const renderedOutput = await renderSpecificationOutput(results);

            for (const expectedTagLine of expectedTagLines) {
                expect(renderedOutput).toContain(expectedTagLine);
            }
        }
    );

    rule(
        "V1 viewer serialization of Specification 'Tagged Specification' with tags '@specification @name/name', Rule 'Tagged Rule' with tags '@rule @name/name', and RuleOutline 'Tagged Outline' with tags '@outline @name/name' passes V1TestRunSchema and stores tags 'specification,name/name', 'rule,name/name', and 'outline,name/name'",
        (ctx) => {
            const input = readTaggedSpecificationInput(ctx.rule.values);
            const [
                expectedSpecificationTags,
                expectedRuleTags,
                expectedRuleOutlineTags,
            ] = ctx.rule.values.slice(6).map(value => String(value).split(","));
            const results = createTaggedSpecificationResults(input);

            const testRun = serializeForV1Viewer(results);
            const parsed = V1TestRunSchema.safeParse(testRun);
            if (!parsed.success) {
                throw new Error(`Invalid TestRunV1 payload: ${JSON.stringify(parsed.error.format(), null, 2)}`);
            }

            const specificationDocument = testRun.documents.find(document => document.kind === "Specification");
            expect(specificationDocument).toBeTruthy();
            expect(specificationDocument?.tags).toEqual(expectedSpecificationTags);

            const ruleTest = specificationDocument?.tests.find(test => test.kind === "Rule");
            expect(ruleTest).toBeTruthy();
            expect(ruleTest?.tags).toEqual(expectedRuleTags);

            const ruleOutlineTest = specificationDocument?.tests.find(test => test.kind === "RuleOutline");
            expect(ruleOutlineTest).toBeTruthy();
            expect(ruleOutlineTest?.tags).toEqual(expectedRuleOutlineTags);
        }
    );
});
