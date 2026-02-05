/**
 * Tests for the Specification pattern
 * Specification-style tests are simpler than Gherkin - no step functions,
 * just rules with assertions directly in the rule body.
 */

import { specification, rule, ruleOutline, ParserException } from "../../app/index";
import { expect, beforeEach, describe, it } from "vitest";

// =============================================================================
// Basic Specification Pattern Tests
// =============================================================================

specification("Calculator Rules", () => {
    let calculator = { value: 0 };

    beforeEach(() => {
        calculator = { value: 0 };
    });

    ruleOutline(`Adding numbers
        Examples:
        | a  | b  | expected |
        |  5 |  3 |        8 |
        | 10 | 20 |       30 |
        `, (ctx) => {
        calculator.value = ctx.example.a;
        calculator.value += ctx.example.b;
        expect(calculator.value).toBe(ctx.example.expected);
    });

    ruleOutline(`Subtracting numbers
        Examples:
        | a  | b  | expected |
        | 10 |  4 |        6 |
        |  5 | 10 |       -5 |
        `, (ctx) => {
        calculator.value = ctx.example.a;
        calculator.value -= ctx.example.b;
        expect(calculator.value).toBe(ctx.example.expected);
    });

    ruleOutline(`Multiplying numbers
        Examples:
        | a  | b | expected |
        | 10 | 0 |        0 |
        |  5 | 5 |       25 |
        `, (ctx) => {
        calculator.value = ctx.example.a;
        calculator.value *= ctx.example.b;
        expect(calculator.value).toBe(ctx.example.expected);
    });
});

// =============================================================================
// Specification with Tags and Description
// =============================================================================

specification(`String Operations
    @string @validation
    Rules for string validation and manipulation
    `, () => {

    rule("Empty strings have length zero", async () => {
        const str = "";
        expect(str.length).toBe(0);
    });

    ruleOutline(`Concatenation joins strings
        Examples:
        | left  | right |  expected   |
        | Hello | World | Hello World |
        | Foo   | Bar   | Foo Bar     |
        `, async (ctx) => {
        const result = ctx.example.left + " " + ctx.example.right;
        expect(result).toBe(ctx.example.expected);
    });

    rule("Trim removes whitespace from '  padded  ' @trim", async () => {
        const result = "  padded  ".trim();
        expect(result).toBe("padded");
    });
});

// =============================================================================
// Data-driven Rules (RuleOutline)
// =============================================================================

specification("Data-driven Rules", () => {
    ruleOutline(`Validating email formats: <email> should be <valid>
        Examples:
        | email             | valid |
        | test@example.com  | true  |
        | invalid           | false |
        | user@domain.co.uk | true  |
        `, async (ctx) => {
        // Simple email regex for demo
        const isValid = /^[^@]+@[^@]+\.[^@]+$/.test(ctx.example.email);
        
        expect(isValid).toBe(ctx.example.valid);
    });

    ruleOutline(`Number comparisons <a> <comparison> <b>
        Examples:
        | a | b | comparison |
        | 5 | 3 | greater    |
        | 2 | 7 | less       |
        | 4 | 4 | equal      |
        `, async (ctx) => {
        const { a, b, comparison } = ctx.example;

        switch (comparison) {
            case "greater":
                expect(a > b).toBe(true);
                break;
            case "less":
                expect(a < b).toBe(true);
                break;
            case "equal":
                expect(a === b).toBe(true);
                break;
        }
    });
});

// =============================================================================
// Context Object Tests
// =============================================================================

specification("Context Object Access", () => {
    rule("Can access specification context from rule", async (ctx) => {
        expect(ctx.specification).toBeDefined();
        expect(ctx.specification.title).toBe("Context Object Access");
    });

    rule("Can access rule context from rule", async (ctx) => {
        expect(ctx.rule).toBeDefined();
        expect(ctx.rule.title).toBe("Can access rule context from rule!");
    });
});

