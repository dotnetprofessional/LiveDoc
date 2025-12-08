import { feature, scenario, background, Given, When, Then, And } from "../../app/livedoc";
const chai = require('chai');
chai.should();

/**
 * This test file verifies that afterBackground cleanup functions are properly
 * isolated between features. Each feature should have its own afterBackground
 * that doesn't interfere with other features in the same file.
 * 
 * Bug discovered: afterBackgroundFn is a module-level singleton, so when multiple
 * features register their afterBackground handlers during the test collection phase,
 * only the last one registered is retained. This causes Feature A to run Feature B's
 * cleanup code.
 */

// Feature A tracks its own cleanup
let featureACleanupCalled = false;
let featureAValue = 0;

feature(`Feature A with afterBackground
    This feature has its own afterBackground that should only run for its scenarios.
    `, () => {
    
    background("Feature A setup", (ctx) => {
        Given("Feature A sets up a value", () => {
            featureAValue = 100;
        });

        ctx.afterBackground(() => {
            // This cleanup should ONLY run for Feature A's scenarios
            featureACleanupCalled = true;
            featureAValue = 0;
        });
    });

    scenario("Feature A scenario verifies its own cleanup", () => {
        When("the scenario runs", () => {
            // Action step
        });

        Then("featureAValue equals 100", () => {
            featureAValue.should.be.equal(100);
        });

        And("the cleanup has not run yet during scenario execution", () => {
            // At this point, cleanup hasn't run yet (it runs after the scenario)
            featureAValue.should.be.equal(100);
        });
    });
});

// Feature B tracks its own cleanup
let featureBCleanupCalled = false;
let featureBValue = 0;

feature(`Feature B with afterBackground
    This feature has its own afterBackground that should only run for its scenarios.
    `, () => {
    
    background("Feature B setup", (ctx) => {
        Given("Feature B sets up a different value", () => {
            featureBValue = 200;
        });

        ctx.afterBackground(() => {
            // This cleanup should ONLY run for Feature B's scenarios
            featureBCleanupCalled = true;
            featureBValue = 0;
        });
    });

    scenario("Feature B scenario verifies its own cleanup", () => {
        When("the scenario runs", () => {
            // Action step
        });

        Then("featureBValue equals 200", () => {
            featureBValue.should.be.equal(200);
        });

        And("featureACleanupCalled should be true since Feature A's scenario already completed", () => {
            // Feature A's scenario ran before Feature B's scenario, so Feature A's cleanup already ran
            // This is expected behavior - each feature's afterBackground runs after its scenarios
            featureACleanupCalled.should.be.equal(true);
        });
    });
});

// Final verification feature that runs after both A and B
feature(`Feature C verifies afterBackground isolation
    This feature verifies that both Feature A and Feature B ran their own cleanup functions.
    `, () => {

    scenario("Both features should have run their own cleanup", () => {
        When("checking cleanup results", () => {
            // Action step
        });

        Then("featureACleanupCalled should be true", () => {
            featureACleanupCalled.should.be.equal(true);
        });

        And("featureBCleanupCalled should be true", () => {
            featureBCleanupCalled.should.be.equal(true);
        });

        And("featureAValue should equal 0 after cleanup", () => {
            featureAValue.should.be.equal(0);
        });

        And("featureBValue should equal 0 after cleanup", () => {
            featureBValue.should.be.equal(0);
        });
    });
});
