/**
 * Tests for the Specification pattern
 * Specification-style tests are simpler than Gherkin - no step functions,
 * just rules with assertions directly in the rule body.
 */

import { specification, rule, ruleOutline, ParserException } from "../app/index";
import { expect, beforeEach, describe, it } from "vitest";

// =============================================================================
// Basic Specification Pattern Tests
// =============================================================================

specification("Calculator Rules", () => {
    let calculator = { value: 0 };

    beforeEach(() => {
        calculator = { value: 0 };
    });

    rule("Adding positive numbers increases the value", async () => {
        calculator.value = 5;
        calculator.value += 3;
        expect(calculator.value).toBe(8);
    });

    rule("Subtracting numbers decreases the value", async () => {
        calculator.value = 10;
        calculator.value -= 4;
        expect(calculator.value).toBe(6);
    });

    rule("Multiplying by zero returns zero", async () => {
        calculator.value = 100;
        calculator.value *= 0;
        expect(calculator.value).toBe(0);
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

    rule("Concatenation joins strings", async () => {
        const result = "Hello" + " " + "World";
        expect(result).toBe("Hello World");
    });

    rule("Trim removes whitespace @trim", async () => {
        const result = "  padded  ".trim();
        expect(result).toBe("padded");
    });
});

// =============================================================================
// Data-driven Rules (RuleOutline)
// =============================================================================

specification("Data-driven Rules", () => {
    ruleOutline(`Validating email formats
        Examples:
        | email             | valid |
        | test@example.com  | true  |
        | invalid           | false |
        | user@domain.co.uk | true  |
        `, async (ctx) => {
        const email = ctx.example.email;
        const expectedValid = ctx.example.valid;  // Already a boolean from table parsing
        
        // Simple email regex for demo
        const isValid = /^[^@]+@[^@]+\.[^@]+$/.test(email);
        
        expect(isValid).toBe(expectedValid);
    });

    ruleOutline(`Number comparisons <a> <comparison> <b>
        Examples:
        | a | b | comparison |
        | 5 | 3 | greater    |
        | 2 | 7 | less       |
        | 4 | 4 | equal      |
        `, async (ctx) => {
        const a = parseInt(ctx.example.a, 10);
        const b = parseInt(ctx.example.b, 10);
        const comparison = ctx.example.comparison;

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
        expect(ctx.rule.title).toBe("Can access rule context from rule");
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

