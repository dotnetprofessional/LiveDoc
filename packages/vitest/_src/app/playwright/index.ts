/**
 * @swedevtools/livedoc-vitest/playwright
 *
 * Playwright integration for LiveDoc — browser lifecycle management
 * and screenshot helpers for BDD feature specs.
 *
 * @example
 * ```typescript
 * import { feature, scenario, given, when, then } from '@swedevtools/livedoc-vitest';
 * import { useBrowser, screenshot } from '@swedevtools/livedoc-vitest/playwright';
 *
 * const { page, baseUrl } = useBrowser({ baseUrl: 'http://localhost:5174' });
 *
 * feature('Checkout Flow', () => {
 *     scenario('User adds item to cart', () => {
 *         given("user views the product page", async (ctx) => {
 *             await page().goto(`${baseUrl}/products/1`);
 *             await screenshot(page(), ctx);
 *         });
 *     });
 * });
 * ```
 */

import { beforeAll, afterAll } from "vitest";
// IMPORTANT: Import from the package's own name so that at runtime the
// playwright entry point shares the SAME module instance (and therefore
// the same scenarioStartHooks / scenarioEndHooks arrays) as the main
// entry point.  tsup marks this as external so it is NOT inlined.
import { onScenarioStart, onScenarioEnd } from "@swedevtools/livedoc-vitest";
import type { StepContext } from "@swedevtools/livedoc-vitest";

// ─── Minimal Playwright interfaces ──────────────────────────────────
// We define minimal shapes here to avoid a compile-time dependency on
// the `playwright` package. Users get full types from their own install.

/** Minimal Page interface — the real Playwright Page has many more methods */
export interface PlaywrightPage {
    screenshot(options?: { fullPage?: boolean }): Promise<Buffer>;
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
    close(): Promise<void>;
    [key: string]: unknown;
}

/** Minimal BrowserContext interface */
export interface PlaywrightBrowserContext {
    newPage(): Promise<PlaywrightPage>;
    close(): Promise<void>;
    [key: string]: unknown;
}

/** Minimal Browser interface */
export interface PlaywrightBrowser {
    newContext(options?: Record<string, unknown>): Promise<PlaywrightBrowserContext>;
    close(): Promise<void>;
    [key: string]: unknown;
}

// ─── Fail-fast peer dependency check ─────────────────────────────────

let playwrightModule: Record<string, unknown>;
let playwrightLoaded = false;

async function ensurePlaywright(): Promise<Record<string, unknown>> {
    if (playwrightLoaded) return playwrightModule;
    try {
        // Use variable to prevent TypeScript DTS from resolving the module
        const moduleName = "playwright";
        playwrightModule = await import(/* @vite-ignore */ moduleName);
        playwrightLoaded = true;
        return playwrightModule;
    } catch {
        throw new Error(
            "@swedevtools/livedoc-vitest/playwright requires 'playwright' as a peer dependency.\n" +
                "Install it with:\n\n" +
                "  pnpm add -D playwright\n" +
                "  npx playwright install chromium\n"
        );
    }
}

// ─── Types ───────────────────────────────────────────────────────────

/** Browser engine to use */
export type BrowserName = "chromium" | "firefox" | "webkit";

/** Options for useBrowser() / usePlaywright() */
export interface PlaywrightOptions {
    /** Base URL for navigation (default: 'http://localhost:3000') */
    baseUrl?: string;

    /** Browser engine (default: 'chromium') */
    browser?: BrowserName;

    /** Options passed directly to browser.launch() */
    launch?: Record<string, unknown>;

    /** Options passed directly to browser.newContext() */
    context?: Record<string, unknown>;

    /** Create a fresh BrowserContext for each scenario (default: false) */
    freshContextPerScenario?: boolean;
}

/** Return type of useBrowser() */
export interface PlaywrightFixture {
    /** Get the current Page instance (call inside steps, not at module scope) */
    page: () => PlaywrightPage;

    /** Get the current BrowserContext */
    context: () => PlaywrightBrowserContext;

    /** Get the Browser instance */
    browser: () => PlaywrightBrowser;

    /** Configured base URL */
    baseUrl: string;
}

/** Options for the screenshot() helper */
export interface ScreenshotOptions {
    /** Override auto-generated screenshot name */
    name?: string;

