import { test } from "node:test";
import assert from "node:assert/strict";
import { BOTH_SOFT_MESSAGE, normalize, parseDecimal, parseInteger, readForm, type RawInput } from "./gacha-input.ts";

// gacha-04：入力の読み取りと確かめ（spec.md の入力の表・エラーの文）

const INITIAL: RawInput = { p: "1", q: "50", k: 1, s0: 0, n: "100", c0: "", softStart: "", softStep: "", m: "", stones: "100", price: "1", owned: "", budget: "" };

function errorsOf(partial: Partial<RawInput>): Record<string, string> {
    return readForm({ ...INITIAL, ...partial }).errors;
}

test("全角の数字・ピリオドと前後の空白を受ける", () => {
    assert.equal(normalize(" １２．５ "), "12.5");
    assert.deepEqual(parseDecimal("０.６"), { kind: "ok", value: 600 });
    assert.deepEqual(parseInteger("１００"), { kind: "ok", value: 100 });
});

test("小数は第 3 位まで、カンマ・指数・負の数は不正", () => {
    assert.deepEqual(parseDecimal("0.005"), { kind: "ok", value: 5 });
    for (const bad of ["0.0001", "1,000", "1e3", "-1", "abc", ".5", "1."]) {
        assert.deepEqual(parseDecimal(bad), { kind: "invalid" }, bad);
    }
    assert.deepEqual(parseInteger("1.5"), { kind: "invalid" });
    assert.deepEqual(parseInteger(""), { kind: "empty" });
});

test("最初の値は例 J の入力になる", () => {
    const state = readForm(INITIAL);
    assert.equal(state.kind, "ok");
    if (state.kind === "ok") {
        assert.deepEqual(state.gacha, { p: 1000, q: 50000, k: 1, s0: 0, n: 100, c0: 0, softStart: null, softStep: null, m: null });
        assert.deepEqual(state.money, { stonesPerDraw: 100000, price: 1000, ownedStones: 0, budget: null });
    }
});

test("範囲の外・不正な値は、その欄にエラーの文が付く", () => {
    const decimal = "0.01〜100 の数（小数第 3 位まで）を入れてください";
    for (const p of ["0", "101", "abc", "0.0001"]) {
        assert.equal(errorsOf({ p }).p, decimal, p);
    }
    assert.equal(errorsOf({ q: "100" }).q, "0〜99 の数（小数第 3 位まで）を入れてください");
    assert.equal(errorsOf({ n: "0" }).n, "1〜1,000 の整数を入れてください");
    assert.equal(errorsOf({ n: "1.5" }).n, "1〜1,000 の整数を入れてください");
    assert.equal(errorsOf({ c0: "100" }).c0, "0〜99 の整数を入れてください");
    assert.equal(errorsOf({ softStart: "100", softStep: "6" }).softStart, "2〜99 の整数を入れてください");
    assert.equal(errorsOf({ m: "0" }).m, "1〜10,000 の整数を入れてください");
    assert.equal(errorsOf({ price: "-1" }).price, "0.01〜10,000 の数（小数第 3 位まで）を入れてください");
    assert.equal(errorsOf({ price: "1,000" }).price, "0.01〜10,000 の数（小数第 3 位まで）を入れてください");
    assert.equal(readForm({ ...INITIAL, p: "abc" }).kind, "invalid");
});

test("ソフト天井は片方だけなら、空いているほうにエラー", () => {
    assert.deepEqual(errorsOf({ softStart: "74" }), { softStep: BOTH_SOFT_MESSAGE });
    assert.deepEqual(errorsOf({ softStep: "6" }), { softStart: BOTH_SOFT_MESSAGE });
});

test("天井が空のときは、今のカウント・ソフト天井を確かめず使わない", () => {
    const state = readForm({ ...INITIAL, n: "", c0: "999", softStart: "74" });
    assert.equal(state.kind, "ok");
    assert.equal(state.ceilingShown, false);
    if (state.kind === "ok") {
        assert.equal(state.gacha.c0, 0);
        assert.equal(state.gacha.softStart, null);
    }
});

test("必須の欄が空なら missing（不正があればそちらが先）で、空欄にはエラーを付けない", () => {
    const missing = readForm({ ...INITIAL, p: "" });
    assert.equal(missing.kind, "missing");
    assert.deepEqual(missing.errors, {});
    assert.equal(readForm({ ...INITIAL, p: "", q: "100" }).kind, "invalid");
});

test("k がなしなら s₀ は 0、k を下げたら s₀ は k まで", () => {
    const none = readForm({ ...INITIAL, k: null, s0: 3 });
    assert.equal(none.kind === "ok" ? none.gacha.s0 : -1, 0);
    const lowered = readForm({ ...INITIAL, k: 1, s0: 3 });
    assert.equal(lowered.kind === "ok" ? lowered.gacha.s0 : -1, 1);
});
