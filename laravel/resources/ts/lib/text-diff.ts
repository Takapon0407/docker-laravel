import { graphemes, normalizeNewlines } from "./char-count.ts";

// テキスト差分：2 つの文章の違いを、行単位で出し、変わった行の中は文字単位で印を付ける（ブラウザの中だけで使う）
// 差分は Myers のアルゴリズム（An O(ND) Difference Algorithm）で、変更が最も少なくなる組み合わせを探す

export type EditType = "equal" | "delete" | "insert";

// 1 要素ごとの操作。a・b は元の配列での位置（ないほうは -1）
export interface Edit {
    readonly type: EditType;
    readonly a: number;
    readonly b: number;
}

// 違い（D）がこれより多いときは、探すのをやめて「まるごと入れ替え」にする（時間とメモリが D の 2 乗で増えるため）
export const MAX_EDIT_DISTANCE = 2000;

export interface SequenceDiff {
    readonly edits: Edit[];
    // 違いが多すぎて、最小の組み合わせを探しきれなかった
    readonly approximate: boolean;
}

export function diffSequences<T>(a: readonly T[], b: readonly T[], equals: (x: T, y: T) => boolean = (x, y) => x === y, maxDistance = MAX_EDIT_DISTANCE): SequenceDiff {
    // 前後の同じ部分は先に取り除く（よくある「一部だけ変えた」ときに速くなる）
    let prefix = 0;
    while (prefix < a.length && prefix < b.length && equals(a[prefix]!, b[prefix]!)) {
        prefix++;
    }
    let suffix = 0;
    while (suffix < a.length - prefix && suffix < b.length - prefix && equals(a[a.length - 1 - suffix]!, b[b.length - 1 - suffix]!)) {
        suffix++;
    }

    const edits: Edit[] = [];
    for (let i = 0; i < prefix; i++) {
        edits.push({ type: "equal", a: i, b: i });
    }
    const middle = myers(a.slice(prefix, a.length - suffix), b.slice(prefix, b.length - suffix), equals, maxDistance);
    const approximate = middle === null;
    for (const edit of middle ?? replaceAll(a.length - prefix - suffix, b.length - prefix - suffix)) {
        edits.push({ type: edit.type, a: edit.a < 0 ? -1 : edit.a + prefix, b: edit.b < 0 ? -1 : edit.b + prefix });
    }
    for (let i = suffix; i > 0; i--) {
        edits.push({ type: "equal", a: a.length - i, b: b.length - i });
    }
    return { edits, approximate };
}

function replaceAll(n: number, m: number): Edit[] {
    return [...Array.from({ length: n }, (_, i): Edit => ({ type: "delete", a: i, b: -1 })), ...Array.from({ length: m }, (_, i): Edit => ({ type: "insert", a: -1, b: i }))];
}

// 編集グラフで、x（a の位置）・y（b の位置）を右（削除）・下（追加）・斜め（同じ）に進み、(0,0) から (N,M) までの最短の道を探す
// v[k] は、対角線 k（= x - y）で、d 回の変更で届くいちばん遠い x。d ごとに v の写し（-d〜d の範囲）を残し、最後に道をたどり直す
function myers<T>(a: readonly T[], b: readonly T[], equals: (x: T, y: T) => boolean, maxDistance: number): Edit[] | null {
    const n = a.length;
    const m = b.length;
    if (n === 0 || m === 0) {
        return replaceAll(n, m);
    }
    const max = n + m;
    const offset = max;
    const v = new Int32Array(2 * max + 2);
    const trace: Int32Array[] = [];

    for (let d = 0; d <= Math.min(max, maxDistance); d++) {
        for (let k = -d; k <= d; k += 2) {
            // 上の対角線から下に進む（追加）か、下の対角線から右に進む（削除）か、遠くまで行けるほうを選ぶ
            let x = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!) ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
            let y = x - k;
            while (x < n && y < m && equals(a[x]!, b[y]!)) {
                x++;
                y++;
            }
            v[offset + k] = x;
            if (x >= n && y >= m) {
                trace.push(v.slice(offset - d, offset + d + 1));
                return backtrack(trace, n, m);
            }
        }
        trace.push(v.slice(offset - d, offset + d + 1));
    }
    return null;
}

function backtrack(trace: Int32Array[], n: number, m: number): Edit[] {
    const edits: Edit[] = [];
    let x = n;
    let y = m;
    for (let d = trace.length - 1; d > 0; d--) {
        const previous = trace[d - 1]!;
        // 1 つ前（d - 1 回目）の v。範囲は -(d - 1)〜d - 1
        const at = (k: number): number => previous[k + d - 1]!;
        const k = x - y;
        const previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
        const previousX = at(previousK);
        const previousY = previousX - previousK;
        // 斜め（同じ要素）を、変更した直後の点まで戻る
        while (x > previousX && y > previousY) {
            x--;
            y--;
            edits.push({ type: "equal", a: x, b: y });
        }
        if (previousK === k + 1) {
            y--;
            edits.push({ type: "insert", a: -1, b: y });
        } else {
            x--;
            edits.push({ type: "delete", a: x, b: -1 });
        }
    }
    while (x > 0 && y > 0) {
        x--;
        y--;
        edits.push({ type: "equal", a: x, b: y });
    }
    return edits.reverse();
}

// ---- 行単位の差分 ----

export interface DiffPart {
    readonly text: string;
    readonly changed: boolean;
}

