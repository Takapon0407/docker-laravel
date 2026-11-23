import { expect, test, type Page } from "@playwright/test";

// ガチャ天井計算機：結果の表のすぐ上に、平均の一文を role=status で出す（gacha-08）

function field(page: Page, label: string) {
    return page.getByLabel(label, { exact: true });
}

function resultTable(page: Page) {
    return page.getByRole("table", { name: "狙いが手に入るまでの回数と金額" });
}

test.beforeEach(async ({ page }) => {
    await page.goto("/tools/gacha");
});

test("開いた直後、表のすぐ上の role=status に平均の一文がある", async ({ page }) => {
    const status = page.getByRole("status").filter({ hasText: /^平均 / });
    await expect(status).toHaveText("平均 95.1 回（9,510 円）で手に入ります。");
    // すぐ上：次の要素が結果の表（またはそれを包む要素）
    const nextHoldsTable = await status.evaluate((element) => {
        const next = element.nextElementSibling;
        return next !== null && (next.tagName === "TABLE" || next.querySelector(":scope > table") !== null);
    });
    expect(nextHoldsTable, "平均の一文のすぐ下が結果の表でない").toBe(true);
    await expect(resultTable(page)).toBeVisible();
});

test("例 A を入れると、平均の一文が変わる", async ({ page }) => {
    await field(page, "最高レアの確率").fill("1");
    await field(page, "すり抜けの確率").fill("");
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "なし" });
    await field(page, "天井（最高レアが必ず出る回数）").fill("");
    await field(page, "1 回に使う石の数").fill("160");
    await field(page, "石 1 個の値段").fill("1");
    await expect(page.getByRole("status").filter({ hasText: /^平均 / })).toHaveText("平均 100.0 回（16,000 円）で手に入ります。");
});

test("結果の表とグラフ（とその祖先）に aria-live がない", async ({ page }) => {
    await expect(resultTable(page)).toBeVisible();
    const hasLive = (selector: string) =>
        page.locator(selector).evaluate((element) => {
            for (let node: Element | null = element; node !== null; node = node.parentElement) {
                if (node.hasAttribute("aria-live") || ["status", "alert", "log"].includes(node.getAttribute("role") ?? "")) {
                    return true;
                }
            }
            return false;
        });
    expect(await hasLive("#gacha-result table")).toBe(false);
    expect(await hasLive('#gacha-result svg[role="img"]')).toBe(false);
});
