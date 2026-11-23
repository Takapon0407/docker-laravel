import { expect, test, type Page } from "@playwright/test";

// ガチャ天井計算機：PC 幅（desktop）とスマホ幅（mobile）で崩れず、操作してもエラーが出ない（gacha-07）

function field(page: Page, label: string) {
    return page.getByLabel(label, { exact: true });
}

function resultTable(page: Page) {
    return page.getByRole("table", { name: "狙いが手に入るまでの回数と金額" });
}

async function expectNoOverflow(page: Page, when: string): Promise<void> {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${when}：横にはみ出している`).toBeLessThanOrEqual(0);
}

/** main の中の見えている input・select・button の高さがすべて 44px 以上 */
async function expectTallControls(page: Page, when: string): Promise<void> {
    const controls = page.locator("main").locator("input, select, button");
    expect(await controls.count(), "main の中に入力欄がない").toBeGreaterThan(0);
    const heights = await controls.evaluateAll((elements) =>
        elements
            .filter((element) => (element as HTMLElement).offsetParent !== null)
            .map((element) => ({ id: element.id, height: element.getBoundingClientRect().height })),
    );
    expect(heights.length).toBeGreaterThan(0);
    for (const { id, height } of heights) {
        expect(height, `${when}：#${id} の高さ`).toBeGreaterThanOrEqual(44);
    }
}

test("開いた直後と、桁の多い入力の結果で、横にはみ出さず、入力欄が 44px 以上", async ({ page }) => {
    await page.goto("/tools/gacha");
    await expect(resultTable(page)).toBeVisible();
    await expectNoOverflow(page, "開いた直後");
    await expectTallControls(page, "開いた直後");

    // 例 L2 ＋ 石 10000・値段 10000・予算 100000000
    await field(page, "最高レアの確率").fill("0.01");
    await field(page, "すり抜けの確率").fill("99");
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "5 回" });
    await field(page, "天井（最高レアが必ず出る回数）").fill("1000");
    await field(page, "1 回に使う石の数").fill("10000");
    await field(page, "石 1 個の値段").fill("10000");
    await field(page, "予算").fill("100000000");
    const maxRow = resultTable(page).locator("tbody tr").last().locator("td");
    await expect(maxRow).toHaveText(["6,000 回", "60,000,000 個", "600,000,000,000 円"], { timeout: 10_000 });
    await expect(page.getByText(/^100,000,000 円で 1 回引けます。/)).toBeVisible();
    await expectNoOverflow(page, "桁の多い入力");
    await expectTallControls(page, "桁の多い入力");
});

test("例 A・E・不正な値・例 K・予算を順に入れても、エラーが出ない", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    // CSP の違反もコンソールのエラーとして出る
    page.on("console", (message) => {
        if (message.type() === "error") {
            errors.push(`console: ${message.text()}`);
        }
    });
    await page.goto("/tools/gacha");
    await expect(resultTable(page)).toBeVisible();

    // 例 A
    await field(page, "最高レアの確率").fill("1");
    await field(page, "すり抜けの確率").fill("");
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "なし" });
    await field(page, "天井（最高レアが必ず出る回数）").fill("");
    await field(page, "1 回に使う石の数").fill("160");
    await field(page, "石 1 個の値段").fill("1");
    await expect(resultTable(page).locator("tbody td").first()).toHaveText("100.0 回");

    // 例 E
    await field(page, "最高レアの確率").fill("0.6");
    await field(page, "すり抜けの確率").fill("50");
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "1 回" });
    await field(page, "天井（最高レアが必ず出る回数）").fill("90");
    await field(page, "ソフト天井の開始").fill("74");
    await field(page, "ソフト天井で 1 回ごとに上がる確率").fill("6");
    await expect(resultTable(page).locator("tbody td").first()).toHaveText("93.4 回");

    await field(page, "最高レアの確率").fill("abc");
    await expect(page.getByText("赤い欄を直すと、結果が出ます", { exact: true })).toBeVisible();

    // 例 K
    await field(page, "最高レアの確率").fill("0.01");
    await field(page, "すり抜けの確率").fill("99");
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "なし" });
    await field(page, "天井（最高レアが必ず出る回数）").fill("");
    await expect(page.getByText(/^回数が多すぎて計算できません。/)).toBeVisible({ timeout: 10_000 });

    // 予算（例 A に戻して）
    await field(page, "最高レアの確率").fill("1");
    await field(page, "すり抜けの確率").fill("");
    await field(page, "予算").fill("16000");
    await expect(page.getByText(/^16,000 円で 100 回引けます。/)).toBeVisible();

    expect(errors).toEqual([]);
});
