import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "src/controllers/**/*.ts",
        "src/services/**/*.ts",
        "src/middleware/**/*.ts",
        "src/processors/**/*.ts",
        "src/utils/**/*.ts",
      ],
      exclude: ["src/__tests__/**", "src/config/**", "src/types/**"],
    },
    testTimeout: 10000,
  },
});
