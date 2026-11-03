import { test } from "node:test";
import assert from "node:assert/strict";
import { QR_BORDER, qrPath } from "./board-qr.ts";

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
