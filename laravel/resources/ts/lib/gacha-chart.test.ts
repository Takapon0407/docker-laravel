import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetChance, chartPoints, computeGacha, type ChartPoint, type GachaInput } from "./gacha.ts";

// gacha-02：グラフの点と、予算で引ける回数・手に入る確率（spec.md「数の書き方」「グラフ」）

function input(partial: Partial<GachaInput> & { p: number }): GachaInput {
    return { q: 0, k: null, s0: 0, n: null, c0: 0, softStart: null, softStep: null, m: null, ...partial };
}

function ok(gacha: GachaInput): Extract<ReturnType<typeof computeGacha>, { kind: "ok" }> {
    const result = computeGacha(gacha);
    assert.equal(result.kind, "ok");
    return result as Extract<typeof result, { kind: "ok" }>;
}

// 確率は % の 1000 倍
const A = ok(input({ p: 1000 }));
const J = ok(input({ p: 1000, q: 50000, k: 1, n: 100 }));
const P10N1000 = ok(input({ p: 10000, n: 1000 }));
const O = ok(input({ p: 100, n: 1000, softStart: 2, softStep: 300 }));

function assertShape(points: readonly ChartPoint[], name: string): void {
    assert.ok(points.length <= 201, `${name} の点が ${points.length} 個`);
    assert.deepEqual(points[0], { x: 0, y: 0 }, `${name} の最初の点が (0, 0) でない`);
    for (let i = 1; i < points.length; i++) {
        assert.ok(points[i]!.x > points[i - 1]!.x, `${name} の x が増えていない（${i}）`);
        assert.ok(points[i]!.y >= points[i - 1]!.y, `${name} の y が減っている（${i}）`);
    }
}

test("グラフの点：A は (0, 0) から始まり、最後が x=459・y=cdf[459]", () => {
    const points = chartPoints(A);
    assertShape(points, "A");
    assert.deepEqual(points.at(-1), { x: 459, y: A.cdf[459] });
});

test("グラフの点：J は最後が x=200・y=1", () => {
    const points = chartPoints(J);
    assertShape(points, "J");
    assert.deepEqual(points.at(-1), { x: 200, y: 1 });
});

test("グラフの点：p=10・N=1000 は最後が x=1000・y=1（cdf が途中で止まっても最大で 1）", () => {
    const points = chartPoints(P10N1000);
    assertShape(points, "p=10・N=1000");
    assert.deepEqual(points.at(-1), { x: 1000, y: 1 });
});

test("グラフの点：O の最大は 334 で、点の形が決まりどおり", () => {
    assert.equal(O.max, 334);
    const points = chartPoints(O);
    assertShape(points, "O");
    assert.deepEqual(points.at(-1), { x: 334, y: 1 });
});

test("予算：A（石 160・値段 1）で 16000 円 → 100 回・63.3%、持っている石 1600 で 110 回・66.8%", () => {
    assert.deepEqual(budgetChance(A, { budget: 16000, price: 1000, stonesPerDraw: 160000, ownedStones: 0 }), { draws: 100, chance: "63.3%" });
    assert.deepEqual(budgetChance(A, { budget: 16000, price: 1000, stonesPerDraw: 160000, ownedStones: 1600 }), { draws: 110, chance: "66.8%" });
});

test("予算：J（石 100・値段 1）で 20000 円 → 200 回・100%、19900 円 → 199 回・99.9% 以下", () => {
    assert.deepEqual(budgetChance(J, { budget: 20000, price: 1000, stonesPerDraw: 100000, ownedStones: 0 }), { draws: 200, chance: "100%" });
    const short = budgetChance(J, { budget: 19900, price: 1000, stonesPerDraw: 100000, ownedStones: 0 });
    assert.equal(short.draws, 199);
    assert.notEqual(short.chance, "100%");
    assert.ok(Number.parseFloat(short.chance) <= 99.9, short.chance);
});

test("予算：A で 100 円（石 160・値段 1）→ 0 回", () => {
    assert.equal(budgetChance(A, { budget: 100, price: 1000, stonesPerDraw: 160000, ownedStones: 0 }).draws, 0);
});
