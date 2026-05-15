import { expect } from "vitest";
import { specification, rule, ruleOutline } from "../../app/index";

type CalculatorOperation = "add" | "subtract" | "multiply";

function calculate(operation: CalculatorOperation, left: number, right: number) {
    switch (operation) {
        case "add":
            return left + right;
        case "subtract":
            return left - right;
        case "multiply":
            return left * right;
    }
}

function calculatorOperation(value: string): CalculatorOperation {
    if (value === "add" || value === "subtract" || value === "multiply") {
        return value;
    }

    throw new Error(`Unsupported calculator operation '${value}'.`);
}

specification(`First Specification: Calculator Rules
    @getting-started @specification @first-specification @public-doc
    A compact developer-facing example for testing a small API directly.
    Rules keep every input and expected output in the title or Examples table.
    `, () => {
    rule("Operation <operation:add> with <left:50> and <right:70> returns <total:120>", (ctx) => {
        const operation = calculatorOperation(ctx.rule.params.operation);
        const result = calculate(operation, ctx.rule.params.left, ctx.rule.params.right);

        expect(result).toBe(ctx.rule.params.total);
    });

    ruleOutline(`Operation <operation:add> returns the expected total
        @data-driven
        Examples:
        | left | right | total |
        |    5 |     3 |     8 |
        |   10 |    20 |    30 |
        `, (ctx) => {
        const operation = calculatorOperation(ctx.rule.params.operation);
        const result = calculate(operation, ctx.example.left, ctx.example.right);

        expect(result).toBe(ctx.example.total);
    });

    ruleOutline(`Operation <operation:subtract> returns the expected total
        @data-driven
        Examples:
        | left | right | total |
        |   10 |     4 |     6 |
        |    5 |    10 |    -5 |
        `, (ctx) => {
        const operation = calculatorOperation(ctx.rule.params.operation);
        const result = calculate(operation, ctx.example.left, ctx.example.right);

        expect(result).toBe(ctx.example.total);
    });

    ruleOutline(`Operation <operation:multiply> returns the expected total
        @data-driven
        Examples:
        | left | right | total |
        |   10 |     0 |     0 |
        |    5 |     5 |    25 |
        `, (ctx) => {
        const operation = calculatorOperation(ctx.rule.params.operation);
        const result = calculate(operation, ctx.example.left, ctx.example.right);

        expect(result).toBe(ctx.example.total);
    });
});
