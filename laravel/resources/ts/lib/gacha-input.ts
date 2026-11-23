// ガチャ天井計算機の入力を読み取り、確かめて、計算に渡す形（1000 倍の整数）にする
import type { BudgetInput, GachaInput } from "./gacha.ts";

export type FieldId = "p" | "q" | "n" | "c0" | "softStart" | "softStep" | "m" | "stones" | "price" | "owned" | "budget";

/** 欄の中身（文字のまま）。k・s₀ は選択の値 */
export interface RawInput {
    p: string;
    q: string;
    k: number | null;
    s0: number;
    n: string;
    c0: string;
    softStart: string;
    softStep: string;
    m: string;
    stones: string;
    price: string;
    owned: string;
    budget: string;
}

export interface MoneyInput {
    /** 1 回に使う石の数（個の 1000 倍） */
    stonesPerDraw: number;
    /** 石 1 個の値段（円の 1000 倍） */
    price: number;
    /** 持っている石（個） */
    ownedStones: number;
    /** 予算（円。null は予算の行を出さない） */
    budget: number | null;
}

export type FormState =
    | { kind: "invalid"; errors: Partial<Record<FieldId, string>>; ceilingShown: boolean }
    | { kind: "missing"; errors: Partial<Record<FieldId, string>>; ceilingShown: boolean }
    | { kind: "ok"; errors: Partial<Record<FieldId, string>>; ceilingShown: boolean; gacha: GachaInput; money: MoneyInput };

export const BOTH_SOFT_MESSAGE = "ソフト天井の開始と上がる確率は、両方入れてください";

type Parsed = { kind: "empty" } | { kind: "invalid" } | { kind: "ok"; value: number };

const DECIMAL = /^\d+(\.\d{1,3})?$/;
const INTEGER = /^\d+$/;
const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 });

/** 前後の空白を除き、全角の数字・ピリオドを半角にする */
export function normalize(raw: string): string {
    return raw.trim().replace(/[０-９．]/g, (char) => (char === "．" ? "." : String.fromCharCode(char.charCodeAt(0) - 0xfee0)));
}

/** 小数（第 3 位まで）を 1000 倍の整数にする */
export function parseDecimal(raw: string): Parsed {
    const text = normalize(raw);
    if (text === "") {
        return { kind: "empty" };
    }
    if (!DECIMAL.test(text)) {
        return { kind: "invalid" };
    }
    const [whole, fraction = ""] = text.split(".");
    return { kind: "ok", value: Number(whole) * 1000 + Number(fraction.padEnd(3, "0")) };
}

export function parseInteger(raw: string): Parsed {
    const text = normalize(raw);
    if (text === "") {
        return { kind: "empty" };
    }
    if (!INTEGER.test(text)) {
        return { kind: "invalid" };
    }
    return { kind: "ok", value: Number(text) };
}

export function decimalRangeMessage(min1000: number, max1000: number): string {
    return `${NUMBER_FORMAT.format(min1000 / 1000)}〜${NUMBER_FORMAT.format(max1000 / 1000)} の数（小数第 3 位まで）を入れてください`;
}

export function integerRangeMessage(min: number, max: number): string {
    return `${NUMBER_FORMAT.format(min)}〜${NUMBER_FORMAT.format(max)} の整数を入れてください`;
}

/** 範囲の中の値・空欄・不正（不正ならエラーの文を errors に入れる） */
function field(errors: Partial<Record<FieldId, string>>, id: FieldId, raw: string, type: "decimal" | "integer", min: number, max: number): Parsed {
    const parsed = type === "decimal" ? parseDecimal(raw) : parseInteger(raw);
    if (parsed.kind === "empty") {
        return parsed;
    }
    if (parsed.kind === "invalid" || parsed.value < min || parsed.value > max) {
        errors[id] = type === "decimal" ? decimalRangeMessage(min, max) : integerRangeMessage(min, max);
        return { kind: "invalid" };
    }
    return parsed;
}

function valueOr<T>(parsed: Parsed, fallback: T): number | T {
    return parsed.kind === "ok" ? parsed.value : fallback;
}

export function readForm(raw: RawInput): FormState {
    const errors: Partial<Record<FieldId, string>> = {};
    const p = field(errors, "p", raw.p, "decimal", 10, 100000);
    const q = field(errors, "q", raw.q, "decimal", 0, 99000);
    const n = field(errors, "n", raw.n, "integer", 1, 1000);

    // 今のカウント・ソフト天井は、天井が入っているときだけ使う（隠しているあいだは確かめない）
    const ceilingShown = n.kind === "ok";
    let c0: Parsed = { kind: "empty" };
    let softStart: Parsed = { kind: "empty" };
    let softStep: Parsed = { kind: "empty" };
    if (n.kind === "ok") {
        c0 = field(errors, "c0", raw.c0, "integer", 0, n.value - 1);
        softStart = field(errors, "softStart", raw.softStart, "integer", 2, n.value - 1);
        softStep = field(errors, "softStep", raw.softStep, "decimal", 10, 100000);
        if (softStart.kind === "empty" && softStep.kind !== "empty") {
            errors.softStart = BOTH_SOFT_MESSAGE;
        }
        if (softStep.kind === "empty" && softStart.kind !== "empty") {
            errors.softStep = BOTH_SOFT_MESSAGE;
        }
    }
    const m = field(errors, "m", raw.m, "integer", 1, 10000);
    const stones = field(errors, "stones", raw.stones, "decimal", 10, 10000000);
    const price = field(errors, "price", raw.price, "decimal", 10, 10000000);
    const owned = field(errors, "owned", raw.owned, "integer", 0, 100000000);
    const budget = field(errors, "budget", raw.budget, "integer", 1, 100000000);

    if (Object.keys(errors).length > 0) {
        return { kind: "invalid", errors, ceilingShown };
    }
    if (p.kind !== "ok" || stones.kind !== "ok" || price.kind !== "ok") {
        return { kind: "missing", errors, ceilingShown };
    }
    const k = raw.k;
    return {
        kind: "ok",
        errors,
        ceilingShown,
        gacha: {
            p: p.value,
            q: valueOr(q, 0),
            k,
            s0: k === null ? 0 : Math.min(raw.s0, k),
            n: valueOr(n, null),
            c0: valueOr(c0, 0),
            softStart: valueOr(softStart, null),
            softStep: valueOr(softStep, null),
            m: valueOr(m, null),
        },
        money: {
            stonesPerDraw: stones.value,
            price: price.value,
            ownedStones: valueOr(owned, 0),
            budget: valueOr(budget, null),
        },
    };
}

/** 予算の関数に渡す形 */
export function budgetInput(money: MoneyInput & { budget: number }): BudgetInput {
    return { budget: money.budget, price: money.price, stonesPerDraw: money.stonesPerDraw, ownedStones: money.ownedStones };
}
