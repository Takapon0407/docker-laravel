// ガチャ天井計算機の結果を、表・文・グラフのラベルの文字にする
import { budgetChance, chartEnd, formatChance, type GachaResult } from "./gacha.ts";
import type { MoneyInput } from "./gacha-input.ts";

type GachaOk = Extract<GachaResult, { kind: "ok" }>;

const INTEGER = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
// 平均の回数は小数第 1 位まで必ず出す（toFixed は使わない）
const ONE_DECIMAL = new Intl.NumberFormat("ja-JP", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const ROW_LABELS = ["平均", "50%", "90%", "99%", "最大"] as const;

export interface ResultRow {
    label: (typeof ROW_LABELS)[number];
    draws: string;
    stones: string;
    money: string;
}

/** 回数ぶんの石の数（個。丸める前） */
function stonesFor(draws: number, money: MoneyInput): number {
    return (draws * money.stonesPerDraw) / 1000;
}

/** 回数ぶんの金額：max(0, 石 − 持っている石) × 値段 を出してから、最後に 1 回だけ丸める */
function moneyFor(draws: number, money: MoneyInput): number {
    return Math.round((Math.max(0, stonesFor(draws, money) - money.ownedStones) * money.price) / 1000);
}

export function formatMean(mean: number): string {
    return ONE_DECIMAL.format(mean);
}

export function formatInteger(value: number): string {
    return INTEGER.format(value);
}

function row(label: ResultRow["label"], draws: number | null, drawsText: string, money: MoneyInput): ResultRow {
    if (draws === null) {
        return { label, draws: "上限なし", stones: "—", money: "—" };
    }
    return {
        label,
        draws: `${drawsText} 回`,
        stones: `${formatInteger(Math.round(stonesFor(draws, money)))} 個`,
        money: `${formatInteger(moneyFor(draws, money))} 円`,
    };
}

export function resultRows(result: GachaOk, money: MoneyInput): ResultRow[] {
    return [
        row("平均", result.mean, formatMean(result.mean), money),
        row("50%", result.p50, formatInteger(result.p50), money),
        row("90%", result.p90, formatInteger(result.p90), money),
        row("99%", result.p99, formatInteger(result.p99), money),
        row("最大", result.max, result.max === null ? "" : formatInteger(result.max), money),
    ];
}

/** 結果の表のすぐ上に出す平均の一文 */
export function summaryText(result: GachaOk, money: MoneyInput): string {
    return `平均 ${formatMean(result.mean)} 回（${formatInteger(moneyFor(result.mean, money))} 円）で手に入ります。`;
}

/** 予算で手に入る確率の文（予算が空欄なら null） */
export function budgetText(result: GachaOk, money: MoneyInput): string | null {
    if (money.budget === null) {
        return null;
    }
    const budget = formatInteger(money.budget);
    const { draws, chance } = budgetChance(result, { budget: money.budget, price: money.price, stonesPerDraw: money.stonesPerDraw, ownedStones: money.ownedStones });
    if (draws === 0) {
        return `${budget} 円では 1 回も引けません。`;
    }
    return `${budget} 円で ${formatInteger(draws)} 回引けます。狙いが手に入る確率は ${chance} です。`;
}

/** グラフの aria-label */
export function chartLabel(result: GachaOk): string {
    const end = chartEnd(result);
    return `回数ごとの、狙いが手に入る確率のグラフ（${formatInteger(end)} 回で ${formatChance(result, end)}）`;
}
