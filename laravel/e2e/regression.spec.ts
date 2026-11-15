import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

// サイト全体の回帰テスト：どのページも開けて、エラーが出ず、横にはみ出さないこと
for (const { path, footer } of PAGES) {
    test(`${path} を開ける`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
        // CSP の違反もコンソールのエラーとして出る
        page.on("console", (message) => {
            if (message.type() === "error") {
                errors.push(`console: ${message.text()}`);
            }
        });

        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        // フッターから、プライバシーポリシーにたどれる（h1 のないページもあるため、共通の部分で確かめる）
        if (footer) {
            await expect(page.locator('footer a[href$="/privacy"]')).toBeVisible();
        }
        await expect(page).toHaveTitle(/てくてくテック/);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, "横にはみ出している").toBeLessThanOrEqual(0);
        expect(errors).toEqual([]);
    });
}

test("ないページは 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
});
