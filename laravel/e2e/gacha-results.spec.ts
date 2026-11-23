import { expect, test, type Page } from "@playwright/test";

// ガチャ天井計算機：Worker で計算した結果の表・注意書き・保存しないこと（gacha-05）

const TOO_MANY = "回数が多すぎて計算できません。すり抜けの確定か、狙いが確定するまでの回数を入れてください。";

function field(page: Page, label: string) {
    return page.getByLabel(label, { exact: true });
}

function resultTable(page: Page) {
    return page.getByRole("table", { name: "狙いが手に入るまでの回数と金額" });
}

/** 行の見出し（平均・50%・…）の行の、回数・石・金額のセル */
function rowCells(page: Page, label: string) {
    return resultTable(page)
        .locator("tbody tr")
        .filter({ has: page.locator("th", { hasText: new RegExp(`^${label}$`) }) })
        .locator("td");
}

/** 回数の列（平均・50%・90%・99%・最大） */
function drawsColumn(page: Page) {
    return resultTable(page).locator("tbody tr td:nth-of-type(1)");
}

interface Inputs {
    p?: string;
    q?: string;
    k?: string;
    s0?: string;
    n?: string;
    c0?: string;
    softStart?: string;
    softStep?: string;
    m?: string;
    stones?: string;
    price?: string;
    owned?: string;
    budget?: string;
}

const LABELS: Record<keyof Inputs, string> = {
    p: "最高レアの確率",
    q: "すり抜けの確率",
    k: "すり抜けが続いたら確定",
    s0: "いま続いているすり抜け",
    n: "天井（最高レアが必ず出る回数）",
    c0: "今のカウント（前の最高レアから引いた回数）",
    softStart: "ソフト天井の開始",
    softStep: "ソフト天井で 1 回ごとに上がる確率",
    m: "狙いが確定するまであと何回",
    stones: "1 回に使う石の数",
    price: "石 1 個の値段",
    owned: "持っている石",
    budget: "予算",
};

/** 入力を入れる（天井を先に入れて、隠れている欄を出す） */
async function enter(page: Page, inputs: Inputs): Promise<void> {
    const order: (keyof Inputs)[] = ["p", "q", "k", "n", "s0", "c0", "softStart", "softStep", "m", "stones", "price", "owned", "budget"];
    for (const key of order) {
        const value = inputs[key];
        if (value === undefined) {
            continue;
        }
        if (key === "k" || key === "s0") {
            await field(page, LABELS[key]).selectOption({ label: value });
        } else {
            await field(page, LABELS[key]).fill(value);
        }
    }
}

const EXAMPLE_A: Inputs = { p: "1", q: "", k: "なし", n: "", stones: "160", price: "1" };
const EXAMPLE_E: Inputs = { p: "0.6", q: "50", k: "1 回", n: "90", softStart: "74", softStep: "6" };
const EXAMPLE_K: Inputs = { p: "0.01", q: "99", k: "なし", n: "" };

test.beforeEach(async ({ page }) => {
    await page.goto("/tools/gacha");
});

test("開いた直後に、見出し付きの結果の表が出る（例 J）", async ({ page }) => {
    const table = resultTable(page);
    await expect(table).toBeVisible();
    await expect(table.locator("caption")).toHaveText("狙いが手に入るまでの回数と金額");
    await expect(table.locator('th[scope="row"]')).toHaveText(["平均", "50%", "90%", "99%", "最大"]);
    await expect(table.locator('th[scope="col"]')).toHaveText(["回数", "石", "金額"]);
    await expect(rowCells(page, "平均")).toHaveText(["95.1 回", "9,510 個", "9,510 円"]);
    await expect(rowCells(page, "最大")).toHaveText(["200 回", "20,000 個", "20,000 円"]);
});

test("例 A を入れると、ボタンを押さずに表が変わり、持っている石を金額から引く", async ({ page }) => {
    await expect(rowCells(page, "平均")).toHaveText(["95.1 回", "9,510 個", "9,510 円"]);
    await enter(page, EXAMPLE_A);
    await expect(rowCells(page, "平均")).toHaveText(["100.0 回", "16,000 個", "16,000 円"]);
    await expect(rowCells(page, "99%")).toHaveText(["459 回", "73,440 個", "73,440 円"]);
    await expect(rowCells(page, "最大")).toHaveText(["上限なし", "—", "—"]);
    await field(page, "持っている石").fill("1600");
    await expect(rowCells(page, "平均")).toHaveText(["100.0 回", "16,000 個", "14,400 円"]);
});

test("例 E・G の回数が仕様の値になる", async ({ page }) => {
    await enter(page, EXAMPLE_E);
    await expect(drawsColumn(page)).toHaveText(["93.4 回", "80 回", "155 回", "161 回", "180 回"]);
    await enter(page, { c0: "50" });
    await expect(drawsColumn(page)).toHaveText(["56.8 回", "32 回", "107 回", "112 回", "130 回"]);
});

test("例 K は「回数が多すぎて計算できません。…」が出る", async ({ page }) => {
    await enter(page, EXAMPLE_K);
    await expect(page.getByText(TOO_MANY, { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(resultTable(page)).toBeHidden();
});

test("例 L・L2 の計算中もページが固まらず、L は計算できない文・L2 は表が出る", async ({ page }) => {
    const stones = field(page, "1 回に使う石の数");

    await enter(page, { ...EXAMPLE_K, n: "1000" });
    let started = Date.now();
    await stones.fill("150");
    expect(Date.now() - started, "L の計算中に石の数を入れるのに時間がかかった").toBeLessThan(500);
    await expect(stones).toHaveValue("150");
    await expect(page.getByText(TOO_MANY, { exact: true })).toBeVisible({ timeout: 10_000 });

    await field(page, "すり抜けが続いたら確定").selectOption({ label: "5 回" });
    started = Date.now();
    await stones.fill("100");
    expect(Date.now() - started, "L2 の計算中に石の数を入れるのに時間がかかった").toBeLessThan(500);
    await expect(stones).toHaveValue("100");
    await expect(rowCells(page, "最大").first()).toHaveText("6,000 回", { timeout: 10_000 });
    await expect(page.getByText(TOO_MANY, { exact: true })).toBeHidden();
});

test("入力を変えても、URL は変わらず localStorage に何も残さない", async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await enter(page, EXAMPLE_A);
    await enter(page, { owned: "1600", budget: "16000" });
    await enter(page, EXAMPLE_E);
    await expect(drawsColumn(page).first()).toHaveText("93.4 回");
    expect(new URL(page.url()).pathname).toBe("/tools/gacha");
    expect(new URL(page.url()).search).toBe("");
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("注意書きが 2 つ見える", async ({ page }) => {
    await expect(
        page.getByText(
            "狙い 1 体が手に入るまでを計算します。2 体以上ほしいときの平均は、おおよそ体数倍です。ただし 90% などの回数は体数倍にはなりません。交換型の天井（当たっても交換のポイントが減らないもの）では、2 体目以降はこの計算より少なく済むことがあります。",
            { exact: true },
        ),
    ).toBeVisible();
    await expect(page.getByText("確率や天井は、ゲームのお知らせ（提供割合）で確かめてください。結果は目安です。", { exact: true })).toBeVisible();
});