    /** Capture full page scroll height (default: true) */
    fullPage?: boolean;
}

// ─── Screenshot Helper ───────────────────────────────────────────────

/** Auto-incrementing counter per step for unique screenshot names */
let _screenshotIndex = 0;

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/['"`]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Capture a screenshot and attach it to the current LiveDoc step.
 *
 * Auto-generates a descriptive filename from the step title if no name is provided.
 *
 * @example
 * ```typescript
 * // Auto-named from step title
 * await screenshot(page(), ctx);
 *
 * // Custom name
 * await screenshot(page(), ctx, { name: 'login-form' });
 * ```
 */
export async function screenshot(
    page: PlaywrightPage,
    ctx: { step: StepContext },
    options?: ScreenshotOptions
): Promise<void> {
    const fullPage = options?.fullPage ?? true;

    const buffer = await page.screenshot({ fullPage });
    const base64 = buffer.toString("base64");

    const name = options?.name ?? `${slugify(ctx.step.title)}-${++_screenshotIndex}`;
    ctx.step.attachScreenshot(base64, name);
}

// ─── Browser Lifecycle ───────────────────────────────────────────────

/**
 * Initialize Playwright browser lifecycle for a feature file.
 *
 * Call at **module scope** (outside `feature()` block) to get feature-level
 * browser sharing. The browser launches once and is shared across all
 * scenarios in the file.
 *
 * @example
 * ```typescript
 * import { useBrowser, screenshot } from '@swedevtools/livedoc-vitest/playwright';
 *
 * const { page, baseUrl } = useBrowser({
 *     baseUrl: 'http://localhost:5174',
 *     browser: 'chromium',
 *     launch: { headless: process.env.CI === 'true' },
 * });
 *
 * feature('My Feature', () => {
 *     scenario('My Scenario', () => {
 *         given("I open the app", async (ctx) => {
 *             await page().goto(baseUrl);
 *             await screenshot(page(), ctx);
 *         });
 *     });
 * });
 * ```
 */
export function useBrowser(options?: PlaywrightOptions): PlaywrightFixture {
    const baseUrl = options?.baseUrl ?? "http://localhost:3000";
    const browserName: BrowserName = options?.browser ?? "chromium";
    const freshContext = options?.freshContextPerScenario ?? false;

    let _browser: PlaywrightBrowser | undefined;
    let _context: PlaywrightBrowserContext | undefined;
    let _page: PlaywrightPage | undefined;

    beforeAll(async () => {
        const pw = await ensurePlaywright();
        const launcher = pw[browserName] as { launch: (opts?: Record<string, unknown>) => Promise<PlaywrightBrowser> };
        _browser = await launcher.launch(options?.launch ?? { headless: true });

        if (!freshContext) {
            // Shared context: one context + page for all scenarios
            _context = await _browser.newContext(options?.context ?? {});
            _page = await _context.newPage();
        }

        // Reset screenshot counter per feature file
        _screenshotIndex = 0;
    });

    if (freshContext) {
        onScenarioStart(async () => {
            // Fresh context + page per scenario — isolates localStorage, cookies, etc.
            _context = await _browser!.newContext(options?.context ?? {});
            _page = await _context.newPage();
        });

        onScenarioEnd(async () => {
            await _context?.close().catch(() => {});
            _page = undefined;
            _context = undefined;
        });
    }

    afterAll(async () => {
        try {
            // Closing browser closes all contexts and pages beneath it
            await _browser?.close();
        } catch {
            // Ignore close errors (already closed, crashed, etc.)
        } finally {
            _page = undefined;
            _context = undefined;
            _browser = undefined;
        }
    });

    return {
        page: () => {
            if (!_page) {
                throw new Error(
                    "Playwright page is not initialized. " +
                        "Ensure useBrowser() is called at module scope and page() is called inside a step."
                );
            }
            return _page;
        },
        context: () => {
            if (!_context) {
                throw new Error("Playwright context is not initialized.");
            }
            return _context;
        },
        browser: () => {
            if (!_browser) {
                throw new Error("Playwright browser is not initialized.");
            }
            return _browser;
        },
        baseUrl,
    };
}

/** Alias for useBrowser() */
export const usePlaywright = useBrowser;
