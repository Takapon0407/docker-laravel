import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPersonalInfo } from "./board-personal-info.ts";

test("電話番号のようなものを見つける（ハイフン・かっこ・全角・+81 の書き方も）", () => {
    for (const text of ["連絡は 090-1234-5678 まで", "03-1234-5678", "03(1234)5678", "0312345678", "09012345678", "０９０－１２３４－５６７８", "+81 90-1234-5678", "+819012345678", "0120-123-456"]) {
        assert.deepEqual(detectPersonalInfo(text), ["phone"], text);
    }
});

test("メールアドレス・郵便番号のようなものを見つける", () => {
    assert.deepEqual(detectPersonalInfo("taro.yamada+test@example.co.jp に送って"), ["email"]);
    assert.deepEqual(detectPersonalInfo("ｔａｒｏ＠ｅｘａｍｐｌｅ．ｃｏｍ"), ["email"]);
    assert.deepEqual(detectPersonalInfo("〒123-4567 東京都"), ["postal"]);
    assert.deepEqual(detectPersonalInfo("〒1234567"), ["postal"]);
    assert.deepEqual(detectPersonalInfo("123-4567"), ["postal"]);
    // いくつも入っていれば、全部
    assert.deepEqual(detectPersonalInfo("〒123-4567 / 090-1234-5678 / a@b.jp"), ["phone", "email", "postal"]);
});

test("よくある数字の書き方は拾わない（日付・時刻・金額・バージョン・短い数字）", () => {
    for (const text of [
        "2026-11-04 の勉強会",
        "10:00〜12:00",
        "参加費は 1,000 円",
        "Laravel 13.0.1 と PHP 8.5",
        "スライド 12 ページ目",
        "ID は 12345678 です",
        "0.5 秒かかる",
        "@channel の通知",
        "質問です！",
    ]) {
        assert.deepEqual(detectPersonalInfo(text), [], text);
    }
});
