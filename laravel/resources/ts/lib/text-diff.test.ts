import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSequences, diffText, foldUnchanged, inlineDiff, type Edit } from "./text-diff.ts";

// 差分から元の 2 つを組み立て直す（順番どおりに a・b を 1 つずつ使い切っていること）
function rebuild<T>(edits: readonly Edit[], a: readonly T[], b: readonly T[]): { a: T[]; b: T[] } {
    const left: T[] = [];
    const right: T[] = [];
    for (const edit of edits) {
        if (edit.type !== "insert") {
            assert.equal(edit.a, left.length);
            left.push(a[edit.a]!);
        }
        if (edit.type !== "delete") {
            assert.equal(edit.b, right.length);
            right.push(b[edit.b]!);
        }
        if (edit.type === "equal") {
            assert.equal(a[edit.a], b[edit.b]);
        }
    }
    return { a: left, b: right };
}

// 最小の変更の数（= N + M - 2 × 最長共通部分列の長さ）を、表を埋める方法で求める
function minimumEdits<T>(a: readonly T[], b: readonly T[]): number {
    const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            table[i]![j] = a[i - 1] === b[j - 1] ? table[i - 1]![j - 1]! + 1 : Math.max(table[i - 1]![j]!, table[i]![j - 1]!);
        }
    }
    return a.length + b.length - 2 * table[a.length]![b.length]!;
}

test("差分：よくある例（ABCABBA → CBABAC）で、変更が最も少ない組み合わせを返す", () => {
    const a = [..."ABCABBA"];
    const b = [..."CBABAC"];
    const { edits, approximate } = diffSequences(a, b);
    assert.equal(approximate, false);
    assert.deepEqual(rebuild(edits, a, b), { a, b });
    assert.equal(edits.filter((edit) => edit.type !== "equal").length, 5);
});

test("差分：空・同じ・まるごと違うとき", () => {
    assert.deepEqual(diffSequences([], []).edits, []);
    assert.deepEqual(
        diffSequences(["a"], []).edits.map((edit) => edit.type),
        ["delete"],
    );
    assert.deepEqual(
        diffSequences([], ["a", "b"]).edits.map((edit) => edit.type),
        ["insert", "insert"],
    );
    assert.deepEqual(
        diffSequences(["a", "b"], ["a", "b"]).edits.map((edit) => edit.type),
        ["equal", "equal"],
    );
    assert.deepEqual(
        diffSequences(["a"], ["b"]).edits.map((edit) => edit.type),
        ["delete", "insert"],
    );
});

test("差分：ランダムな組み合わせでも、元に戻せて、変更の数が最小になる", () => {
    // 毎回同じ結果になるよう、乱数の種を決める
    let seed = 42;
    const random = (): number => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return seed / 2 ** 31;
    };
    for (let round = 0; round < 300; round++) {
        const a = Array.from({ length: Math.floor(random() * 15) }, () => "abc"[Math.floor(random() * 3)]!);
        const b = Array.from({ length: Math.floor(random() * 15) }, () => "abc"[Math.floor(random() * 3)]!);
        const { edits } = diffSequences(a, b);
        assert.deepEqual(rebuild(edits, a, b), { a, b }, `${a.join("")} → ${b.join("")}`);
        assert.equal(edits.filter((edit) => edit.type !== "equal").length, minimumEdits(a, b), `${a.join("")} → ${b.join("")}`);
    }
});

test("差分：違いが多すぎるときは探すのをやめ、まるごと入れ替える", () => {
    const a = ["a", "b", "c", "d"];
    const b = ["w", "x", "y", "z"];
    const { edits, approximate } = diffSequences(a, b, undefined, 2);
    assert.equal(approximate, true);
    assert.deepEqual(rebuild(edits, a, b), { a, b });
});

test("行の差分：変わった行は削除を先・追加を後に並べ、行番号と追加・削除の数を出す", () => {
    const result = diffText("one\ntwo\nthree\nfour", "one\n2\nthree\nfour\nfive");
    assert.deepEqual(
        result.lines.map((line) => [line.type, line.oldNumber, line.newNumber, line.text]),
        [
            ["equal", 1, 1, "one"],
            ["delete", 2, null, "two"],
            ["insert", null, 2, "2"],
            ["equal", 3, 3, "three"],
            ["equal", 4, 4, "four"],
            ["insert", null, 5, "five"],
        ],
    );
    assert.equal(result.added, 2);
    assert.equal(result.removed, 1);
});

test("行の差分：CRLF と LF の違いは差分にしない", () => {
    const result = diffText("a\r\nb", "a\nb");
    assert.equal(result.added + result.removed, 0);
});

test("行の差分：空白の違いを無視できる", () => {
    assert.equal(diffText("const a = 1;", "  const  a = 1;  ").removed, 1);
    const ignored = diffText("const a = 1;", "  const  a = 1;  ", { ignoreWhitespace: true });
    assert.equal(ignored.removed + ignored.added, 0);
    // 見せるのは新しいほうの行
    assert.equal(ignored.lines[0]!.text, "  const  a = 1;  ");
});

test("行の差分：対になった行は、変わった文字に印を付ける", () => {
    const [removed, added] = diffText("今日は晴れです", "今日は雨です").lines;
    assert.deepEqual(removed!.parts, [
        { text: "今日は", changed: false },
        { text: "晴れ", changed: true },
        { text: "です", changed: false },
    ]);
    assert.deepEqual(added!.parts, [
        { text: "今日は", changed: false },
        { text: "雨", changed: true },
        { text: "です", changed: false },
    ]);
});

test("文字の差分：絵文字は 1 文字として比べ、ほとんど違うときは印を付けない", () => {
    assert.deepEqual(inlineDiff("👨‍👩‍👧 a", "👨‍👩‍👦 a")?.new, [
        { text: "👨‍👩‍👦", changed: true },
        { text: " a", changed: false },
    ]);
    assert.equal(inlineDiff("abcdef", "uvwxyz"), null);
});

test("たたむ：変わった行の前後だけを残し、離れた変わっていない行は省略した数にまとめる", () => {
    const old = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const changed = old.map((line, i) => (i === 9 ? "changed" : line));
    const items = foldUnchanged(diffText(old.join("\n"), changed.join("\n")).lines, 2);
    assert.deepEqual(
        items.map((item) => (item.kind === "skip" ? `skip ${item.count}` : `${item.line.type} ${item.line.text}`)),
        ["skip 7", "equal line 8", "equal line 9", "delete line 10", "insert changed", "equal line 11", "equal line 12", "skip 8"],
    );
    // 変わったところがなければ、まるごと省略
    assert.deepEqual(foldUnchanged(diffText("a\nb", "a\nb").lines), [{ kind: "skip", count: 2 }]);
});
