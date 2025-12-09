import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "_src/app/index.ts",
    "reporter/index": "_src/app/reporter/index.ts"
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["vitest"]
});
