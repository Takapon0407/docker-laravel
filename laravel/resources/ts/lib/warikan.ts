// 割り勘の計算（DOM に依存しない。node --test でテストする）
//
// 1. 固定額のグループの分を合計から先に引く
// 2. 残りを、比率のグループの「比率 × 人数」で按分する
// 3. 比率のグループの1人あたりの金額は端数の単位で切り上げ、集めすぎた分（お釣り）は幹事が受け取る
//
// 1人ずつ金額を決めるとき（splitPerPerson）も、1人だけのグループとして同じ計算をする

export type SplitMode = "ratio" | "fixed";

export interface Group {
    name: string;
    count: number;
    mode: SplitMode;
    // mode が ratio のときに使う（1 = ふつう、0.5 = 半額、0 = 払わない）
    ratio: number;
    // mode が fixed のときに使う 1人あたりの金額
    fixed: number;
}

export interface GroupResult {
    name: string;
    count: number;
    perPerson: number;
    subtotal: number;
}

export type SplitResult =
    | { ok: true; groups: GroupResult[]; collected: number; change: number }
    | { ok: false; error: string };

export const ROUNDING_UNITS = [1, 10, 100, 500, 1000] as const;

// 浮動小数の誤差（1000.0000001 円など）で 1 単位多く切り上げないための余裕
const EPSILON = 1e-9;

export function split(total: number, groups: Group[], unit: number): SplitResult {
    if (!Number.isInteger(total) || total <= 0) {
        return { ok: false, error: "合計金額を入力してください" };
    }
    const people = groups.reduce((sum, g) => sum + g.count, 0);
    if (groups.some((g) => !Number.isInteger(g.count) || g.count < 0) || people === 0) {
        return { ok: false, error: "人数を入力してください" };
    }
    if (groups.some((g) => g.ratio < 0 || g.fixed < 0)) {
        return { ok: false, error: "マイナスの値は入力できません" };
    }

    // 比率で割る前に引く金額（固定額）
    const reserved = groups.reduce((sum, g) => sum + (g.mode === "fixed" ? g.count * g.fixed : 0), 0);
    const remaining = total - reserved;
    if (remaining < 0) {
        return { ok: false, error: "固定額の合計が、合計金額を超えています" };
    }

    const weight = groups.reduce((sum, g) => sum + (g.mode === "ratio" ? g.count * g.ratio : 0), 0);
    if (remaining > 0 && weight === 0) {
        return { ok: false, error: "残りの金額を払う人がいません（比率が 0 より大きいグループを入れてください）" };
    }

    const results = groups.map((g): GroupResult => {
        // 固定額は決めた金額のまま払う（端数の単位で切り上げない）
        const perPerson = g.mode === "fixed" ? g.fixed : roundUp(weight === 0 ? 0 : (remaining * g.ratio) / weight, unit);
        return { name: g.name, count: g.count, perPerson, subtotal: perPerson * g.count };
    });
    const collected = results.reduce((sum, r) => sum + r.subtotal, 0);

    return { ok: true, groups: results, collected, change: collected - total };
}

export interface Person {
    name: string;
    // null は「自動」（金額を決めた人を引いた残りを、自動の人で均等に割る）
    amount: number | null;
}

const yen = new Intl.NumberFormat("ja-JP");

// 1人ずつ金額を決めるとき。1人だけのグループ（金額を決めた人は固定額、自動の人は比率 1）として split で計算する
export function splitPerPerson(total: number, people: Person[], unit: number): SplitResult {
    if (Number.isInteger(total) && total > 0) {
        const assigned = people.reduce((sum, p) => sum + (p.amount ?? 0), 0);
        if (assigned > total) {
            return { ok: false, error: `金額を決めた人の合計が、合計金額より ${yen.format(assigned - total)}円 多くなっています` };
        }
        if (assigned < total && people.length > 0 && people.every((p) => p.amount !== null)) {
            return { ok: false, error: `あと ${yen.format(total - assigned)}円 足りません（金額を空欄にした人が残りを払います）` };
        }
    }

    return split(
        total,
        people.map((p) => ({
            name: p.name,
            count: 1,
            mode: p.amount === null ? "ratio" : "fixed",
            ratio: 1,
            fixed: p.amount ?? 0,
        })),
        unit,
    );
}

function roundUp(amount: number, unit: number): number {
    // 0 円のとき EPSILON を引くと -0 になり、表示が「-0円」になるため 0 にそろえる
    return Math.max(0, Math.ceil(amount / unit - EPSILON) * unit);
}
