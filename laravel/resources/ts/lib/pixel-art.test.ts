import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPalette, downscale, palette, pixelate, type Pixels, targetSize } from "./pixel-art.ts";

// [R, G, B, A] の並びから画像を作る
function image(width: number, height: number, pixels: number[][]): Pixels {
    return { width, height, data: new Uint8ClampedArray(pixels.flat()) };
}

function uniqueColors(pixels: Pixels): Set<string> {
    const colors = new Set<string>();
    for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i + 3] !== 0) {
            colors.add(pixels.data.slice(i, i + 3).join(","));
        }
    }
    return colors;
}

test("長いほうの辺を選んだドット数にし、縦横の比は元の画像のままにする", () => {
    assert.deepEqual(targetSize(1200, 800, 48), { width: 48, height: 32 });
    assert.deepEqual(targetSize(800, 1200, 48), { width: 32, height: 48 });
    assert.deepEqual(targetSize(10000, 10, 32), { width: 32, height: 1 });
    // 元の画像より大きくもできる（小さなアイコンを粗いドットにする）
    assert.deepEqual(targetSize(16, 16, 32), { width: 32, height: 32 });
});

test("縮めるときは、1 ドットに入る画素の平均をとる", () => {
    const source = image(2, 2, [
        [0, 0, 0, 255],
        [100, 100, 100, 255],
        [200, 200, 200, 255],
        [100, 100, 100, 255],
    ]);

    assert.deepEqual([...downscale(source, 1, 1).data], [100, 100, 100, 255]);
});

test("透明な画素の色は平均に混ぜない", () => {
    const source = image(2, 1, [
        [0, 0, 0, 0],
        [255, 0, 0, 255],
    ]);

    assert.deepEqual([...downscale(source, 1, 1).data], [255, 0, 0, 128]);
});

test("色が少ない画像は、そのままの色を使う", () => {
    const source = image(3, 1, [
        [255, 0, 0, 255],
        [0, 0, 255, 255],
        [255, 0, 0, 255],
    ]);

    const colors = palette(source, 8);

    assert.equal(colors.length, 2);
    assert.deepEqual([...applyPalette(source, colors).data], [...source.data]);
});

test("色の多い画像は、選んだ色数までに減らす", () => {
    const pixels: number[][] = [];
    for (let i = 0; i < 256; i++) {
        pixels.push([i, 255 - i, (i * 7) % 256, 255]);
    }
    const source = image(16, 16, pixels);

    for (const count of [8, 16, 32]) {
        const result = applyPalette(source, palette(source, count));
        assert.ok(uniqueColors(result).size <= count, String(count));
        assert.ok(uniqueColors(result).size >= count / 2, String(count));
    }
});

test("半分より透けている画素は透明に、それ以外は不透明にする", () => {
    const source = image(3, 1, [
        [10, 20, 30, 40],
        [10, 20, 30, 200],
        [0, 0, 0, 0],
    ]);

    const result = applyPalette(source, palette(source, 8));

    assert.deepEqual([...result.data], [0, 0, 0, 0, 10, 20, 30, 255, 0, 0, 0, 0]);
});

test("全部透明な画像は、全部透明のまま", () => {
    const source = image(4, 4, Array.from({ length: 16 }, () => [255, 255, 255, 0]));

    const result = pixelate(source, 32, 8);

    assert.equal(result.width, 32);
    assert.ok(result.data.every((value) => value === 0));
});
