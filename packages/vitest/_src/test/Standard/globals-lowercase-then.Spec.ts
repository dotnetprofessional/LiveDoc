/**
 * Test to verify that lowercase 'then' works correctly when using globals mode.
 * This test file intentionally does NOT import anything - it relies entirely on globals.
 */

// Note: No imports! All keywords are globals registered by setup.ts

feature("Globals mode supports lowercase then", () => {
    scenario("Using then as a global", () => {
        let value: number;

        given("a value of 10", () => {
            value = 10;
        });

        when("I double it", () => {
            value = value * 2;
        });

        // Using the global lowercase 'then' (registered by setup.ts)
        then("the result is 20", () => {
            if (value !== 20) {
                throw new Error(`Expected 20 but got ${value}`);
            }
        });

        and("it is greater than 10", () => {
            if (value <= 10) {
                throw new Error(`Expected value > 10 but got ${value}`);
            }
        });
    });
});
