import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGacha, type GachaInput } from "./gacha.ts";
import { budgetText, chartLabel, resultRows, summaryText } from "./gacha-format.ts";
import type { MoneyInput } from "./gacha-input.ts";

// 結果の表・文・グラフのラベルの文字（spec.md「数の書き方」）

function ok(partial: Partial<GachaInput> & { p: number }) {
    const result = computeGacha({ q: 0, k: null, s0: 0, n: null, c0: 0, softStart: null, softStep: null, m: null, ...partial });
    assert.equal(result.kind, "ok");
    return result as Extract<typeof result, { kind: "ok" }>;
}

const A = ok({ p: 1000 });
const J = ok({ p: 1000, q: 50000, k: 1, n: 100 });
const A_MONEY: MoneyInput = { stonesPerDraw: 160000, price: 1000, ownedStones: 0, budget: null };
const J_MONEY: MoneyInput = { stonesPerDraw: 100000, price: 1000, ownedStones: 0, budget: null };

test("最初の値（J）の平均・最大の行", () => {
    const rows = resultRows(J, J_MONEY);
    assert.deepEqual(rows[0], { label: "平均", draws: "95.1 回", stones: "9,510 個", money: "9,510 円" });
    assert.deepEqual(rows[4], { label: "最大", draws: "200 回", stones: "20,000 個", money: "20,000 円" });
});

test("A：平均は小数第 1 位まで必ず出し、上限なしは「上限なし」「—」「—」", () => {
    const rows = resultRows(A, A_MONEY);
    assert.deepEqual(rows[0], { label: "平均", draws: "100.0 回", stones: "16,000 個", money: "16,000 円" });
    assert.deepEqual(rows[3], { label: "99%", draws: "459 回", stones: "73,440 個", money: "73,440 円" });
    assert.deepEqual(rows[4], { label: "最大", draws: "上限なし", stones: "—", money: "—" });
});

test("持っている石は金額からだけ引き、0 円より下にしない", () => {
    const rows = resultRows(A, { ...A_MONEY, ownedStones: 1600 });
    assert.equal(rows[0]!.stones, "16,000 個");
    assert.equal(rows[0]!.money, "14,400 円");
    assert.equal(resultRows(A, { ...A_MONEY, ownedStones: 100000 })[0]!.money, "0 円");
});

test("予算の文・平均の一文・グラフのラベル", () => {
    assert.equal(budgetText(A, A_MONEY), null);
    assert.equal(budgetText(A, { ...A_MONEY, budget: 16000 }), "16,000 円で 100 回引けます。狙いが手に入る確率は 63.3% です。");
    assert.equal(budgetText(A, { ...A_MONEY, budget: 100 }), "100 円では 1 回も引けません。");
    assert.equal(summaryText(J, J_MONEY), "平均 95.1 回（9,510 円）で手に入ります。");
    assert.equal(chartLabel(A), "回数ごとの、狙いが手に入る確率のグラフ（459 回で 99.0%）");
    assert.equal(chartLabel(J), "回数ごとの、狙いが手に入る確率のグラフ（200 回で 100%）");
});
