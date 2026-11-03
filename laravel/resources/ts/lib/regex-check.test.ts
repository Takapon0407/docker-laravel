import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_MATCHES, runRegex, splitByMatches, type RegexInput } from "./regex-check.ts";

function input(overrides: Partial<RegexInput>): RegexInput {
    return { pattern: "", flags: ["g"], text: "", replacement: null, ...overrides };
}

test("g があれば、一致した場所とキャプチャグループをすべて返す", () => {
    const result = runRegex(input({ pattern: "(\\d{4})-(?<month>\\d{2})", text: "2026-11 と 2027-01" }));

    assert.deepEqual(result, {
        ok: true,
        total: 2,
        truncated: false,
        replaced: null,
        matches: [
            { start: 0, end: 7, text: "2026-11", groups: ["2026", "11"], named: { month: "11" } },
            { start: 10, end: 17, text: "2027-01", groups: ["2027", "01"], named: { month: "01" } },
        ],
    });
});

test("g がなければ、最初の 1 つだけ。一致しなかったグループは null", () => {
    const result = runRegex(input({ pattern: "a(b)?(c)", flags: [], text: "ac abc" }));

    assert.ok(result.ok);
    assert.equal(result.total, 1);
    assert.deepEqual(result.matches, [{ start: 0, end: 2, text: "ac", groups: [null, "c"], named: {} }]);
});

test("フラグ i・m・s・u が効く", () => {
    const count = (pattern: string, flags: RegexInput["flags"], text: string) => {
        const result = runRegex(input({ pattern, flags: ["g", ...flags], text }));
        return result.ok ? result.total : -1;
    };
    assert.equal(count("abc", [], "ABC abc"), 1);
    assert.equal(count("abc", ["i"], "ABC abc"), 2);
    assert.equal(count("^x", [], "x\nx"), 1);
    assert.equal(count("^x", ["m"], "x\nx"), 2);
    assert.equal(count("a.b", [], "a\nb"), 0);
    assert.equal(count("a.b", ["s"], "a\nb"), 1);
    assert.equal(count("^.$", [], "😀"), 0);
    assert.equal(count("^.$", ["u"], "😀"), 1);
});

test("置換すると、$1 や $<name> も使える", () => {
    const result = runRegex(input({ pattern: "(?<y>\\d{4})-(\\d{2})", text: "2026-11, 2027-01", replacement: "$2/$<y>" }));

    assert.equal(result.ok && result.replaced, "11/2026, 01/2027");
    // g がなければ最初の 1 つだけ置換する
    const once = runRegex(input({ pattern: "a", flags: [], text: "aaa", replacement: "b" }));
    assert.equal(once.ok && once.replaced, "baa");
});

test("長さ 0 の一致でも止まらず、一致が多いときは一覧を上限で切る", () => {
    const empty = runRegex(input({ pattern: "", text: "abc" }));
    assert.equal(empty.ok && empty.total, 4);

    const many = runRegex(input({ pattern: "a", text: "a".repeat(MAX_MATCHES + 5) }));
    assert.ok(many.ok);
    assert.equal(many.total, MAX_MATCHES + 5);
    assert.equal(many.matches.length, MAX_MATCHES);
    assert.equal(many.truncated, true);
});

test("書き方が正しくない正規表現・知らないフラグは断る（知らないフラグは無視する）", () => {
    const result = runRegex(input({ pattern: "(a" }));
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /^正規表現の書き方が正しくありません/);

    const unknown = runRegex(input({ pattern: "a", flags: ["g", "x" as "g"], text: "a" }));
    assert.equal(unknown.ok && unknown.total, 1);
});

test("一致した部分とそれ以外に分ける（長さ 0 の一致は飛ばす）", () => {
    assert.deepEqual(
        splitByMatches("ab12cd3", [
            { start: 0, end: 0 },
            { start: 2, end: 4 },
            { start: 6, end: 7 },
        ]),
        [
            { text: "ab", matched: false },
            { text: "12", matched: true },
            { text: "cd", matched: false },
            { text: "3", matched: true },
        ],
    );
    assert.deepEqual(splitByMatches("abc", []), [{ text: "abc", matched: false }]);
    assert.deepEqual(splitByMatches("", []), []);
});
