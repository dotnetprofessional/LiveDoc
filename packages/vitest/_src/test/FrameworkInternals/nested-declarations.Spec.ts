import { expect } from "vitest";
import { ParserException, ruleOutline, specification } from "../../app/index";
import { LiveDoc } from "../../app/livedoc";

type NestedDeclarationCase = {
    child: string;
    parent: string;
    phase: string;
    source: string;
};

const cases: NestedDeclarationCase[] = [
    {
        child: "feature",
        parent: "feature",
        phase: "collection",
        source: `
            feature("outer declaration", () => {
                feature("inner declaration", () => {});
            });
        `,
    },
    {
        child: "scenario",
        parent: "scenario",
        phase: "collection",
        source: `
            feature("containing feature", () => {
                scenario("outer declaration", () => {
                    scenario("inner declaration", () => {});
                });
            });
        `,
    },
    {
        child: "scenario outline",
        parent: "scenario outline",
        phase: "collection",
        source: `
            feature("containing feature", () => {
                scenarioOutline(\`outer declaration
                    Examples:
                    | value |
                    | one   |
                    \`, () => {
                    scenarioOutline(\`inner declaration
                        Examples:
                        | value |
                        | one   |
                        \`, () => {});
                });
            });
        `,
    },
    {
        child: "background",
        parent: "background",
        phase: "collection",
        source: `
            feature("containing feature", () => {
                background("outer declaration", () => {
                    background("inner declaration", () => {});
                });
            });
        `,
    },
    {
        child: "specification",
        parent: "specification",
        phase: "collection",
        source: `
            specification("outer declaration", () => {
                specification("inner declaration", () => {});
            });
        `,
    },
    {
        child: "rule",
        parent: "rule",
        phase: "runtime",
        source: `
            specification("containing specification", () => {
                rule("outer declaration", () => {
                    rule("inner declaration", () => {});
                });
            });
        `,
    },
    {
        child: "rule outline",
        parent: "rule outline",
        phase: "runtime",
        source: `
            specification("containing specification", () => {
                ruleOutline(\`outer declaration
                    Examples:
                    | value |
                    | one   |
                    \`, () => {
                    ruleOutline(\`inner declaration
                        Examples:
                        | value |
                        | one   |
                        \`, () => {});
                });
            });
        `,
    },
    {
        child: "scenario",
        parent: "given",
        phase: "runtime",
        source: `
            feature("containing feature", () => {
                scenario("containing scenario", () => {
                    given("outer declaration", () => {
                        scenario("inner declaration", () => {});
                    });
                });
            });
        `,
    },
];

function getCase(child: string, parent: string, phase: string): NestedDeclarationCase {
    const nestedCase = cases.find(
        candidate =>
            candidate.child === child &&
            candidate.parent === parent &&
            candidate.phase === phase
    );

    if (!nestedCase) {
        throw new Error(`Missing nested declaration case for ${child} within ${parent} during ${phase}`);
    }

    return nestedCase;
}

specification(`Invalid nested LiveDoc declarations
    @framework-internals @parser @dynamic
    Invalid declarations fail explicitly instead of being silently omitted from
    collection, execution, and reporting.
    `, () => {
    ruleOutline(`A nested '<child>' named 'inner declaration' within '<parent>' named 'outer declaration' fails during '<phase>'
        Examples:
        | child            | parent           | phase      |
        | feature          | feature          | collection |
        | scenario         | scenario         | collection |
        | scenario outline | scenario outline | collection |
        | background       | background       | collection |
        | specification    | specification    | collection |
        | rule             | rule             | runtime    |
        | rule outline     | rule outline     | runtime    |
        | scenario         | given            | runtime    |
        `, async (ctx) => {
        const child = String(ctx.example.child);
        const parent = String(ctx.example.parent);
        const phase = String(ctx.example.phase);
        const nestedCase = getCase(child, parent, phase);
        let parseException: ParserException | undefined;

        try {
            await LiveDoc.executeDynamicTestAsync(nestedCase.source);
        } catch (error) {
            parseException = error as ParserException;
        }

        expect(parseException).toBeInstanceOf(ParserException);
        expect(parseException?.title).toBe("inner declaration");
        expect(parseException?.description.toLowerCase()).toContain(child);
        expect(parseException?.description.toLowerCase()).toContain(parent);
        expect(parseException?.description).toContain("inner declaration");
        expect(parseException?.description).toContain("outer declaration");
    });
});
