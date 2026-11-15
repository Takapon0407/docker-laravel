import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeWifi, QR_BORDER, qrPath, qrSvg, tryQrPath, wifiPayload, wifiProblem } from "./qr.ts";

const url = "https://tektektech-portfolio.com/tools/board/room#r=AAAAAAAAAAAAAAAAAAAAAA&k=BBBBBBBBBBBBBBBBBBBBBB";

function cells(d: string): [number, number][] {
    return [...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

test("QR コード：共有用 URL を、周りに 4 マスの余白を付けた正方形の path にする", () => {
    const { size, d } = qrPath(url);
    const dark = cells(d);

    // バージョン 1〜40 の大きさ（21〜177 マス）＋余白
    assert.ok(size >= 21 + QR_BORDER * 2 && size <= 177 + QR_BORDER * 2);
    assert.equal((size - QR_BORDER * 2 - 17) % 4, 0);
    assert.ok(dark.length > 0);
    assert.ok(dark.every(([x, y]) => x >= QR_BORDER && y >= QR_BORDER && x < size - QR_BORDER && y < size - QR_BORDER));
    // 左上の位置検出パターン（7×7 の外枠）
    for (let i = 0; i < 7; i++) {
        assert.ok(dark.some(([x, y]) => x === QR_BORDER + i && y === QR_BORDER));
    }
});

test("QR コード：同じ URL なら同じ、違う URL なら違うものになる", () => {
    assert.deepEqual(qrPath(url), qrPath(url));
    assert.notEqual(qrPath(url).d, qrPath(url.replace("BBBB", "CCCC")).d);
});

test("QR コード：誤り訂正のレベルを上げると、同じ文字でも型番（マスの数）が大きくなる", () => {
    const text = "https://tektektech-portfolio.com/tools/qr";
    assert.ok(qrPath(text, "H").version > qrPath(text, "L").version);
    assert.equal(qrPath(text, "L").size, qrPath(text, "L").version * 4 + 17 + QR_BORDER * 2);
});

test("QR コード：入りきらないときは null を返す", () => {
    assert.equal(tryQrPath("a".repeat(3000), "H"), null);
    assert.notEqual(tryQrPath("a".repeat(1000), "L"), null);
    // 日本語（UTF-8）も入る
    assert.notEqual(tryQrPath("こんにちは"), null);
});

test("QR コード：保存用の SVG は白い背景に黒いマスで、1 マスの大きさを選べる", () => {
    const qr = qrPath("hello");
    const svg = qrSvg(qr, 8);
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes(`width="${qr.size * 8}" height="${qr.size * 8}" viewBox="0 0 ${qr.size} ${qr.size}"`));
    assert.ok(svg.includes(`<path d="${qr.d}" fill="#000"/>`));
});

test("Wi-Fi：種類・ネットワーク名・パスワードを決まった書き方にし、ステルスのときは H:true を付ける", () => {
    assert.equal(wifiPayload({ ssid: "MyHome", password: "secret123", security: "WPA", hidden: false }), "WIFI:T:WPA;S:MyHome;P:secret123;;");
    assert.equal(wifiPayload({ ssid: "Hidden", password: "secret123", security: "WPA", hidden: true }), "WIFI:T:WPA;S:Hidden;P:secret123;H:true;;");
    // パスワードなしのときは P を付けない
    assert.equal(wifiPayload({ ssid: "Cafe Free", password: "ignored", security: "nopass", hidden: false }), "WIFI:T:nopass;S:Cafe Free;;");
});

test("Wi-Fi：区切りの記号（\\ ; , \" :）は \\ を付けて文字として扱い、日本語はそのまま", () => {
    assert.equal(escapeWifi('a;b,c:d"e\\f'), 'a\\;b\\,c\\:d\\"e\\\\f');
    assert.equal(wifiPayload({ ssid: "おうち;5G", password: "p:ss;word", security: "WPA", hidden: false }), "WIFI:T:WPA;S:おうち\\;5G;P:p\\:ss\\;word;;");
    assert.notEqual(tryQrPath(wifiPayload({ ssid: "おうち", password: "password", security: "WPA", hidden: false })), null);
});

test("Wi-Fi：つながらない設定のときは理由を返す", () => {
    const base = { ssid: "MyHome", password: "secret123", security: "WPA", hidden: false } as const;
    assert.equal(wifiProblem(base), null);
    assert.equal(wifiProblem({ ...base, ssid: "" }), "ネットワーク名を入れてください");
    // 日本語は 1 文字 3 バイト。11 文字（33 バイト）は長すぎる
    assert.match(wifiProblem({ ...base, ssid: "あ".repeat(11) }) ?? "", /長すぎます/);
    assert.match(wifiProblem({ ...base, password: "short" }) ?? "", /8〜63 文字/);
    assert.equal(wifiProblem({ ...base, security: "nopass", password: "" }), null);
});
