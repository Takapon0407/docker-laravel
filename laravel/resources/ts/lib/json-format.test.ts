import { test } from "node:test";
import assert from "node:assert/strict";
import { formatJson } from "./json-format.ts";

test("1 行の JSON を、選んだインデントで整形する", () => {
    const source = '{"id":1,"tags":["a","b"],"owner":{"name":"たか","admin":true},"note":null}';

    assert.deepEqual(formatJson(source, 2), {
        ok: true,
        text: ['{', '  "id": 1,', '  "tags": [', '    "a",', '    "b"', "  ],", '  "owner": {', '    "name": "たか",', '    "admin": true', "  },", '  "note": null', "}"].join("\n"),
    });
    assert.deepEqual(formatJson('{"a":[1]}', 4), { ok: true, text: '{\n    "a": [\n        1\n    ]\n}' });
    assert.deepEqual(formatJson('{"a":1}', "tab"), { ok: true, text: '{\n\t"a": 1\n}' });
});

test("圧縮すると、空白と改行をなくして 1 行にする（文字列の中の空白は残す）", () => {
    const result = formatJson('{\n  "a" : [ 1, 2 ],\n  "b": "x y"\n}\n', null);

    assert.deepEqual(result, { ok: true, text: '{"a":[1,2],"b":"x y"}' });
});

test("数値・文字列は元の書き方のまま残す（大きな整数の桁が落ちない）", () => {
    const source = '{"id":12345678901234567890,"price":1.50,"e":1E+3,"s":"\\u3042\\n\\"","k":"\\/"}';

    const result = formatJson(source, null);

    assert.deepEqual(result, { ok: true, text: source });
});

test("空のオブジェクト・配列はそのまま、値だけの JSON も整形できる", () => {
    assert.deepEqual(formatJson('{"a":{},"b":[]}', 2), { ok: true, text: '{\n  "a": {},\n  "b": []\n}' });
    assert.deepEqual(formatJson("  42 ", 2), { ok: true, text: "42" });
    assert.deepEqual(formatJson('"text"', 2), { ok: true, text: '"text"' });
});

test("形が正しくないときは、何行目の何文字目かを返す", () => {
    const cases: [string, string, number, number][] = [
        ['{"a":1,}', "最後の要素のあとの「,」は書けません", 1, 7],
        ['{\n  "a": 1\n  "b": 2\n}', "「,」か「}」が必要です", 3, 3],
        ["{'a':1}", "キーは「\"」で囲んだ文字列にします", 1, 2],
        ['{"a":01}', "数値の書き方が正しくありません", 1, 6],
        ['{"a":tru}', "ここに「t」は書けません", 1, 6],
        ['{"a":"x', "文字列が「\"」で閉じられていません", 1, 6],
        ['{"a":"\\x"}', "使えないエスケープ（\\）です", 1, 7],
        ['{"a":1', "JSON が途中で終わっています", 1, 7],
        ['{"a":1} x', "JSON のあとに余分な文字があります", 1, 9],
        ["  ", "JSON が空です", 1, 3],
    ];
    for (const [source, message, line, column] of cases) {
        assert.deepEqual(formatJson(source, 2), { ok: false, message, line, column }, source);
    }
});

test("文字列の中の改行・タブはそのままでは書けない", () => {
    const result = formatJson('{"a":"1\n2"}', 2);

    assert.equal(result.ok === false && result.line, 1);
    assert.match(result.ok === false ? result.message : "", /改行やタブ/);
});
