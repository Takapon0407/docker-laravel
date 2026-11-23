import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// ガチャ天井計算機（features/gacha.md）：最初の値 → 例 A → 予算 → 不正な値 → 重い入力
const evidence = process.env.VERIFY_EVIDENCE ?? ".";

function field(page: Page, label: string) {
    return page.getByLabel(label, { exact: true });
}

async function proof(page: Page, name: string) {
    const project = test.info().project.name;
    await page.screenshot({ path: `${evidence}/gacha-${name}-${project}.png`, fullPage: true });
    writeFileSync(`${evidence}/gacha-${name}-${project}.aria.txt`, await page.locator("main").ariaSnapshot());
}

test("ガチャ天井計算機：入力すると、回数・石・金額の表と確率の文・グラフが変わる", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });

    await page.goto("/tools/gacha");
    const table = page.getByRole("table", { name: "狙いが手に入るまでの回数と金額" });
    const avg = table.getByRole("row", { name: /^平均/ });
    await expect(page.getByRole("status").filter({ hasText: /^平均 / })).toHaveText("平均 95.1 回（9,510 円）で手に入ります。");
    await expect(avg).toContainText("95.1 回");
    await proof(page, "initial");

    // 例 A
    await field(page, "最高レアの確率").fill("1");
    await field(page, "すり抜けの確率").fill("");
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "なし" });
    await field(page, "天井（最高レアが必ず出る回数）").fill("");
    await field(page, "1 回に使う石の数").fill("160");
    await field(page, "石 1 個の値段").fill("1");
    await expect(avg).toContainText("100.0 回");
    await expect(avg).toContainText("16,000 円");
    await field(page, "予算").fill("16000");
    await expect(page.getByText("16,000 円で 100 回引けます。狙いが手に入る確率は 63.3% です。")).toBeVisible();
    await expect(page.getByRole("img", { name: "回数ごとの、狙いが手に入る確率のグラフ（459 回で 99.0%）" })).toBeVisible();
    await proof(page, "example-a");

    // 不正な値
    await field(page, "最高レアの確率").fill("abc");
    await expect(field(page, "最高レアの確率")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("赤い欄を直すと、結果が出ます")).toBeVisible();
    await expect(table).toBeHidden();
    await proof(page, "invalid");

    // 重い入力（例 K）：固まらずに文が出る
    await field(page, "最高レアの確率").fill("0.01");
    await field(page, "すり抜けの確率").fill("99");
    await expect(page.getByText("回数が多すぎて計算できません。", { exact: false })).toBeVisible({ timeout: 10_000 });
    await proof(page, "too-many");

    expect(errors).toEqual([]);
});
