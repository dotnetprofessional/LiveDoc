import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "_src/app/index.ts",
    "reporter/index": "_src/app/reporter/index.ts",
    setup: "_src/app/setup.ts",
    globals: "_src/app/globals.ts",
    "playwright/index": "_src/app/playwright/index.ts"
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["vitest", "playwright"],
  noExternal: ["@swedevtools/livedoc-schema"]
});
