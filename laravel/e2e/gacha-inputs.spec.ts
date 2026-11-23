import { expect, test, type Page } from "@playwright/test";

// ガチャ天井計算機：入力欄・出し入れ・入力の確かめ（gacha-04）

const FIELDS = [
    { label: "最高レアの確率", unit: "%" },
    { label: "すり抜けの確率", unit: "%" },
    { label: "すり抜けが続いたら確定", unit: null },
    { label: "いま続いているすり抜け", unit: null },
    { label: "天井（最高レアが必ず出る回数）", unit: "回" },
    { label: "今のカウント（前の最高レアから引いた回数）", unit: "回" },
    { label: "ソフト天井の開始", unit: "回目" },
    { label: "ソフト天井で 1 回ごとに上がる確率", unit: "%" },
    { label: "狙いが確定するまであと何回", unit: "回" },
    { label: "1 回に使う石の数", unit: "個" },
    { label: "石 1 個の値段", unit: "円" },
    { label: "持っている石", unit: "個" },
    { label: "予算", unit: "円" },
] as const;

const INVALID = "赤い欄を直すと、結果が出ます";
const MISSING = "確率・石の数・値段を入れると、結果が出ます";

function field(page: Page, label: string) {
    return page.getByLabel(label, { exact: true });
}

function resultTable(page: Page) {
    return page.getByRole("table", { name: "狙いが手に入るまでの回数と金額" });
}

/** 欄が不正になり、aria-describedby の先にエラーの文が出て、結果の場所に「赤い欄を…」が出る */
async function expectInvalid(page: Page, label: string, text: string): Promise<void> {
    const input = field(page, label);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(INVALID, { exact: true })).toBeVisible();
    await expect(resultTable(page)).toBeHidden();
}

test.beforeEach(async ({ page }) => {
    await page.goto("/tools/gacha");
    await expect(resultTable(page)).toBeVisible();
});

test("13 の欄がラベルで取れ、選択以外は type=text で、単位が見える", async ({ page }) => {
    for (const { label, unit } of FIELDS) {
        const input = field(page, label);
        await expect(input, label).toHaveCount(1);
        if (unit === null) {
            await expect(input).toHaveJSProperty("tagName", "SELECT");
            continue;
        }
        // 隠れている欄は、天井を入れてから確かめる（最初は天井 100 なので全部見える）
        await expect(input, label).toBeVisible();
        await expect(input).toHaveAttribute("type", "text");
        await expect(input.locator("xpath=following-sibling::span[contains(@class, 'input-group-text')]"), label).toHaveText(unit);
    }
});

test("すり抜けの確定を「なし」にすると、いま続いているすり抜けが隠れ、戻すと見える", async ({ page }) => {
    const streak = field(page, "いま続いているすり抜け");
    await expect(streak).toBeVisible();
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "なし" });
    await expect(streak).toBeHidden();
    await field(page, "すり抜けが続いたら確定").selectOption({ label: "1 回" });
    await expect(streak).toBeVisible();
});

test("天井を空にすると、今のカウント・ソフト天井が隠れ、100 に戻すと見える", async ({ page }) => {
    const dependents = ["今のカウント（前の最高レアから引いた回数）", "ソフト天井の開始", "ソフト天井で 1 回ごとに上がる確率"];
    await field(page, "天井（最高レアが必ず出る回数）").fill("");
    for (const label of dependents) {
        await expect(field(page, label), label).toBeHidden();
    }
    await field(page, "天井（最高レアが必ず出る回数）").fill("100");
    for (const label of dependents) {
        await expect(field(page, label), label).toBeVisible();
    }
});

test("最高レアの確率が 0・101・abc・0.0001 なら不正、全角の「１」なら結果が出る", async ({ page }) => {
    for (const value of ["0", "101", "abc", "0.0001"]) {
        await field(page, "最高レアの確率").fill(value);
        await expectInvalid(page, "最高レアの確率", "0.01〜100 の数（小数第 3 位まで）を入れてください");
    }
    await field(page, "最高レアの確率").fill("１");
    await expect(resultTable(page)).toBeVisible();
    await expect(field(page, "最高レアの確率")).not.toHaveAttribute("aria-invalid", "true");
});

const CASES = [
    { label: "すり抜けの確率", value: "100", text: "0〜99 の数（小数第 3 位まで）を入れてください" },
    { label: "天井（最高レアが必ず出る回数）", value: "0", text: "1〜1,000 の整数を入れてください" },
    { label: "天井（最高レアが必ず出る回数）", value: "1.5", text: "1〜1,000 の整数を入れてください" },
    { label: "今のカウント（前の最高レアから引いた回数）", value: "100", text: "0〜99 の整数を入れてください" },
    { label: "ソフト天井の開始", value: "100", text: "2〜99 の整数を入れてください" },
    { label: "狙いが確定するまであと何回", value: "0", text: "1〜10,000 の整数を入れてください" },
    { label: "石 1 個の値段", value: "-1", text: "0.01〜10,000 の数（小数第 3 位まで）を入れてください" },
    { label: "石 1 個の値段", value: "1,000", text: "0.01〜10,000 の数（小数第 3 位まで）を入れてください" },
] as const;

for (const { label, value, text } of CASES) {
    test(`${label} に ${value} を入れると、その欄にエラーの文が出る`, async ({ page }) => {
        await field(page, label).fill(value);
        await expectInvalid(page, label, text);
    });
}

test("ソフト天井の開始だけ入れると、上がる確率の欄に「両方入れてください」", async ({ page }) => {
    await field(page, "ソフト天井の開始").fill("74");
    await expectInvalid(page, "ソフト天井で 1 回ごとに上がる確率", "ソフト天井の開始と上がる確率は、両方入れてください");
});

test("最高レアの確率を空にすると「確率・石の数・値段を…」が出て、欄は不正にならず、直すと結果が出る", async ({ page }) => {
    const rate = field(page, "最高レアの確率");
    await rate.fill("abc");
    await expect(page.getByText(INVALID, { exact: true })).toBeVisible();
    await rate.fill("");
    await expect(page.getByText(MISSING, { exact: true })).toBeVisible();
    await expect(rate).not.toHaveAttribute("aria-invalid", /.*/);
    await expect(resultTable(page)).toBeHidden();
    await expect(page.locator("#gacha-p-error")).toBeHidden();
    await rate.fill("1");
    await expect(resultTable(page)).toBeVisible();
    await expect(page.getByText(MISSING, { exact: true })).toBeHidden();
});
