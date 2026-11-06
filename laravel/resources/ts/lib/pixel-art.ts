// 画像をドット絵にする（小さく縮めてから、色を減らす）
// 画素は Canvas の ImageData と同じ並び（1 画素 = R・G・B・A の 4 バイト）で扱う

export interface Pixels {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

export type Color = [number, number, number];

// これより透けている画素は透明、それ以外は不透明にする（ドット絵に半透明は使わない）
const ALPHA_THRESHOLD = 128;

// 長いほうの辺を size ドットにしたときの大きさ（縦横の比は元の画像のまま）
export function targetSize(sourceWidth: number, sourceHeight: number, size: number): { width: number; height: number } {
    const scale = size / Math.max(sourceWidth, sourceHeight);
    return {
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale)),
    };
}

// 1 ドットに入る元の画素の平均をとって縮める（Canvas の縮小は、ブラウザによって画素を間引くだけでざらつくため）
// 色は不透明さで重みを付けて平均し、透明な画素の色（多くは黒）が混ざらないようにする
export function downscale(source: Pixels, width: number, height: number): Pixels {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        const top = Math.floor((y * source.height) / height);
        const bottom = Math.max(top + 1, Math.floor(((y + 1) * source.height) / height));
        for (let x = 0; x < width; x++) {
            const left = Math.floor((x * source.width) / width);
            const right = Math.max(left + 1, Math.floor(((x + 1) * source.width) / width));
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            for (let sy = top; sy < bottom; sy++) {
                for (let sx = left; sx < right; sx++) {
                    const i = (sy * source.width + sx) * 4;
                    const alpha = source.data[i + 3]!;
                    r += source.data[i]! * alpha;
                    g += source.data[i + 1]! * alpha;
                    b += source.data[i + 2]! * alpha;
                    a += alpha;
                }
            }
            const count = (bottom - top) * (right - left);
            const o = (y * width + x) * 4;
            if (a > 0) {
                data[o] = Math.round(r / a);
                data[o + 1] = Math.round(g / a);
                data[o + 2] = Math.round(b / a);
            }
            data[o + 3] = Math.round(a / count);
        }
    }
    return { width, height, data };
}

// 色の近さ（赤・緑・青を同じ重みで比べるより、人の見え方に近い）
function distance(a: Color, b: Color): number {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

interface Box {
    colors: Color[];
    // いちばん広がっている向き（0：赤・1：緑・2：青）と、その幅
    channel: 0 | 1 | 2;
    range: number;
}

function box(colors: Color[]): Box {
    const min = [255, 255, 255];
    const max = [0, 0, 0];
    for (const color of colors) {
        for (let channel = 0; channel < 3; channel++) {
            min[channel] = Math.min(min[channel]!, color[channel]!);
            max[channel] = Math.max(max[channel]!, color[channel]!);
        }
    }
    const ranges = max.map((value, channel) => value - min[channel]!);
    const channel = ranges.indexOf(Math.max(...ranges)) as 0 | 1 | 2;
    return { colors, channel, range: ranges[channel]! };
}

// メディアンカット：色の集まりを、いちばん広がっている向きの真ん中で分けることを繰り返し、
// 分けたそれぞれの平均を使う色（パレット）にする。同じ画像からはいつも同じパレットになる
export function palette(pixels: Pixels, count: number): Color[] {
    const colors: Color[] = [];
    for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i + 3]! >= ALPHA_THRESHOLD) {
            colors.push([pixels.data[i]!, pixels.data[i + 1]!, pixels.data[i + 2]!]);
        }
    }
    if (colors.length === 0) {
        return [];
    }

    const boxes: Box[] = [box(colors)];
    while (boxes.length < count) {
        // 広がりがいちばん大きい集まりを分ける（1 色だけの集まりは分けない）
        let target = -1;
        boxes.forEach((candidate, index) => {
            if (candidate.range > 0 && (target === -1 || candidate.range > boxes[target]!.range)) {
                target = index;
            }
        });
        if (target === -1) {
            break;
        }
        const { colors: members, channel } = boxes[target]!;
        members.sort((a, b) => a[channel] - b[channel]);
        const half = members.length >> 1;
        boxes.splice(target, 1, box(members.slice(0, half)), box(members.slice(half)));
    }

    return boxes.map(({ colors: box }) => {
        const sum = box.reduce<Color>((total, color) => [total[0] + color[0], total[1] + color[1], total[2] + color[2]], [0, 0, 0]);
        return sum.map((value) => Math.round(value / box.length)) as Color;
    });
}

// 各画素をパレットのいちばん近い色に置き換える
export function applyPalette(pixels: Pixels, colors: Color[]): Pixels {
    const data = new Uint8ClampedArray(pixels.data.length);
    const cache = new Map<number, Color>();
    for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i + 3]! < ALPHA_THRESHOLD || colors.length === 0) {
            continue;
        }
        const key = (pixels.data[i]! << 16) | (pixels.data[i + 1]! << 8) | pixels.data[i + 2]!;
        let nearest = cache.get(key);
        if (nearest === undefined) {
            const color: Color = [pixels.data[i]!, pixels.data[i + 1]!, pixels.data[i + 2]!];
            let found = colors[0]!;
            let best = distance(found, color);
            for (const candidate of colors) {
                const d = distance(candidate, color);
                if (d < best) {
                    best = d;
                    found = candidate;
                }
            }
            nearest = found;
            cache.set(key, found);
        }
        data.set([...nearest, 255], i);
    }
    return { width: pixels.width, height: pixels.height, data };
}

// 縮めて、色を減らす
export function pixelate(source: Pixels, size: number, colorCount: number): Pixels {
    const target = targetSize(source.width, source.height, size);
    const small = downscale(source, target.width, target.height);
    return applyPalette(small, palette(small, colorCount));
}
