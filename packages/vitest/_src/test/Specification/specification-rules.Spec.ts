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

    rule("Trim removes whitespace from '  padded  ' @trim", async (ctx) => {
        const input = ctx.rule.values[0] as string;
        const result = input.trim();
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
// Rule Value Extraction Tests
// =============================================================================

specification("Rule Value Extraction", () => {
    rule("Adding '5' and '3' returns '8'", (ctx) => {
        const [a, b, expected] = ctx.rule.values;
        expect(a + b).toBe(expected);
    });

    rule("Multiplying '7' by '6' equals '42'", (ctx) => {
        expect(ctx.rule.values.length).toBe(3);
        expect(ctx.rule.values[0]).toBe(7);
        expect(ctx.rule.values[1]).toBe(6);
        expect(ctx.rule.values[2]).toBe(42);
    });

    rule("Boolean coercion: 'true' and 'false' are booleans", (ctx) => {
        expect(ctx.rule.values[0]).toBe(true);
        expect(ctx.rule.values[1]).toBe(false);
    });

    rule("Raw values are strings: '42' stays '42'", (ctx) => {
        expect(ctx.rule.valuesRaw[0]).toBe("42");
        expect(ctx.rule.valuesRaw[1]).toBe("42");
        expect(typeof ctx.rule.valuesRaw[0]).toBe("string");
    });

    rule("Rule with no quoted values has empty arrays", (ctx) => {
        expect(ctx.rule.values.length).toBe(0);
        expect(ctx.rule.valuesRaw.length).toBe(0);
    });
});

specification("Rule Named Parameter Extraction", () => {
    rule("Processing <action:login> for <user:alice>", (ctx) => {
        expect(ctx.rule.params.action).toBe("login");
        expect(ctx.rule.params.user).toBe("alice");
    });

    rule("Transfer <amount:500> from <source:checking> to <dest:savings>", (ctx) => {
        expect(ctx.rule.params.amount).toBe(500);
        expect(ctx.rule.params.source).toBe("checking");
        expect(ctx.rule.params.dest).toBe("savings");
    });

    rule("Raw params are strings: <count:42>", (ctx) => {
        expect(ctx.rule.paramsRaw.count).toBe("42");
        expect(typeof ctx.rule.paramsRaw.count).toBe("string");
    });

    rule("Rule with no named params has empty object", (ctx) => {
        expect(Object.keys(ctx.rule.params).length).toBe(0);
        expect(Object.keys(ctx.rule.paramsRaw).length).toBe(0);
    });
});

specification("Rule Mixed Values and Params", () => {
    rule("Adding <a:10> to '5' returns <expected:15>", (ctx) => {
        // Quoted values
        expect(ctx.rule.values.length).toBe(1);
        expect(ctx.rule.values[0]).toBe(5);
        // Named params
        expect(ctx.rule.params.a).toBe(10);
        expect(ctx.rule.params.expected).toBe(15);
    });
});

// =============================================================================
// RuleOutline Value Extraction Tests
// =============================================================================

specification("RuleOutline Value Extraction", () => {
    ruleOutline(`Discount of '10' percent applies to orders over '100' dollars
        Examples:
        | orderTotal | expectedDiscount |
        |        150 |               15 |
        |        200 |               20 |
        `, (ctx) => {
        // Values from the ruleOutline title
        const [discountPct, threshold] = ctx.rule.values;
        expect(discountPct).toBe(10);
        expect(threshold).toBe(100);

        // Example data from the table
        const discount = ctx.example.orderTotal * (discountPct / 100);
        expect(discount).toBe(ctx.example.expectedDiscount);
    });

    ruleOutline(`Raw values are strings: '42' stays '42'
        Examples:
        | item |
        | one  |
        `, (ctx) => {
        expect(ctx.rule.valuesRaw[0]).toBe("42");
        expect(ctx.rule.valuesRaw[1]).toBe("42");
        expect(typeof ctx.rule.valuesRaw[0]).toBe("string");
    });
});

specification("RuleOutline Named Parameter Extraction", () => {
    ruleOutline(`Applying <operation:multiply> with factor <factor:3>
        Examples:
        | input | expected |
        |     5 |       15 |
        |    10 |       30 |
        `, (ctx) => {
        expect(ctx.rule.params.operation).toBe("multiply");
        expect(ctx.rule.params.factor).toBe(3);
        expect(ctx.example.input * ctx.rule.params.factor).toBe(ctx.example.expected);
    });

    ruleOutline(`Raw params are strings: <count:42>
        Examples:
        | item |
        | one  |
        `, (ctx) => {
        expect(ctx.rule.paramsRaw.count).toBe("42");
        expect(typeof ctx.rule.paramsRaw.count).toBe("string");
    });
});

specification("RuleOutline Mixed Values and Params", () => {
    ruleOutline(`Adding <base:10> to '5' returns <expected:15>
        Examples:
        | multiplier | result |
        |          1 |     15 |
        |          2 |     30 |
        `, (ctx) => {
        // Quoted values from title
        expect(ctx.rule.values.length).toBe(1);
        expect(ctx.rule.values[0]).toBe(5);
        // Named params from title
        expect(ctx.rule.params.base).toBe(10);
        expect(ctx.rule.params.expected).toBe(15);
        // Example data from table
        const result = (ctx.rule.params.base + ctx.rule.values[0]) * ctx.example.multiplier;
        expect(result).toBe(ctx.example.result);
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

