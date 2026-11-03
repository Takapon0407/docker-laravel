// 正規表現を試す：一致した場所・キャプチャグループ・置換した結果を求める
// 時間のかかるパターンで画面が固まらないよう、ページからは Web Worker（regex-worker.ts）の中で呼ぶ

// 選べるフラグ（d・y・v は使う場面が少ないので出さない）
export const FLAGS = ["g", "i", "m", "s", "u"] as const;
export type Flag = (typeof FLAGS)[number];

// 一覧に出す一致の数の上限（それより多いときは数だけ返す）
export const MAX_MATCHES = 1000;

export interface RegexInput {
    pattern: string;
    flags: Flag[];
    text: string;
    // null なら置換しない
    replacement: string | null;
}

export interface MatchView {
    // 何文字目から何文字目まで（JavaScript の文字列の位置。end は含まない）
    start: number;
    end: number;
    text: string;
    // $1, $2, ...（一致しなかったグループは null）
    groups: (string | null)[];
    // (?<name>...) のグループ
    named: Record<string, string | null>;
}

export type RegexResult =
    | { ok: true; matches: MatchView[]; total: number; truncated: boolean; replaced: string | null }
    | { ok: false; message: string };

export function runRegex(input: RegexInput): RegexResult {
    let regex: RegExp;
    try {
        regex = new RegExp(input.pattern, [...new Set(input.flags)].filter((flag) => FLAGS.includes(flag)).join(""));
    } catch (error) {
        return { ok: false, message: `正規表現の書き方が正しくありません（${error instanceof Error ? error.message : String(error)}）` };
    }

    const matches: MatchView[] = [];
    let total = 0;
    if (regex.global) {
        for (const match of input.text.matchAll(regex)) {
            total++;
            if (matches.length < MAX_MATCHES) {
                matches.push(view(match));
            }
        }
    } else {
        const match = regex.exec(input.text);
        if (match) {
            total = 1;
            matches.push(view(match));
        }
    }

    return {
        ok: true,
        matches,
        total,
        truncated: total > matches.length,
        replaced: input.replacement === null ? null : input.text.replace(regex, input.replacement),
    };
}

function view(match: RegExpExecArray | RegExpMatchArray): MatchView {
    const start = match.index ?? 0;
    return {
        start,
        end: start + match[0].length,
        text: match[0],
        groups: match.slice(1).map((group) => group ?? null),
        named: Object.fromEntries(Object.entries(match.groups ?? {}).map(([name, value]) => [name, value ?? null])),
    };
}

// 一致した場所に印を付けて表示するため、文字列を一致した部分とそれ以外に分ける
// （g がなくても、一致は重ならず start の順に並んでいる）
export function splitByMatches(text: string, matches: Pick<MatchView, "start" | "end">[]): { text: string; matched: boolean }[] {
    const parts: { text: string; matched: boolean }[] = [];
    let position = 0;
    for (const match of matches) {
        // 長さ 0 の一致（^ や \b など）は印を付けられないので飛ばす
        if (match.end === match.start) {
            continue;
        }
        if (match.start > position) {
            parts.push({ text: text.slice(position, match.start), matched: false });
        }
        parts.push({ text: text.slice(match.start, match.end), matched: true });
        position = match.end;
    }
    if (position < text.length) {
        parts.push({ text: text.slice(position), matched: false });
    }
    return parts;
}
