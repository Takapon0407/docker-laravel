// 今年の残り・祝日・自分で決めた日までの日数（日付は日本時間で数える）
import { holidaysOf } from "./holidays.ts";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Clock {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

export interface Upcoming {
    year: number;
    month: number;
    day: number;
    // その日の 0 時（日本時間）
    startMs: number;
    // 今日なら 0
    daysLeft: number;
}

// 日本時間でのその日の 0 時
export function japanMidnight(year: number, month: number, day: number): number {
    return Date.UTC(year, month - 1, day) - JST_OFFSET_MS;
}

export function japanToday(nowMs: number): { year: number; month: number; day: number } {
    const date = new Date(nowMs + JST_OFFSET_MS);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function clock(ms: number): Clock {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return {
        days: Math.floor(seconds / 86400),
        hours: Math.floor((seconds % 86400) / 3600),
        minutes: Math.floor((seconds % 3600) / 60),
        seconds: seconds % 60,
    };
}

// 今年の残り（来年の元日 0 時まで）と、今年のうち過ぎた割合（0〜1）
export function yearRemaining(nowMs: number): { year: number; remaining: Clock; progress: number } {
    const { year } = japanToday(nowMs);
    const start = japanMidnight(year, 1, 1);
    const end = japanMidnight(year + 1, 1, 1);
    return { year, remaining: clock(end - nowMs), progress: (nowMs - start) / (end - start) };
}

function upcoming(year: number, month: number, day: number, nowMs: number): Upcoming {
    const today = japanToday(nowMs);
    const daysLeft = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(today.year, today.month - 1, today.day)) / DAY_MS);
    return { year, month, day, startMs: japanMidnight(year, month, day), daysLeft };
}

function exists(year: number, month: number, day: number): boolean {
    return new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day;
}

// 毎年の月・日が次に来る日（今日なら今日。2 月 29 日は次のうるう年）
export function nextOccurrence(month: number, day: number, nowMs: number): Upcoming {
    const today = japanToday(nowMs);
    let year = today.year;
    if (month < today.month || (month === today.month && day < today.day)) {
        year++;
    }
    while (!exists(year, month, day)) {
        year++;
    }
    return upcoming(year, month, day, nowMs);
}

// 今日から 1 年のうちの祝日（今日の祝日も含む）
export function upcomingHolidays(nowMs: number): (Upcoming & { name: string })[] {
    const today = japanToday(nowMs);
    return [today.year, today.year + 1]
        .flatMap((year) => holidaysOf(year).map((holiday) => ({ ...upcoming(year, holiday.month, holiday.day, nowMs), name: holiday.name })))
        .filter(({ daysLeft }) => daysLeft >= 0 && daysLeft < 365);
}

// 自分で決めた日（毎年の月・日に名前を付ける）。localStorage に残す
export interface CustomDay {
    name: string;
    month: number;
    day: number;
}

export const MAX_CUSTOM_DAYS = 20;
export const MAX_NAME_LENGTH = 30;

export function isValidCustomDay(value: unknown): value is CustomDay {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const { name, month, day } = value as Record<string, unknown>;
    return (
        typeof name === "string" &&
        name.trim() !== "" &&
        [...name].length <= MAX_NAME_LENGTH &&
        Number.isInteger(month) &&
        Number.isInteger(day) &&
        // 2 月 29 日も選べるよう、うるう年で確かめる
        (month as number) >= 1 &&
        (month as number) <= 12 &&
        (day as number) >= 1 &&
        exists(2000, month as number, day as number)
    );
}

// 読めない値は空、おかしな日だけを除く
export function parseCustomDays(json: string | null): CustomDay[] {
    let value: unknown;
    try {
        value = JSON.parse(json ?? "[]");
    } catch {
        return [];
    }
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(isValidCustomDay).slice(0, MAX_CUSTOM_DAYS).map(({ name, month, day }) => ({ name, month, day }));
}

// 今の季節（気象庁の決まり：春 3〜5 月・夏 6〜8 月・秋 9〜11 月・冬 12〜2 月）
export interface Season {
    name: "春" | "夏" | "秋" | "冬";
    // 季節のはじめの日の 0 時と、次の季節のはじめの日の 0 時（日本時間）
    startMs: number;
    endMs: number;
    // 最後の日（例：秋なら 11 月 30 日）
    lastDay: { year: number; month: number; day: number };
    // 今日を含めた残りの日数（最後の日なら 1）
    daysLeft: number;
    // 季節のうち過ぎた割合（0〜1）
    progress: number;
}

const SEASONS = [
    { name: "春", startMonth: 3 },
    { name: "夏", startMonth: 6 },
    { name: "秋", startMonth: 9 },
    { name: "冬", startMonth: 12 },
] as const;

export function seasonOf(nowMs: number): Season {
    const today = japanToday(nowMs);
    // 1・2 月は前の年の 12 月から始まる冬
    const index = today.month < 3 ? 3 : Math.floor((today.month - 3) / 3);
    const season = SEASONS[index]!;
    const startYear = today.month < 3 ? today.year - 1 : today.year;
    const startMs = japanMidnight(startYear, season.startMonth, 1);
    // 次の季節のはじめ（Date.UTC は 13 月以降を次の年に繰り上げる）
    const end = new Date(Date.UTC(startYear, season.startMonth - 1 + 3, 1));
    const endMs = end.getTime() - JST_OFFSET_MS;
    const last = new Date(end.getTime() - DAY_MS);
    const lastDay = { year: last.getUTCFullYear(), month: last.getUTCMonth() + 1, day: last.getUTCDate() };
    return {
        name: season.name,
        startMs,
        endMs,
        lastDay,
        daysLeft: Math.round((end.getTime() - Date.UTC(today.year, today.month - 1, today.day)) / DAY_MS),
        progress: (nowMs - startMs) / (endMs - startMs),
    };
}
