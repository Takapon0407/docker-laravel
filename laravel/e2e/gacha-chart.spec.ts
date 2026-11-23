import { expect, test, type Page } from "@playwright/test";

// ガチャ天井計算機：予算で手に入る確率の文と、回数ごとの確率のグラフ（gacha-06）

function field(page: Page, label: string) {
    return page.getByLabel(label, { exact: true });
}

/** 例 A（最高レア 1%・ほかは空欄・確定なし）に、石 160・値段 1 */
async function enterExampleA(page: Page): Promise<void> {
    await field(page, "最高レアの確率").fill("1");
    await field(page, "すり抜けの確率").fill("");
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "なし" });
    await field(page, "天井（最高レアが必ず出る回数）").fill("");
    await field(page, "1 回に使う石の数").fill("160");
    await field(page, "石 1 個の値段").fill("1");
}

test.beforeEach(async ({ page }) => {
    await page.goto("/tools/gacha");
});

test("予算を入れると手に入る確率の文が出て、空にすると消える", async ({ page }) => {
    const sentence = "16,000 円で 100 回引けます。狙いが手に入る確率は 63.3% です。";
    await enterExampleA(page);
    await field(page, "予算").fill("16000");
    await expect(page.getByText(sentence, { exact: true })).toBeVisible();
    await field(page, "予算").fill("");
    await expect(page.getByText(sentence, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/円で .* 回引けます。/)).toHaveCount(0);
});

test("例 A のグラフ：表の下にあり、ラベルと軸の文字が決まりどおり", async ({ page }) => {
    await enterExampleA(page);
    const svg = page.locator('#gacha-result svg[role="img"]');
    await expect(svg).toHaveAttribute("aria-label", "回数ごとの、狙いが手に入る確率のグラフ（459 回で 99.0%）");
    await expect(svg).toBeVisible();
    for (const text of ["0 回", "459 回", "0%", "50%", "100%"]) {
        await expect(svg.locator("text", { hasText: new RegExp(`^${text}$`) }), text).toHaveCount(1);
    }
    // 結果の表の下にある
    const tableBox = await page.getByRole("table", { name: "狙いが手に入るまでの回数と金額" }).boundingBox();
    const svgBox = await svg.boundingBox();
    expect(svgBox!.y).toBeGreaterThan(tableBox!.y + tableBox!.height - 1);
});

test("開いた直後（最初の値）のグラフは「200 回で 100%」", async ({ page }) => {
    await expect(page.locator('#gacha-result svg[role="img"]')).toHaveAttribute("aria-label", "回数ごとの、狙いが手に入る確率のグラフ（200 回で 100%）");
});

test("最高レアの確率を abc にすると、グラフと予算の文が隠れる", async ({ page }) => {
    await field(page, "予算").fill("16000");
    const svg = page.locator('svg[role="img"][aria-label^="回数ごとの"]');
    const sentence = page.getByText(/円で .* 回引けます。/);
    await expect(svg).toBeVisible();
    await expect(sentence).toBeVisible();
    await field(page, "最高レアの確率").fill("abc");
    await expect(svg).toBeHidden();
    await expect(sentence).toBeHidden();
});

test("グラフに style 属性がなく、CSP の違反などのエラーが出ない", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(message.text());
        }
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.reload();
    const svg = page.locator('#gacha-result svg[role="img"]');
    await expect(svg).toBeVisible();
    await enterExampleA(page);
    await expect(svg).toHaveAttribute("aria-label", /459 回/);
    expect(await svg.evaluate((element) => [element, ...element.querySelectorAll("*")].filter((node) => node.hasAttribute("style")).length)).toBe(0);
    expect(errors).toEqual([]);
});
