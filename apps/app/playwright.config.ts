import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

// Get the current directory (ES module compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the monorepo root (two levels up from apps/app)
const monorepoRoot = path.resolve(__dirname, "../..");

/**
 * E2E Test Configuration
 *
 * To run E2E tests:
 * 1. Start the dev server from the monorepo root: `npm run dev`
 * 2. Run tests: `npm run test:e2e`
 *
 * Or for CI, the webServer config will start the server automatically.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    process.env.CI ? ["github"] : ["list"],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    // For local development: start the server from monorepo root first, then run tests
    // The server will be reused if already running on port 3000
    command: "npx turbo run dev --filter=app",
    cwd: monorepoRoot,
    url: "http://localhost:3000",
    // Always try to reuse existing server first (reduces flakiness)
    reuseExistingServer: true,
    timeout: 120000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
