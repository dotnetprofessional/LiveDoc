/**
 * Fresh Context Per Scenario
 *
 * Integration test for the freshContextPerScenario option in useBrowser().
 * When enabled, each scenario gets an isolated BrowserContext — localStorage,
 * cookies, and session state do NOT leak between scenarios.
 *
 * Prerequisites: Playwright installed and a web server running on port 3100
 *   ./scripts/start-viewer.ps1
 *
 * @tags playwright, integration, isolation, freshContext
 */

import { feature, scenario, given, when, Then as then, and } from "../../app/livedoc";
import { useBrowser } from "../../app/playwright/index";
import { expect } from "vitest";

const VIEWER_URL = "http://localhost:3100";

const { page, context, baseUrl } = useBrowser({
    baseUrl: VIEWER_URL,
    browser: "chromium",
    launch: { headless: true },
    freshContextPerScenario: true,
});

feature(`Fresh Browser Context Per Scenario
    @playwright @isolation @freshContext
    When freshContextPerScenario is enabled, useBrowser() creates a new
    BrowserContext (and Page) for each scenario. This guarantees that
    localStorage, cookies, and other browser state from one scenario
    cannot leak into another — essential for test isolation.
    `, () => {

    // =====================================================================
    // Context Isolation — localStorage
    // =====================================================================

    scenario("Scenario 1 sets localStorage and it is available within the same scenario", () => {
        given("the viewer is loaded at the base URL", async () => {
            await page().goto(baseUrl, { waitUntil: "networkidle" });
        });

        when("localStorage key 'test-isolation' is set to 'scenario-1-value'", async (ctx) => {
            await page().evaluate((key: string) => {
                localStorage.setItem(key, "scenario-1-value");
            }, ctx.step.valuesRaw[0]);
        });

        then("localStorage key 'test-isolation' should contain 'scenario-1-value'", async (ctx) => {
            const value = await page().evaluate((key: string) => localStorage.getItem(key), ctx.step.valuesRaw[0]);
            expect(value).toBe(ctx.step.valuesRaw[1]);
        });
    });

    scenario("Scenario 2 gets a fresh context with empty localStorage", () => {
        given("the viewer is loaded at the base URL in a fresh context", async () => {
            await page().goto(baseUrl, { waitUntil: "networkidle" });
        });

        then("localStorage key 'test-isolation' should be null (not carried over)", async (ctx) => {
            const value = await page().evaluate((key: string) => localStorage.getItem(key), ctx.step.valuesRaw[0]);
            expect(value).toBeNull();
        });
    });

    // =====================================================================
    // Context Isolation — Cookies
    // =====================================================================

    scenario("Scenario 3 sets a cookie and it is available within the same scenario", () => {
        given("the viewer is loaded at the base URL", async () => {
            await page().goto(baseUrl, { waitUntil: "networkidle" });
        });

        when("a cookie named 'test-cookie' is set with value 'scenario-3'", async (ctx) => {
            await page().evaluate(([name, val]: string[]) => {
                document.cookie = `${name}=${val}; path=/`;
            }, [ctx.step.valuesRaw[0], ctx.step.valuesRaw[1]]);
        });

        then("the cookie 'test-cookie' should contain 'scenario-3'", async (ctx) => {
            const cookies = await page().evaluate(() => document.cookie);
            expect(cookies).toContain(`${ctx.step.valuesRaw[0]}=${ctx.step.valuesRaw[1]}`);
        });
    });

    scenario("Scenario 4 gets a fresh context with no cookies from previous scenarios", () => {
        given("the viewer is loaded at the base URL in a fresh context", async () => {
            await page().goto(baseUrl, { waitUntil: "networkidle" });
        });

        then("the cookie 'test-cookie' should not exist", async (ctx) => {
            const cookies = await page().evaluate(() => document.cookie);
            expect(cookies).not.toContain(ctx.step.valuesRaw[0]);
        });
    });

    // =====================================================================
    // Each Scenario Gets a Valid Page
    // =====================================================================

    scenario("Each fresh context provides a working page object", () => {
        when("checking the page object in this scenario", () => {
            const p = page();
            expect(p).toBeDefined();
            expect(typeof p.goto).toBe("function");
        });

        then("the context object should also be valid", () => {
            const c = context();
            expect(c).toBeDefined();
            expect(typeof c.newPage).toBe("function");
        });
    });

    // =====================================================================
    // Session Storage Isolation
    // =====================================================================

    scenario("Scenario 6 sets sessionStorage and it exists within the scenario", () => {
        given("the viewer is loaded at the base URL", async () => {
            await page().goto(baseUrl, { waitUntil: "networkidle" });
        });

        when("sessionStorage key 'session-test' is set to 'session-value'", async (ctx) => {
            await page().evaluate((key: string) => {
                sessionStorage.setItem(key, "session-value");
            }, ctx.step.valuesRaw[0]);
        });

        then("sessionStorage key 'session-test' should contain 'session-value'", async (ctx) => {
            const value = await page().evaluate((key: string) => sessionStorage.getItem(key), ctx.step.valuesRaw[0]);
            expect(value).toBe(ctx.step.valuesRaw[1]);
        });
    });

    scenario("Scenario 7 gets a fresh context with empty sessionStorage", () => {
        given("the viewer is loaded at the base URL in a fresh context", async () => {
            await page().goto(baseUrl, { waitUntil: "networkidle" });
        });

        then("sessionStorage key 'session-test' should be null (not carried over)", async (ctx) => {
            const value = await page().evaluate((key: string) => sessionStorage.getItem(key), ctx.step.valuesRaw[0]);
            expect(value).toBeNull();
        });
    });
});
