import { defineConfig } from "vitest/config";
import { LiveDocServerReporter } from "@livedoc/vitest/reporter";

export default defineConfig({
  test: {
    include: ["test/**/*.Spec.ts"],
    globals: false,
    environment: "node",
    reporters: [new LiveDocServerReporter()]
  }
});