export interface DiffLine {
    readonly type: EditType;
    // 行番号（1 から。ないほうは null）
    readonly oldNumber: number | null;
    readonly newNumber: number | null;
    readonly text: string;
    // 変わった行の中で、変わった文字に印を付けたもの（対になる行がないとき・変わりすぎているときは null）
    readonly parts: DiffPart[] | null;
}

export interface TextDiff {
    readonly lines: DiffLine[];
    readonly added: number;
    readonly removed: number;
    readonly approximate: boolean;
}

export interface DiffOptions {
    // 空白の数や行頭・行末の空白の違いを無視する
    readonly ignoreWhitespace?: boolean;
}

// 文字単位の印を付ける行の長さの上限（長い行どうしの比較で固まらないように）
const MAX_INLINE_LENGTH = 2000;

export function splitLines(text: string): string[] {
    return text === "" ? [] : normalizeNewlines(text).split("\n");
}

export function diffText(oldText: string, newText: string, options: DiffOptions = {}): TextDiff {
    const oldLines = splitLines(oldText);
    const newLines = splitLines(newText);
    const key = options.ignoreWhitespace ? (line: string) => line.replace(/\s+/g, " ").trim() : (line: string) => line;
    const oldKeys = oldLines.map(key);
    const newKeys = newLines.map(key);
    const { edits, approximate } = diffSequences(oldKeys, newKeys);

    const lines: DiffLine[] = [];
    let added = 0;
    let removed = 0;
    // 続けて削除・追加された行をまとめ、削除した行を先、追加した行を後に並べる。i 番目どうしを対にして文字単位で比べる
    let deleted: number[] = [];
    let inserted: number[] = [];
    const flush = (): void => {
        const pairs = Math.min(deleted.length, inserted.length);
        const inline = deleted.map((a, i) => (i < pairs ? inlineDiff(oldLines[a]!, newLines[inserted[i]!]!) : null));
        deleted.forEach((a, i) => lines.push({ type: "delete", oldNumber: a + 1, newNumber: null, text: oldLines[a]!, parts: inline[i]?.old ?? null }));
        inserted.forEach((b, i) => lines.push({ type: "insert", oldNumber: null, newNumber: b + 1, text: newLines[b]!, parts: inline[i]?.new ?? null }));
        removed += deleted.length;
        added += inserted.length;
        deleted = [];
        inserted = [];
    };
    for (const edit of edits) {
        if (edit.type === "delete") {
            deleted.push(edit.a);
        } else if (edit.type === "insert") {
            inserted.push(edit.b);
        } else {
            flush();
            // 空白を無視したときは、新しいほうの行を見せる
            lines.push({ type: "equal", oldNumber: edit.a + 1, newNumber: edit.b + 1, text: newLines[edit.b]!, parts: null });
        }
    }
    flush();
    return { lines, added, removed, approximate };
}

// 対になった 2 行を文字（見た目の 1 文字）単位で比べる。同じ文字が半分より少ないときは、印を付けても読みにくいので付けない
export function inlineDiff(oldLine: string, newLine: string): { old: DiffPart[]; new: DiffPart[] } | null {
    if (oldLine.length > MAX_INLINE_LENGTH || newLine.length > MAX_INLINE_LENGTH) {
        return null;
    }
    const a = graphemes(oldLine);
    const b = graphemes(newLine);
    const { edits, approximate } = diffSequences(a, b);
    const same = edits.filter((edit) => edit.type === "equal").length;
    if (approximate || same * 2 < Math.max(a.length, b.length)) {
        return null;
    }
    const oldParts: DiffPart[] = [];
    const newParts: DiffPart[] = [];
    for (const edit of edits) {
        if (edit.type !== "insert") {
            append(oldParts, a[edit.a]!, edit.type === "delete");
        }
        if (edit.type !== "delete") {
            append(newParts, b[edit.b]!, edit.type === "insert");
        }
    }
    return { old: oldParts, new: newParts };
}

// 同じ種類が続くときは 1 つにまとめる
function append(parts: DiffPart[], text: string, changed: boolean): void {
    const last = parts.at(-1);
    if (last?.changed === changed) {
        parts[parts.length - 1] = { text: last.text + text, changed };
    } else {
        parts.push({ text, changed });
    }
}

// ---- 変わっていない行をたたむ ----

export type FoldedItem = { readonly kind: "line"; readonly line: DiffLine } | { readonly kind: "skip"; readonly count: number };

// 変わった行の前後 context 行だけを残し、それより離れた変わっていない行は「◯ 行省略」にまとめる
export function foldUnchanged(lines: readonly DiffLine[], context = 3): FoldedItem[] {
    const keep = lines.map((line) => line.type !== "equal");
    lines.forEach((line, i) => {
        if (line.type !== "equal") {
            for (let j = Math.max(0, i - context); j <= Math.min(lines.length - 1, i + context); j++) {
                keep[j] = true;
            }
        }
    });
    const items: FoldedItem[] = [];
    let skipped = 0;
    lines.forEach((line, i) => {
        if (keep[i]) {
            if (skipped > 0) {
                items.push({ kind: "skip", count: skipped });
                skipped = 0;
            }
            items.push({ kind: "line", line });
        } else {
            skipped++;
        }
    });
    if (skipped > 0) {
        items.push({ kind: "skip", count: skipped });
    }
    return items;
}
