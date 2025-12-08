import { feature, scenarioOutline, given, when, Then as then } from "../app/livedoc";

feature("Scenario Outline data binding verification", () => {
    const results: Array<{ weight: number; energy: number; protein: number }> = [];

    scenarioOutline(`Data table values are properly bound

        Examples:
            | weight | energy | protein |
            |    100 |   5000 |      50 |
            |    200 |  10000 |     100 |
            |    300 |  15000 |     150 |
        `, (ctx) => {

        given("the weight is <weight>", (ctx) => {
            const weight = ctx.example?.weight;
            if (!weight) {
                throw new Error("Weight not found in example context");
            }
            results.push({
                weight,
                energy: ctx.example?.energy || 0,
                protein: ctx.example?.protein || 0
            });
        });

        when("we process the data", (ctx) => {
            // Processing step
        });

        then("all values should be numbers", (ctx) => {
            const lastResult = results[results.length - 1];
            if (typeof lastResult.weight !== 'number') {
                throw new Error(`Weight should be number but got ${typeof lastResult.weight}`);
            }
            if (typeof lastResult.energy !== 'number') {
                throw new Error(`Energy should be number but got ${typeof lastResult.energy}`);
            }
            if (typeof lastResult.protein !== 'number') {
                throw new Error(`Protein should be number but got ${typeof lastResult.protein}`);
            }
        });
    });

    scenarioOutline(`Step titles should have placeholders replaced

        Examples:
            | name  | age |
            | Alice |  25 |
            | Bob   |  30 |
        `, (ctx) => {

        given("the person <name> is <age> years old", (ctx) => {
            // Verify title has values replaced
            if (ctx.step?.title.includes("<name>") || ctx.step?.title.includes("<age>")) {
                throw new Error(`Step title should not contain placeholders: ${ctx.step?.title}`);
            }
            
            // Verify the actual values are in the title
            const name = ctx.example?.name;
            const age = ctx.example?.age;
            
            if (name && !ctx.step?.title.includes(name)) {
                throw new Error(`Step title should contain name "${name}": ${ctx.step?.title}`);
            }
            
            if (age && !ctx.step?.title.includes(String(age))) {
                throw new Error(`Step title should contain age "${age}": ${ctx.step?.title}`);
            }
        });

        when("we check the title", (ctx) => {
            // Title checking happens in given
        });

        then("the title should be valid", (ctx) => {
            // All validation done in given
        });
    });
});
