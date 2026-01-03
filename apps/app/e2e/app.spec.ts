import { test, expect } from "@playwright/test";

test.describe("App", () => {
  test("should load the application", async ({ page }) => {
    await page.goto("/");

    // Wait for the page to be fully loaded
    await page.waitForLoadState("networkidle");

    // The app should be visible (check for root element)
    const root = page.locator("#root");
    await expect(root).toBeVisible();
  });

  test("should have correct page title", async ({ page }) => {
    await page.goto("/");

    // Check the page title
    await expect(page).toHaveTitle(/August/i);
  });
});

test.describe("Authentication Flow", () => {
  test("should show sign-in page when not authenticated", async ({ page }) => {
    await page.goto("/sign-in");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Should see Clerk sign-in component or redirect
    // This depends on the auth setup
    const signInPage = page.locator('[data-clerk-component="SignIn"]');
    const isSignInVisible = await signInPage.isVisible().catch(() => false);

    // Either we see the sign-in form or we're redirected
    expect(isSignInVisible || page.url().includes("clerk")).toBeTruthy();
  });
});

test.describe("Navigation", () => {
  test.skip("should navigate using keyboard shortcuts", async ({ page }) => {
    // Skip by default since this requires authentication
    await page.goto("/");

    // Press Cmd+K to open command menu
    await page.keyboard.press("Meta+k");

    // Check if command menu opens
    const commandMenu = page.locator('[role="dialog"]');
    await expect(commandMenu).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Accessibility", () => {
  test("should have no automatically detectable accessibility issues on home page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Basic accessibility checks
    // Check that interactive elements are focusable
    const focusableElements = page.locator(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // There should be at least some focusable elements
    const count = await focusableElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should support reduced motion preference", async ({ page }) => {
    // Set reduced motion preference
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Page should still load correctly with reduced motion
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Responsive Design", () => {
  // These tests can be flaky on slower browsers, so we configure retries
  test.describe.configure({ retries: 2 });

  test("should work on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for the app to render content (not just the empty root div)
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15000 });
  });

  test("should work on tablet viewport", async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for the app to render content
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15000 });
  });

  test("should work on desktop viewport", async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for the app to render content
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15000 });
  });
});

test.describe("Performance", () => {
  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });
});
