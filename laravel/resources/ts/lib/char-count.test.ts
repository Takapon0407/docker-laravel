import { test } from "node:test";
import assert from "node:assert/strict";
import { countChars, countManuscriptLines, countX, X_URL_LENGTH, xIntentUrl } from "./char-count.ts";

test("文字数：空のときはすべて 0", () => {
    assert.deepEqual(countChars(""), {
        total: 0,
        withoutNewlines: 0,
        withoutSpaces: 0,
        fullWidth: 0,
        halfWidth: 0,
        lines: 0,
        bytes: 0,
        x: 0,
        manuscriptLines: 0,
        manuscriptPages: 0,
    });
});

test("文字数：改行・空白を含む／除くで数え、全角と半角を分ける", () => {
    const result = countChars("こんにちは World\n　ok");
    assert.equal(result.total, 15);
    assert.equal(result.withoutNewlines, 14);
    // 半角スペース・全角スペース・改行を除く
    assert.equal(result.withoutSpaces, 12);
    // こんにちは・全角スペース
    assert.equal(result.fullWidth, 6);
    // 「 World」「ok」
    assert.equal(result.halfWidth, 8);
    assert.equal(result.lines, 2);
    // ひらがな・全角スペースは UTF-8 で 3 バイト
    assert.equal(result.bytes, 6 * 3 + 8 + 1);
});

test("文字数：絵文字や組み合わせた文字も見た目の 1 文字で数える", () => {
    // 家族の絵文字（ZWJ でつないだ 5 コードポイント）・国旗・肌の色・「か」＋濁点（結合文字）
    const result = countChars("👨‍👩‍👧🇯🇵👍🏽が");
    assert.equal(result.total, 4);
    assert.equal(result.fullWidth, 4);
});

test("文字数：CRLF・CR の改行も 1 文字・1 行として数える", () => {
    assert.equal(countChars("a\r\nb\rc").total, 5);
    assert.equal(countChars("a\r\nb\rc").lines, 3);
    assert.equal(countChars("a\r\nb\rc").bytes, 5);
    // 最後の改行のあとも 1 行と数える（エディタの行番号と同じ）
    assert.equal(countChars("a\n").lines, 2);
});

test("半角カタカナは半角として数える", () => {
    const result = countChars("ｱｲｳ");
    assert.equal(result.halfWidth, 3);
    assert.equal(result.fullWidth, 0);
});

test("X：英数字は 1、日本語は 2、URL は長さによらず 23、絵文字は 2", () => {
    assert.equal(countX("hello"), 5);
    assert.equal(countX("こんにちは"), 10);
    assert.equal(countX("見て https://example.com/a/very/long/path?with=query"), 2 * 2 + 1 + X_URL_LENGTH);
    assert.equal(countX("👨‍👩‍👧"), 2);
    // 「‘’“”」などの記号（U+2010〜201F）は 1
    assert.equal(countX("“a”"), 3);
    // 全角 140 文字でちょうど上限
    assert.equal(countX("あ".repeat(140)), 280);
});

test("原稿用紙：段落ごとに 20 マスで折り返し、空の段落も 1 行使う", () => {
    assert.equal(countManuscriptLines(""), 0);
    assert.equal(countManuscriptLines("あ"), 1);
    assert.equal(countManuscriptLines("あ".repeat(20)), 1);
    assert.equal(countManuscriptLines("あ".repeat(21)), 2);
    assert.equal(countManuscriptLines("あ\n\nい"), 3);
    // 20 行で 1 枚、21 行で 2 枚
    assert.equal(countChars("あ".repeat(400)).manuscriptPages, 1);
    assert.equal(countChars("あ".repeat(401)).manuscriptPages, 2);
});

test("X に投稿：文章（改行・URL・絵文字を含む）を、投稿画面の URL に入れる", () => {
    const url = xIntentUrl("こんにちは 👋\r\nhttps://example.com/?a=1&b=2 #タグ");
    assert.ok(url.startsWith("https://x.com/intent/post?text="));
    // & や # で途中で切れず、そのまま戻せる。改行は LF にそろえる
    assert.equal(new URL(url).searchParams.get("text"), "こんにちは 👋\nhttps://example.com/?a=1&b=2 #タグ");
    assert.equal(new URL(url).hash, "");
});
