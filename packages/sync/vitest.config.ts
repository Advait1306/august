import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**"],
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/__tests__/**",
        "**/*.test.ts",
        "**/vitest.config.ts",
        "**/drizzle.config.ts",
      ],
    },
  },
});
