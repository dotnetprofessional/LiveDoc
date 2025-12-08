import { LiveDoc } from "../app/livedoc";
import { test, expect } from "vitest";

test("Test executeDynamicTestAsync basic functionality", async () => {
    const featureText = `
        feature("Test Feature", () => {
            scenario("Test Scenario", () => {
                given("a test step", () => {
                    // Simple test
                });
            });
        });
    `;

    const results = await LiveDoc.executeDynamicTestAsync(featureText);
    
    expect(results).toBeDefined();
    expect(results.features).toBeDefined();
    expect(results.features.length).toBe(1);
    expect(results.features[0].title).toBe("Test Feature");
}, 30000); // 30 second timeout for subprocess
