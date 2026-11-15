// 文字数カウント：文章の文字数を、いろいろな数え方で数える（ブラウザの中だけで使う）
// 「文字」は見た目の 1 文字（書記素クラスタ）で数える。絵文字（👨‍👩‍👧 など）や濁点を組み合わせた文字も 1 文字

export interface CharCount {
    // 改行を含む文字数
    readonly total: number;
    // 改行を除いた文字数
    readonly withoutNewlines: number;
    // 空白（全角・半角のスペース、タブ）と改行を除いた文字数
    readonly withoutSpaces: number;
    // 全角・半角の文字数（改行は含めない）
    readonly fullWidth: number;
    readonly halfWidth: number;
    // 行数（空のときは 0）
    readonly lines: number;
    // UTF-8 でのバイト数（改行は LF の 1 バイト）
    readonly bytes: number;
    // X（旧 Twitter）の数え方での長さ（全角は 2、URL は 23）と、その上限
    readonly x: number;
    // 400 字詰め原稿用紙で使う行数と枚数（目安）
    readonly manuscriptLines: number;
    readonly manuscriptPages: number;
}

export const X_LIMIT = 280;
// X は URL を長さによらず 23 として数える
export const X_URL_LENGTH = 23;
export const MANUSCRIPT_COLUMNS = 20;
export const MANUSCRIPT_ROWS = 20;

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

// 書記素クラスタ（見た目の 1 文字）に分ける。改行の CRLF・CR は LF にそろえてから数える
export function graphemes(text: string): string[] {
    return Array.from(segmenter.segment(normalizeNewlines(text)), (segment) => segment.segment);
}

export function normalizeNewlines(text: string): string {
    return text.replace(/\r\n?/g, "\n");
}

const SPACES = new Set([" ", "　", "\t"]);

// 半角として数える文字：ASCII（スペースを含む）と半角カタカナ
export function isHalfWidth(grapheme: string): boolean {
    if (grapheme.length !== 1) {
        return false;
    }
    const code = grapheme.charCodeAt(0);
    return (code >= 0x20 && code <= 0x7e) || code === 0x09 || (code >= 0xff61 && code <= 0xff9f);
}

export function countChars(text: string): CharCount {
    const normalized = normalizeNewlines(text);
    const chars = graphemes(normalized);
    const newlines = chars.filter((c) => c === "\n").length;
    const halfWidth = chars.filter(isHalfWidth).length;
    const lines = normalized === "" ? 0 : newlines + 1;
    const manuscriptLines = countManuscriptLines(normalized);

    return {
        total: chars.length,
        withoutNewlines: chars.length - newlines,
        withoutSpaces: chars.filter((c) => c !== "\n" && !SPACES.has(c)).length,
        fullWidth: chars.length - newlines - halfWidth,
        halfWidth,
        lines,
        bytes: new TextEncoder().encode(normalized).length,
        x: countX(normalized),
        manuscriptLines,
        manuscriptPages: Math.ceil(manuscriptLines / MANUSCRIPT_ROWS),
    };
}

// 原稿用紙（1 行 20 マス）：段落（改行で区切った行）ごとに 20 マスで折り返す。空の段落も 1 行使う
// 禁則（行頭の句読点をぶら下げるなど）や字下げは数えないので、目安
export function countManuscriptLines(text: string): number {
    if (text === "") {
        return 0;
    }
    return normalizeNewlines(text)
        .split("\n")
        .reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(graphemes(paragraph).length / MANUSCRIPT_COLUMNS)), 0);
}

// X（旧 Twitter）の数え方（twitter-text の v3 の設定）
// 下の範囲の文字は 1、それ以外（漢字・かな・全角記号など）は 2。絵文字は組み合わせても 1 つで 2。URL は 23
const X_LIGHT_RANGES: readonly (readonly [number, number])[] = [
    [0x0000, 0x10ff],
    [0x2000, 0x200d],
    [0x2010, 0x201f],
    [0x2032, 0x2037],
];
const URL_PATTERN = /https?:\/\/[^\s]+/g;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

export function countX(text: string): number {
    const normalized = normalizeNewlines(text).normalize("NFC");
    const urls = normalized.match(URL_PATTERN) ?? [];
    const rest = normalized.replace(URL_PATTERN, "");
    let weight = urls.length * X_URL_LENGTH;
    for (const grapheme of graphemes(rest)) {
        if (EMOJI.test(grapheme)) {
            weight += 2;
            continue;
        }
        for (const char of grapheme) {
            const code = char.codePointAt(0)!;
            weight += X_LIGHT_RANGES.some(([from, to]) => code >= from && code <= to) ? 1 : 2;
        }
    }
    return weight;
}

// X の投稿画面（Web Intent）を、文章を入れた状態で開く URL。投稿するかどうかは X の画面で本人が決める
export const X_INTENT_URL = "https://x.com/intent/post";

export function xIntentUrl(text: string): string {
    return `${X_INTENT_URL}?text=${encodeURIComponent(normalizeNewlines(text))}`;
}
