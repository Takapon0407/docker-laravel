// JSON を整形・圧縮する
// JSON.parse で読み直すと大きな整数（ID など）の桁が落ちたり、数値の書き方（1.0 など）が変わったりするため、
// 元の文字をそのまま使って並べ直す。形が正しくないときは、どのブラウザでも同じ場所を示せるよう自分で調べる

export type Indent = 2 | 4 | "tab";

export type FormatResult = { ok: true; text: string } | { ok: false; message: string; line: number; column: number };

class JsonSyntaxError extends Error {
    readonly offset: number;

    constructor(message: string, offset: number) {
        super(message);
        this.offset = offset;
    }
}

// indent が null なら 1 行に詰める
export function formatJson(source: string, indent: Indent | null): FormatResult {
    try {
        return { ok: true, text: new Formatter(source, indent).run() };
    } catch (error) {
        if (!(error instanceof JsonSyntaxError)) {
            throw error;
        }
        const { line, column } = position(source, error.offset);
        return { ok: false, message: error.message, line, column };
    }
}

// 何文字目かを、1 から数える行・列にする
function position(source: string, offset: number): { line: number; column: number } {
    const before = source.slice(0, offset);
    const lines = before.split("\n");
    return { line: lines.length, column: lines.at(-1)!.length + 1 };
}

class Formatter {
    private index = 0;
    private readonly source: string;
    private readonly indent: Indent | null;
    private readonly unit: string;

    constructor(source: string, indent: Indent | null) {
        this.source = source;
        this.indent = indent;
        this.unit = indent === "tab" ? "\t" : " ".repeat(indent ?? 0);
    }

    run(): string {
        this.skipSpace();
        if (this.index >= this.source.length) {
            throw new JsonSyntaxError("JSON が空です", this.index);
        }
        const text = this.value(0);
        this.skipSpace();
        if (this.index < this.source.length) {
            throw new JsonSyntaxError("JSON のあとに余分な文字があります", this.index);
        }
        return text;
    }

    private value(depth: number): string {
        const char = this.source[this.index];
        if (char === "{") {
            return this.container(depth, "{", "}", () => {
                const key = this.string();
                this.skipSpace();
                this.expect(":", "「:」が必要です");
                this.skipSpace();
                return `${key}:${this.indent === null ? "" : " "}${this.value(depth + 1)}`;
            });
        }
        if (char === "[") {
            return this.container(depth, "[", "]", () => this.value(depth + 1));
        }
        if (char === '"') {
            return this.string();
        }
        if (char === "-" || (char !== undefined && char >= "0" && char <= "9")) {
            return this.number();
        }
        for (const word of ["true", "false", "null"]) {
            if (this.source.startsWith(word, this.index)) {
                this.index += word.length;
                return word;
            }
        }
        throw new JsonSyntaxError(char === undefined ? "JSON が途中で終わっています" : `ここに「${char}」は書けません`, this.index);
    }

    // オブジェクトと配列。中身が空なら {} / [] のまま
    private container(depth: number, open: string, close: string, item: () => string): string {
        this.index++;
        this.skipSpace();
        if (this.source[this.index] === close) {
            this.index++;
            return open + close;
        }
        const items: string[] = [];
        for (;;) {
            if (open === "{" && this.source[this.index] !== '"') {
                throw new JsonSyntaxError(this.index >= this.source.length ? "JSON が途中で終わっています" : "キーは「\"」で囲んだ文字列にします", this.index);
            }
            items.push(item());
            this.skipSpace();
            const char = this.source[this.index];
            if (char === ",") {
                this.index++;
                this.skipSpace();
                if (this.source[this.index] === close) {
                    throw new JsonSyntaxError(`最後の要素のあとの「,」は書けません`, this.index - 1);
                }
                continue;
            }
            if (char === close) {
                this.index++;
                break;
            }
            throw new JsonSyntaxError(char === undefined ? "JSON が途中で終わっています" : `「,」か「${close}」が必要です`, this.index);
        }
        if (this.indent === null) {
            return open + items.join(",") + close;
        }
        const inner = this.unit.repeat(depth + 1);
        return `${open}\n${items.map((text) => inner + text).join(",\n")}\n${this.unit.repeat(depth)}${close}`;
    }

    private string(): string {
        const start = this.index;
        this.index++;
        while (this.index < this.source.length) {
            const char = this.source[this.index]!;
            if (char === '"') {
                this.index++;
                return this.source.slice(start, this.index);
            }
            if (char === "\\") {
                const next = this.source[this.index + 1];
                if (next === "u") {
                    if (!/^[0-9a-fA-F]{4}$/.test(this.source.slice(this.index + 2, this.index + 6))) {
                        throw new JsonSyntaxError("「\\u」のあとには 16 進数を 4 桁書きます", this.index);
                    }
                    this.index += 6;
                    continue;
                }
                if (next === undefined || !'"\\/bfnrt'.includes(next)) {
                    throw new JsonSyntaxError("使えないエスケープ（\\）です", this.index);
                }
                this.index += 2;
                continue;
            }
            if (char < " ") {
                throw new JsonSyntaxError("文字列の中に改行やタブはそのまま書けません（\\n などにします）", this.index);
            }
            this.index++;
        }
        throw new JsonSyntaxError("文字列が「\"」で閉じられていません", start);
    }

    private number(): string {
        const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.index));
        if (!match) {
            throw new JsonSyntaxError("数値の書き方が正しくありません", this.index);
        }
        this.index += match[0].length;
        // 01 や 1. のように、正しい数値のすぐあとに数字や「.」が続くもの
        if (/^[0-9.]/.test(this.source[this.index] ?? "")) {
            throw new JsonSyntaxError("数値の書き方が正しくありません", this.index - match[0].length);
        }
        return match[0];
    }

    private expect(char: string, message: string): void {
        if (this.source[this.index] !== char) {
            throw new JsonSyntaxError(message, this.index);
        }
        this.index++;
    }

    private skipSpace(): void {
        while (" \t\n\r".includes(this.source[this.index] ?? "x")) {
            this.index++;
        }
    }
}
