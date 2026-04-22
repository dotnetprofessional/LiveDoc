/**
 * Central registry for features and suites
 * Note: These registries are populated during test execution but not used by the reporter.
 * The reporter reconstructs the model from Vitest's task tree to handle worker process boundaries.
 * These are kept for potential future use or alternative reporters.
 */
import * as model from "./model/index";

interface LiveDocGlobals {
    __livedocFeatures?: model.Feature[];
    __livedocSuites?: model.VitestSuite[];
}

const globals = globalThis as unknown as LiveDocGlobals;

// Initialize global registry on globalThis to share across all module instances
if (!globals.__livedocFeatures) {
    globals.__livedocFeatures = [];
}
if (!globals.__livedocSuites) {
    globals.__livedocSuites = [];
}

export const featureRegistry: model.Feature[] = globals.__livedocFeatures;
export const suiteRegistry: model.VitestSuite[] = globals.__livedocSuites;

export function clearRegistries(): void {
    featureRegistry.length = 0;
    suiteRegistry.length = 0;
}

export function getAllFeatures(): model.Feature[] {
    return featureRegistry;
}

export function getAllSuites(): model.VitestSuite[] {
    return suiteRegistry;
}
