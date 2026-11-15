import { defineConfig, devices } from "@playwright/test";

// ブラウザで人と同じように操作して確かめる E2E（e2e/*.spec.ts）
// 開くのは docker compose で起動しているローカルのサイト（harness/init.sh で起動を確かめる）
export default defineConfig({
    testDir: "e2e",
    fullyParallel: true,
    forbidOnly: true,
    retries: 0,
    reporter: [["list"]],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
        // スマホ幅（CLAUDE.md の「PC 幅とスマホ幅」）
        { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true } },
    ],
});
