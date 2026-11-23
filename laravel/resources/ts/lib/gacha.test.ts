import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGacha, type GachaInput } from "./gacha.ts";

// 入力を % のまま書けるようにする（p・q・d は 1000 倍の整数に直す）
interface Example {
    p: number;
    q?: number;
    k?: number;
    s0?: number;
    n?: number;
    c0?: number;
    softStart?: number;
    softStep?: number;
    m?: number;
}

function input(example: Example): GachaInput {
    return {
        p: Math.round(example.p * 1000),
        q: Math.round((example.q ?? 0) * 1000),
        k: example.k ?? null,
        s0: example.s0 ?? 0,
        n: example.n ?? null,
        c0: example.c0 ?? 0,
        softStart: example.softStart ?? null,
        softStep: example.softStep === undefined ? null : Math.round(example.softStep * 1000),
        m: example.m ?? null,
    };
}

function ok(example: Example): Extract<ReturnType<typeof computeGacha>, { kind: "ok" }> {
    const result = computeGacha(input(example));
    assert.equal(result.kind, "ok");
    return result as Extract<typeof result, { kind: "ok" }>;
}

const D: Example = { p: 0.6, n: 90, softStart: 74, softStep: 6 };
const E: Example = { ...D, q: 50, k: 1 };

// spec.md「確かめる値」
const cases: { name: string; example: Example; mean: number; p50: number; p90: number; p99: number; max: number | null }[] = [
    { name: "A", example: { p: 1 }, mean: 100.0, p50: 69, p90: 230, p99: 459, max: null },
    { name: "B", example: { p: 0.6, n: 90 }, mean: 69.6998, p50: 90, p90: 90, p99: 90, max: 90 },
    { name: "C", example: { p: 1, m: 100 }, mean: 63.3968, p50: 69, p90: 100, p99: 100, max: 100 },
    { name: "D", example: D, mean: 62.2973, p50: 76, p90: 80, p99: 83, max: 90 },
    { name: "E", example: E, mean: 93.446, p50: 80, p90: 155, p99: 161, max: 180 },
    { name: "F", example: { ...E, s0: 1 }, mean: 62.2973, p50: 76, p90: 80, p99: 83, max: 90 },
    { name: "G", example: { ...E, c0: 50 }, mean: 56.8041, p50: 32, p90: 107, p99: 112, max: 130 },
    { name: "H", example: { p: 1, q: 50 }, mean: 200.0, p50: 139, p90: 460, p99: 919, max: null },
    { name: "I", example: { p: 100, q: 50, k: 1 }, mean: 1.5, p50: 1, p90: 2, p99: 2, max: 2 },
    { name: "J", example: { p: 1, q: 50, k: 1, n: 100 }, mean: 95.0951, p50: 100, p90: 180, p99: 200, max: 200 },
];

for (const c of cases) {
    test(`例 ${c.name}：平均・50%・90%・99%・最大が仕様の値`, () => {
        const result = ok(c.example);
        assert.ok(Math.abs(result.mean - c.mean) <= 0.0001, `平均 ${result.mean} が ${c.mean} と ±0.0001 に入らない`);
        assert.equal(result.p50, c.p50);
        assert.equal(result.p90, c.p90);
        assert.equal(result.p99, c.p99);
        assert.equal(result.max, c.max);
    });
}

test("B・C の平均が式の値と 10⁻⁹ 以内", () => {
    assert.ok(Math.abs(ok({ p: 0.6, n: 90 }).mean - (1 - 0.994 ** 90) / 0.006) <= 1e-9);
    assert.ok(Math.abs(ok({ p: 1, m: 100 }).mean - (1 - 0.99 ** 100) / 0.01) <= 1e-9);
});

test("A の cdf：0 回は 0、100 回・110 回は 1 − 0.99^t", () => {
    const { cdf } = ok({ p: 1 });
    assert.equal(cdf[0], 0);
    assert.ok(Math.abs(cdf[100]! - (1 - 0.99 ** 100)) <= 1e-9);
    assert.ok(Math.abs(cdf[110]! - (1 - 0.99 ** 110)) <= 1e-9);
});

test("cdf は減らず、最後は 1 − 10⁻¹² 以上で、最大を超えない（最大まで進んだらそこが 1）", () => {
    for (const c of cases) {
        const result = ok(c.example);
        for (let t = 1; t < result.cdf.length; t++) {
            assert.ok(result.cdf[t]! >= result.cdf[t - 1]!, `${c.name} の cdf[${t}] が減っている`);
        }
        assert.ok(result.cdf.at(-1)! >= 1 - 1e-12, `${c.name} の cdf の最後が 1 に届いていない`);
        if (result.max !== null) {
            // 残りが 10⁻¹² 未満になったら、最大の手前で止まることがある
            assert.ok(result.cdf.length <= result.max + 1, `${c.name} の cdf が最大を超えている`);
            if (result.cdf.length === result.max + 1) {
                assert.equal(result.cdf[result.max], 1);
            }
        }
    }
});

function timed<T>(run: () => T): { value: T; ms: number } {
    const start = performance.now();
    const value = run();
    return { value, ms: performance.now() - start };
}

test("K（p=0.01・q=99）は too-many で、1 秒未満で終わる", () => {
    const { value, ms } = timed(() => computeGacha(input({ p: 0.01, q: 99 })));
    assert.deepEqual(value, { kind: "too-many" });
    assert.ok(ms < 1000, `${ms}ms かかった`);
});

test("L（K ＋ N=1000）は too-many で、1 秒未満で終わる", () => {
    const { value, ms } = timed(() => computeGacha(input({ p: 0.01, q: 99, n: 1000 })));
    assert.deepEqual(value, { kind: "too-many" });
    assert.ok(ms < 1000, `${ms}ms かかった`);
});

test("L2（L ＋ k=5）は計算でき、最大が 6000 で、1 秒未満で終わる", () => {
    const { value, ms } = timed(() => computeGacha(input({ p: 0.01, q: 99, n: 1000, k: 5 })));
    assert.equal(value.kind, "ok");
    assert.equal(value.kind === "ok" ? value.max : undefined, 6000);
    assert.ok(ms < 1000, `${ms}ms かかった`);
});

test("O（p=0.1・N=1000・S=2・d=0.3）の最大が 334（334 回目で 100%）", () => {
    assert.equal(ok({ p: 0.1, n: 1000, softStart: 2, softStep: 0.3 }).max, 334);
});
