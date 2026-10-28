import { test } from "node:test";
import assert from "node:assert/strict";
import { split, splitPerPerson, type Group } from "./warikan.ts";

function group(overrides: Partial<Group>): Group {
    return { name: "", count: 1, mode: "ratio", ratio: 1, fixed: 0, ...overrides };
}

test("全員同じ比率なら、1人あたりを端数の単位で切り上げ、お釣りを出す", () => {
    const result = split(10000, [group({ count: 3 })], 100);

    assert.deepEqual(result, {
        ok: true,
        groups: [{ name: "", count: 3, perPerson: 3400, subtotal: 10200 }],
        collected: 10200,
        change: 200,
    });
});

test("割り切れるときはお釣りが出ない", () => {
    const result = split(12000, [group({ count: 6 })], 1000);

    assert.equal(result.ok && result.change, 0);
    assert.equal(result.ok && result.groups[0]?.perPerson, 2000);
});

test("比率 0.5 のグループは、比率 1 のグループの半額になる", () => {
    const result = split(30000, [group({ name: "先輩", count: 5 }), group({ name: "後輩", count: 5, ratio: 0.5 })], 100);

    assert.ok(result.ok);
    assert.equal(result.groups[0]?.perPerson, 4000);
    assert.equal(result.groups[1]?.perPerson, 2000);
    assert.equal(result.change, 0);
});

test("固定額のグループは端数の単位で切り上げず、残りをほかのグループで割る", () => {
    const result = split(10000, [group({ count: 3 }), group({ count: 1, mode: "fixed", fixed: 2500 })], 1000);

    assert.ok(result.ok);
    assert.equal(result.groups[0]?.perPerson, 3000);
    assert.equal(result.groups[1]?.perPerson, 2500);
    assert.equal(result.change, 1500);
});

test("固定額のグループでは比率を使わない", () => {
    const result = split(6000, [group({ count: 2 }), group({ count: 1, mode: "fixed", fixed: 2000, ratio: 3 })], 1);

    assert.ok(result.ok);
    assert.equal(result.groups[0]?.perPerson, 2000);
    assert.equal(result.groups[1]?.perPerson, 2000);
});

test("比率 0 のグループは払わない（おごられる人）", () => {
    const result = split(9000, [group({ count: 2 }), group({ count: 1, ratio: 0 })], 1);

    assert.ok(result.ok);
    assert.equal(result.groups[0]?.perPerson, 4500);
    assert.equal(result.groups[1]?.perPerson, 0);
});

test("小数の比率でも、誤差で 1 単位多く切り上げない", () => {
    // 300 × 0.3 / (3 × 0.3) は浮動小数だと 100.00000000000001 になる
    const result = split(300, [group({ count: 3, ratio: 0.3 })], 100);

    assert.equal(result.ok && result.groups[0]?.perPerson, 100);
});

test("人数 0 のグループは小計が 0 円で、ほかのグループの金額に影響しない", () => {
    const result = split(5000, [group({ count: 5 }), group({ count: 0, ratio: 3 })], 100);

    assert.ok(result.ok);
    assert.equal(result.groups[0]?.perPerson, 1000);
    assert.equal(result.groups[1]?.subtotal, 0);
});

test("固定額がちょうど合計になれば、残りを払う人がいなくてもよい", () => {
    const result = split(6000, [group({ count: 2, mode: "fixed", fixed: 3000 })], 100);

    assert.ok(result.ok);
    assert.equal(result.change, 0);
});

test("入力が正しくないときはエラーを返す", () => {
    const cases: [number, Group[]][] = [
        [0, [group({ count: 3 })]],
        [1000.5, [group({ count: 3 })]],
        [1000, [group({ count: 0 })]],
        [1000, [group({ count: 1.5 })]],
        [1000, [group({ count: 2, ratio: -1 })]],
        // 固定額が合計を超える
        [1000, [group({ count: 2, mode: "fixed", fixed: 600 })]],
        // 残りを払う人がいない
        [1000, [group({ count: 2, ratio: 0 })]],
    ];

    for (const [total, groups] of cases) {
        assert.equal(split(total, groups, 100).ok, false, JSON.stringify({ total, groups }));
    }
});

test("1人ずつ: 全員の金額を決めて合計と同じなら、その金額のまま", () => {
    const result = splitPerPerson(3000, [{ name: "A", amount: 500 }, { name: "B", amount: 1000 }, { name: "C", amount: 1500 }], 100);

    assert.ok(result.ok);
    assert.deepEqual(result.groups.map((g) => g.perPerson), [500, 1000, 1500]);
    assert.equal(result.change, 0);
});

test("1人ずつ: 金額が空欄（自動）の人が残りを均等に割り、端数の単位で切り上げる", () => {
    const result = splitPerPerson(10000, [{ name: "A", amount: 1000 }, { name: "B", amount: null }, { name: "C", amount: null }, { name: "D", amount: null }], 100);

    assert.ok(result.ok);
    // 残り 9000 を 3 人で割って 3000
    assert.deepEqual(result.groups.map((g) => g.perPerson), [1000, 3000, 3000, 3000]);

    const uneven = splitPerPerson(10000, [{ name: "A", amount: 500 }, { name: "B", amount: null }, { name: "C", amount: null }], 100);
    assert.ok(uneven.ok);
    // 残り 9500 を 2 人で割って 4750 → 4800
    assert.deepEqual(uneven.groups.map((g) => g.perPerson), [500, 4800, 4800]);
    assert.equal(uneven.change, 100);
});

test("1人ずつ: 決めた金額が合計を超える・全員決めて足りないときは、差額つきのエラーを返す", () => {
    const over = splitPerPerson(3000, [{ name: "A", amount: 2000 }, { name: "B", amount: 1500 }, { name: "C", amount: null }], 100);
    assert.deepEqual(over, { ok: false, error: "金額を決めた人の合計が、合計金額より 500円 多くなっています" });

    const short = splitPerPerson(3000, [{ name: "A", amount: 500 }, { name: "B", amount: 1000 }], 100);
    assert.deepEqual(short, { ok: false, error: "あと 1,500円 足りません（金額を空欄にした人が残りを払います）" });
});

test("1人ずつ: 合計金額が空のときは、合計金額のエラーを優先する", () => {
    const result = splitPerPerson(0, [{ name: "A", amount: 500 }], 100);

    assert.deepEqual(result, { ok: false, error: "合計金額を入力してください" });
});
