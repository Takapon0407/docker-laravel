import { expect, test } from "@playwright/test";

// ガチャ天井計算機：JavaScript がないときの案内（gacha-03）
test.describe("JavaScript なし", () => {
    test.use({ javaScriptEnabled: false });

    test("「このツールは JavaScript を使います。」が見える", async ({ page }) => {
        await page.goto("/tools/gacha");
        // getByText は <noscript> の中の文を探さないため、要素を指して文を確かめる
        await expect(page.locator("noscript p", { hasText: "このツールは JavaScript を使います。" })).toBeVisible();
    });
});
