// ガチャ天井計算機：狙いの 1 体が手に入るまでの回数の分布を、状態の確率の表を 1 回ずつ進めて正確に出す
// 確率（p・q・d）は「% の 1000 倍の整数」で受ける（小数第 3 位まで。例 0.6% → 600、100% → 100000）。
// 100% に届くかの判定は整数で行い、確率に直すのは表を進めるときだけ（小数の誤差で天井の回数がずれないため）

/** 100% を 1000 倍の整数で表した値 */
export const PERCENT_SCALE = 100000;

export interface GachaInput {
    /** 最高レアの確率（% の 1000 倍） */
    p: number;
    /** すり抜けの確率（% の 1000 倍） */
    q: number;
    /** すり抜けが k 回続いたら次は確定（null はなし） */
    k: number | null;
    /** いま続いているすり抜けの回数（k が null なら使わない） */
    s0: number;
    /** 天井：最高レアが必ず出る回数（null はなし） */
    n: number | null;
    /** 前の最高レアから引いた回数（n が null なら使わない） */
    c0: number;
    /** ソフト天井の開始（n が null なら使わない） */
    softStart: number | null;
    /** ソフト天井で 1 回ごとに上がる確率（% の 1000 倍） */
    softStep: number | null;
    /** 狙いが確定するまであと何回（null はなし） */
    m: number | null;
}

export type GachaResult =
    | { kind: "ok"; mean: number; p50: number; p90: number; p99: number; max: number | null; cdf: number[] }
    | { kind: "too-many" };

/** 残りの確率がこれより小さくなったら止める */
const REMAINING_EPSILON = 1e-12;
/** 何 % の回数かを比べるときに許す誤差 */
const QUANTILE_EPSILON = 1e-12;
/** 進める回数の上限 */
export const MAX_STEPS = 1_000_000;
/** 進めた回数 × 状態の数の上限 */
export const MAX_WORK = 50_000_000;

/** 天井とソフト天井が使えるか（ソフト天井は天井があり、開始と上がる確率の両方があるときだけ） */
function softCeiling(input: GachaInput): { start: number; step: number } | null {
    if (input.n === null || input.softStart === null || input.softStep === null) {
        return null;
    }
    return { start: input.softStart, step: input.softStep };
}

/** j 回目に最高レアが当たる確率（% の 1000 倍。100000 以上は 100%） */
function hitRate1000(input: GachaInput, j: number): number {
    if (input.n !== null && j >= input.n) {
        return PERCENT_SCALE;
    }
    const soft = softCeiling(input);
    if (soft !== null && j >= soft.start) {
        return input.p + soft.step * (j - soft.start + 1);
    }
    return input.p;
}

/** 確率が 1 になる最も小さい回数 N'（ないときは null） */
export function certainHitAt(input: GachaInput): number | null {
    const candidates: number[] = [];
    if (input.n !== null) {
        candidates.push(input.n);
    }
    const soft = softCeiling(input);
    if (soft !== null && soft.step > 0) {
        candidates.push(soft.start + Math.ceil((PERCENT_SCALE - input.p) / soft.step) - 1);
    }
    if (input.p >= PERCENT_SCALE) {
        candidates.push(1);
    }
    return candidates.length === 0 ? null : Math.min(...candidates);
}

/** 狙いが手に入る回数の最大（入力の形から出す。null は上限なし） */
export function maxDraws(input: GachaInput): number | null {
    const nPrime = certainHitAt(input);
    let max: number | null;
    if (nPrime === null) {
        max = null;
    } else {
        const c0 = input.n === null ? 0 : input.c0;
        const first = Math.max(1, nPrime - c0);
        if (input.q === 0) {
            max = first;
        } else if (input.k !== null) {
            max = first + nPrime * (input.k - input.s0);
        } else {
            max = null;
        }
    }
    if (input.m !== null) {
        max = max === null ? input.m : Math.min(max, input.m);
    }
    return max;
}

/** cdf[t] が x 以上になる最も小さい t */
function quantile(cdf: readonly number[], x: number): number {
    for (let t = 0; t < cdf.length; t++) {
        if (cdf[t]! >= x - QUANTILE_EPSILON) {
            return t;
        }
    }
    return cdf.length - 1;
}

export function computeGacha(input: GachaInput): GachaResult {
    const counts = input.n ?? 1;
    const streaks = input.k === null ? 1 : input.k + 1;
    const states = counts * streaks;
    const max = maxDraws(input);

    // c 回引いたあと（j = c + 1 回目）に当たる確率
    const hit = new Float64Array(counts);
    for (let c = 0; c < counts; c++) {
        const rate = input.n === null ? input.p : hitRate1000(input, c + 1);
        hit[c] = rate >= PERCENT_SCALE ? 1 : rate / PERCENT_SCALE;
    }
    const through = input.q / PERCENT_SCALE;

    let current = new Float64Array(states);
    let next = new Float64Array(states);
    const c0 = input.n === null ? 0 : input.c0;
    const s0 = input.k === null ? 0 : input.s0;
    current[c0 * streaks + s0] = 1;

    const cdf: number[] = [0];
    let remaining = 1;
    let t = 0;
    while (remaining >= REMAINING_EPSILON && (max === null || t < max)) {
        t++;
        if (t > MAX_STEPS || t * states > MAX_WORK) {
            return { kind: "too-many" };
        }
        next.fill(0);
        let gained = 0;
        for (let c = 0; c < counts; c++) {
            const h = hit[c]!;
            const missTo = input.n === null ? 0 : c + 1;
            for (let s = 0; s < streaks; s++) {
                const mass = current[c * streaks + s]!;
                if (mass === 0) {
                    continue;
                }
                const won = mass * h;
                if (h < 1) {
                    next[missTo * streaks + s]! += mass - won;
                }
                if (input.k !== null && s >= input.k) {
                    gained += won;
                } else {
                    const lost = won * through;
                    gained += won - lost;
                    if (lost > 0) {
                        // すり抜け：カウントは 0 に戻り、続いた回数が 1 増える（k がなければ数えない）
                        next[input.k === null ? s : s + 1]! += lost;
                    }
                }
            }
        }
        [current, next] = [next, current];

        if (max !== null && t === max) {
            // 最大の回数では、残りがすべて手に入る（交換・期間の天井、または天井と確定の組み合わせ）
            cdf.push(1);
            remaining = 0;
            break;
        }
        cdf.push(Math.min(1, cdf[t - 1]! + gained));
        remaining -= gained;
        if (remaining < 1e-9 || t % 1024 === 0) {
            // 引き算の誤差がたまらないよう、止めるかを決める前と、ときどき足し直す
            remaining = 0;
            for (let i = 0; i < states; i++) {
                remaining += current[i]!;
            }
        }
    }

    let mean = 0;
    for (let i = 0; i < cdf.length - 1; i++) {
        mean += 1 - cdf[i]!;
    }

    return {
        kind: "ok",
        mean,
        p50: quantile(cdf, 0.5),
        p90: quantile(cdf, 0.9),
        p99: quantile(cdf, 0.99),
        max,
        cdf,
    };
}
