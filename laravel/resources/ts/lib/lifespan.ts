// 誕生日と平均寿命から、平均寿命を迎える日と、そこまでの残りの時間を求める

export type Sex = "male" | "female" | "unspecified";
export type Region = "japan" | "world";

export interface LifeExpectancy {
    years: number;
    // 公式の値ではなく、こちらで計算した値か（日本の男女の平均）
    derived: boolean;
}

// 平均寿命（0 歳の平均余命、年）
// 日本：厚生労働省「令和 7（2025）年簡易生命表」。男女を合わせた値は公表されていないため、男女の平均にする
// 世界：国連「World Population Prospects 2024」の 2023 年の推計値
export const LIFE_EXPECTANCY: Record<Region, Record<Sex, LifeExpectancy>> = {
    japan: {
        male: { years: 81.35, derived: false },
        female: { years: 87.33, derived: false },
        unspecified: { years: 84.34, derived: true },
    },
    world: {
        male: { years: 70.5, derived: false },
        female: { years: 75.9, derived: false },
        unspecified: { years: 73.2, derived: false },
    },
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// 平均寿命の年数を日数にするときの 1 年（グレゴリオ暦の平均）
const YEAR = 365.2425 * DAY;

// 誕生日（その日の 0 時、UNIX ミリ秒）に平均寿命を足した日時
export function expectedEnd(birthMs: number, years: number): number {
    return birthMs + Math.round(years * YEAR);
}

export interface Breakdown {
    years: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export interface Totals {
    // 年は小数第 1 位まで
    years: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export type Remaining =
    | { passed: false; breakdown: Breakdown; totals: Totals; progress: number }
    // 平均寿命をすでに過ぎているときは、過ぎてからの時間
    | { passed: true; breakdown: Breakdown; totals: Totals; progress: 1 };

export function remaining(birthMs: number, endMs: number, nowMs: number): Remaining {
    if (nowMs >= endMs) {
        return { passed: true, breakdown: breakdown(endMs, nowMs), totals: totals(nowMs - endMs), progress: 1 };
    }
    return {
        passed: false,
        breakdown: breakdown(nowMs, endMs),
        totals: totals(endMs - nowMs),
        progress: Math.max(0, Math.min(1, (nowMs - birthMs) / (endMs - birthMs))),
    };
}

// from から to までを「何年と何日と何時間…」に分ける（年はカレンダーどおりに数える。日時は UTC で扱う）
export function breakdown(fromMs: number, toMs: number): Breakdown {
    let years = new Date(toMs).getUTCFullYear() - new Date(fromMs).getUTCFullYear();
    while (years > 0 && addYears(fromMs, years) > toMs) {
        years--;
    }
    let rest = toMs - addYears(fromMs, years);
    const days = Math.floor(rest / DAY);
    rest -= days * DAY;
    const hours = Math.floor(rest / HOUR);
    rest -= hours * HOUR;
    const minutes = Math.floor(rest / MINUTE);
    rest -= minutes * MINUTE;
    return { years, days, hours, minutes, seconds: Math.floor(rest / SECOND) };
}

// 2 月 29 日から 1 年後のように、その日がない年は 3 月 1 日になる
function addYears(ms: number, years: number): number {
    const date = new Date(ms);
    date.setUTCFullYear(date.getUTCFullYear() + years);
    return date.getTime();
}

function totals(ms: number): Totals {
    return {
        years: Math.floor((ms / YEAR) * 10) / 10,
        days: Math.floor(ms / DAY),
        hours: Math.floor(ms / HOUR),
        minutes: Math.floor(ms / MINUTE),
        seconds: Math.floor(ms / SECOND),
    };
}

// 入力欄の「2000-01-31」を、その日の 0 時（日本時間）の UNIX ミリ秒にする。おかしな日付・未来・1900 年より前は null
export function parseBirthday(value: string, nowMs: number): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return null;
    }
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const utc = Date.UTC(year, month - 1, day);
    const check = new Date(utc);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || year < 1900) {
        return null;
    }
    // 日本時間の 0 時（UTC の前日 15 時）
    const birthMs = utc - 9 * HOUR;
    return birthMs > nowMs ? null : birthMs;
}

// その月の日数（month は 1〜12）
export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 日本時間での今日の年・月・日
export function todayInJapan(nowMs: number): { year: number; month: number; day: number } {
    const date = new Date(nowMs + 9 * HOUR);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

// 今の年齢から、生まれた年の候補を求める（新しい年から順）
// 誕生日（月・日）が分かっていれば、今年の誕生日を過ぎたかで 1 つに決まる。分からなければ 2 つ
export function birthYearCandidates(age: number, nowMs: number, month: number | null = null, day: number | null = null): number[] {
    const today = todayInJapan(nowMs);
    const passed = today.year - age;
    const notYet = passed - 1;
    if (month === null || day === null) {
        return [passed, notYet].filter((year) => year >= 1900);
    }
    const birthdayPassed = month < today.month || (month === today.month && day <= today.day);
    const year = birthdayPassed ? passed : notYet;
    return year >= 1900 ? [year] : [];
}
