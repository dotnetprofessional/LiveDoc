const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const {
    isOutlineExamplesTable,
    shouldUseRowHeaders
} = require("../tableFormatter/formatter");

describe("table header orientation", () => {
    it("forces ScenarioOutline Examples tables to use column headers", () => {
        const source = `scenarioOutline(\`Shipping
            Examples:
            `;

        assert.equal(isOutlineExamplesTable(source), true);
        assert.equal(
            shouldUseRowHeaders([
                ["country", "rate"],
                ["Australia", "Domestic"]
            ], true),
            false
        );
    });

    it("preserves row headers for ordinary two-column entity tables", () => {
        assert.equal(
            shouldUseRowHeaders([
                ["debug", "true"],
                ["timeout", "5000"]
            ], false),
            true
        );
    });

    it("treats quoted JSON strings as column header text", () => {
        assert.equal(
            shouldUseRowHeaders([
                ['"Name"', '"Value"'],
                ["1", "Alice"]
            ], false),
            false
        );
    });

    it("does not classify unrelated Examples text as an outline table", () => {
        assert.equal(isOutlineExamplesTable("const label = `Examples:\\n"), false);
    });
});
