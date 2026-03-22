import { defineConfig } from "vitest/config";
import { LiveDocSpecReporter } from "@swedevtools/livedoc-vitest/reporter";

export default defineConfig({
  test: {
    include: ["test/**/*.Spec.ts"],
    globals: false,
    environment: "node",
    reporters: [new LiveDocSpecReporter()]
  }
});
