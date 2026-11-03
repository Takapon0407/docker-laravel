// 日時の文字列・UNIX 時間を読み取り、UTC / JST などの形にする

// タイムゾーンが書かれていない日時（2026-11-04 12:00 など）をどこの時刻として読むか
export type BaseZone = "jst" | "utc";

// 何として読んだか（画面に「UNIX 時間（秒）として読みました」などと出す）
export type InputKind = "unix-seconds" | "unix-milliseconds" | "with-offset" | "without-offset";

export type ParseResult = { ok: true; epochMs: number; kind: InputKind } | { ok: false; message: string };

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// UNIX 時間で、ミリ秒とみなす桁数（10 桁なら秒、13 桁ならミリ秒。2001 年〜2286 年の秒は 10 桁）
const MILLISECONDS_DIGITS = 12;

// Date で扱える範囲（±1 億日。JST にずらしても収まるよう 9 時間分を引く）
const MAX_EPOCH_MS = 8.64e15 - JST_OFFSET_MS;

export function parseInstant(input: string, baseZone: BaseZone): ParseResult {
    const text = input.trim();
    if (text === "") {
        return { ok: false, message: "日時か UNIX 時間を入力してください" };
    }

    if (/^-?\d+(\.\d+)?$/.test(text)) {
        const digits = text.replace(/^-/, "").split(".")[0]!.length;
        const milliseconds = digits >= MILLISECONDS_DIGITS;
        const epochMs = Number(text) * (milliseconds ? 1 : 1000);
        return inRange(Math.round(epochMs), milliseconds ? "unix-milliseconds" : "unix-seconds");
    }

    // 2026-11-04T12:00:00Z / 2026/11/04 12:00:00.123+09:00 / 2026-11-04 など
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(text);
    if (!match) {
        return { ok: false, message: "読み取れない形です。例：1793723608 / 2026-11-04T12:00:00Z / 2026-11-04 21:00" };
    }
    const [, year, month, day, hour = "0", minute = "0", second = "0", fraction = "0", offset] = match;
    const parts = [year, month, day, hour, minute, second].map(Number) as [number, number, number, number, number, number];
    const milliseconds = Number(fraction.padEnd(3, "0").slice(0, 3));
    const local = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], milliseconds);
    // 2 月 30 日や 25 時のように、繰り上がってしまう値は断る
    const check = new Date(local);
    if (
        check.getUTCFullYear() !== parts[0] ||
        check.getUTCMonth() !== parts[1] - 1 ||
        check.getUTCDate() !== parts[2] ||
        check.getUTCHours() !== parts[3] ||
        check.getUTCMinutes() !== parts[4] ||
        check.getUTCSeconds() !== parts[5]
    ) {
        return { ok: false, message: "存在しない日時です" };
    }

    if (offset !== undefined) {
        return inRange(local - offsetMs(offset), "with-offset");
    }
    return inRange(baseZone === "jst" ? local - JST_OFFSET_MS : local, "without-offset");
}

function offsetMs(offset: string): number {
    if (offset.toUpperCase() === "Z") {
        return 0;
    }
    const [, sign, hours, minutes] = /^([+-])(\d{2}):?(\d{2})$/.exec(offset)!;
    return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes)) * 60 * 1000;
}

function inRange(epochMs: number, kind: InputKind): ParseResult {
    if (!Number.isFinite(epochMs) || Math.abs(epochMs) > MAX_EPOCH_MS) {
        return { ok: false, message: "扱える範囲を超えています" };
    }
    return { ok: true, epochMs, kind };
}

export interface Formatted {
    // 2026-11-04T03:00:00.000Z
    utcIso: string;
    // 2026-11-04 03:00:00（水）
    utc: string;
    // 2026-11-04T12:00:00.000+09:00
    jstIso: string;
    // 2026-11-04 12:00:00（水）
    jst: string;
    unixSeconds: string;
    unixMilliseconds: string;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function formatInstant(epochMs: number): Formatted {
    const utc = new Date(epochMs);
    // JST は夏時間がないので、9 時間ずらして UTC として読む
    const jst = new Date(epochMs + JST_OFFSET_MS);
    return {
        utcIso: utc.toISOString(),
        utc: readable(utc),
        jstIso: jst.toISOString().replace("Z", "+09:00"),
        jst: readable(jst),
        unixSeconds: String(Math.floor(epochMs / 1000)),
        unixMilliseconds: String(epochMs),
    };
}

function readable(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${year}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}（${WEEKDAYS[date.getUTCDay()]}）`;
}
