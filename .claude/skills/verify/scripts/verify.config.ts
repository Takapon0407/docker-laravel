import { defineConfig, devices } from "@playwright/test";

// Copied next to the journey by drive.sh. Same viewports as laravel/playwright.config.ts.
const evidence = process.env.VERIFY_EVIDENCE ?? "evidence";

export default defineConfig({
    testDir: ".",
    testMatch: "journey.spec.ts",
    outputDir: `${evidence}/playwright`,
    forbidOnly: true,
    retries: 0,
    reporter: [["list"]],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost",
        screenshot: "on",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
        { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true } },
    ],
});