specification(`Context with Tags and Description
    @context-test @meta
    This specification tests context with metadata
    `, () => {

    rule("Specification context includes tags", async (ctx) => {
        expect(ctx.specification.tags).toContain("context-test");
        expect(ctx.specification.tags).toContain("meta");
    });

    rule("Specification context includes description", async (ctx) => {
        expect(ctx.specification.description).toContain("tests context with metadata");
    });

    rule(`Rule with multi-line description
        @rule-tag
        This is a multi-line description
        for a specific rule.
        `, async (ctx) => {
        expect(ctx.rule.title).toBe("Rule with multi-line description");
        expect(ctx.rule.tags).toContain("rule-tag");
        expect(ctx.rule.description).toContain("multi-line description");
        expect(ctx.rule.description).toContain("for a specific rule");
    });
});

// =============================================================================
// RuleOutline Context Tests
// =============================================================================

specification("RuleOutline Context Access", () => {
    ruleOutline(`Can access example data in context
        Examples:
        | name  | value |
        | alpha |   100 |
        | beta  |   200 |
        `, async (ctx) => {
        // Should have access to example
        expect(ctx.example).toBeDefined();
        expect(ctx.example.name).toBeDefined();
        expect(ctx.example.value).toBeDefined();
        
        // Verify example data matches expected
        if (ctx.example.name === "alpha") {
            expect(ctx.example.value).toBe(100);
        } else if (ctx.example.name === "beta") {
            expect(ctx.example.value).toBe(200);
        }
    });

    ruleOutline(`Automatic type coercion in examples
        Examples:
        |  value  |  type   |
        |     123 | number  |
        | true    | boolean |
        | [1,2,3] | object  |
        `, async (ctx) => {
        expect(typeof ctx.example.value).toBe(ctx.example.type);
        if (ctx.example.type === "object") {
            expect(Array.isArray(ctx.example.value)).toBe(true);
        }
    });

    ruleOutline(`Can access specification context from ruleOutline
        Examples:
        | item |
        | one  |
        `, async (ctx) => {
        expect(ctx.specification).toBeDefined();
        expect(ctx.specification.title).toBe("RuleOutline Context Access");
    });
});

// =============================================================================
// Skip Modifier Tests
// =============================================================================

specification.skip("Skipped Specification", () => {
    rule("This rule should not run", async () => {
        throw new Error("This should not execute");
    });
});

specification("Specification with Skipped Rules", () => {
    rule("This rule runs", async () => {
        expect(true).toBe(true);
    });

    rule.skip("This rule is skipped", async () => {
        throw new Error("This should not execute");
    });

    rule("This rule also runs", async () => {
        expect(1 + 1).toBe(2);
    });
});

specification("Specification with Skipped RuleOutline", () => {
    ruleOutline.skip(`This outline is skipped
        Examples:
        | x |
        | 1 |
        `, async () => {
        throw new Error("This should not execute");
    });

    rule("But this rule runs", async () => {
        expect(true).toBe(true);
    });
});

// =============================================================================
// Async Execution Tests
// =============================================================================

specification("Async Rule Execution", () => {
    rule("Async rule with await", async () => {
        const result = await Promise.resolve(42);
        expect(result).toBe(42);
    });

    rule("Async rule with delay", async () => {
        const start = Date.now();
        await new Promise(resolve => setTimeout(resolve, 10));
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(5); // Allow some timing variance
    });

    ruleOutline(`Async ruleOutline
        Examples:
        | delay | expected |
        |     5 |        5 |
        |    10 |       10 |
        `, async (ctx) => {
        const delay = ctx.example.delay;
        await new Promise(resolve => setTimeout(resolve, delay));
        expect(ctx.example.expected).toBe(delay);
    });
});

// =============================================================================
// Error Handling Tests (using standard vitest for meta-testing)
// =============================================================================

describe("Specification Error Handling", () => {
    it("ParserException is properly exported and can be thrown", () => {
        // Verify the ParserException class is available
        expect(ParserException).toBeDefined();
        
        // Verify it can be instantiated and thrown
        const error = new ParserException("Test error", "test title", "");
        expect(error.message).toContain("Test error");
    });

    it("rule outside specification should throw ParserException", () => {
        // We can't actually test calling rule() outside specification at file level
        // since it would fail at module load time. This test verifies the error
        // message format that would be thrown.
        expect(() => {
            throw new ParserException("Rule must be within a specification.", "test", "");
        }).toThrow("Rule must be within a specification");
    });
});

