import { expect } from "vitest";
import { ParserException, rule, specification } from "../../app/index";

specification(`Specification parser error handling
    @framework-internals @parser
    Internal parser errors should remain explicit so invalid specification
    structure fails loudly instead of being reported as a successful test.
    `, () => {
    rule("ParserException can be constructed with message 'Test error'", (ctx) => {
        const error = new ParserException(ctx.rule.valuesRaw[0], "test title", "");

        expect(error.message).toContain(ctx.rule.valuesRaw[0]);
    });

    rule("ParserException message contains 'Rule must be within a specification.'", (ctx) => {
        expect(() => {
            throw new ParserException(ctx.rule.valuesRaw[0], "test", "");
        }).toThrow(ctx.rule.valuesRaw[0]);
    });
});
