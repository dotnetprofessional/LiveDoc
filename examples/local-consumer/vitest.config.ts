import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.Spec.ts"],
    globals: false,
    environment: "node"
  }
});
