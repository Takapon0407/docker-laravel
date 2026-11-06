import { type Color, pixelate, type Pixels } from "@/lib/pixel-art";

// これより大きなファイルは読み込まない（スマホで固まらないように）
const MAX_FILE_BYTES = 20 * 1024 * 1024;
// 読み込んだ画像は、長いほうの辺をこの大きさまで縮めてから使う（ドット絵には十分な細かさ）
const MAX_SOURCE_SIZE = 1024;
// 保存する画像の長いほうの辺（ドット数の整数倍にして、ドットの大きさをそろえる）
const SAVE_SIZE = 1024;

function hex(color: Color): string {
    return `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

// 変換した画像で使われている色（多い順）
function usedColors(pixels: Pixels): Color[] {
    const counts = new Map<string, number>();
    for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i + 3] !== 0) {
            const key = hex([pixels.data[i]!, pixels.data[i + 1]!, pixels.data[i + 2]!]);
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => [1, 3, 5].map((start) => parseInt(key.slice(start, start + 2), 16)) as Color);
}

async function readImage(file: File): Promise<HTMLCanvasElement> {
    // 向き（スマホの写真の回転）は createImageBitmap が画像の情報に合わせて直す
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SOURCE_SIZE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
}

document.addEventListener("DOMContentLoaded", () => {
    const drop = document.getElementById("pixel-drop") as HTMLElement;
    const fileInput = document.getElementById("pixel-file") as HTMLInputElement;
    const error = document.getElementById("pixel-error") as HTMLElement;
    const result = document.getElementById("pixel-result") as HTMLElement;
    const before = document.getElementById("pixel-before") as HTMLCanvasElement;
    const after = document.getElementById("pixel-after") as HTMLCanvasElement;
    const afterCaption = document.getElementById("pixel-after-caption") as HTMLElement;
    const paletteList = document.getElementById("pixel-palette") as HTMLElement;
    const save = document.getElementById("pixel-save") as HTMLButtonElement;

    let source: Pixels | null = null;

    function showError(message: string): void {
        error.textContent = message;
        error.hidden = message === "";
    }

    function selected(name: string): number {
        return Number((document.querySelector(`input[name="${name}"]:checked`) as HTMLInputElement).value);
    }

    function render(): void {
        if (source === null) {
            return;
        }
        const pixels = pixelate(source, selected("pixel-size"), selected("pixel-colors"));
        after.width = pixels.width;
        after.height = pixels.height;
        after.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
        afterCaption.textContent = `ドット絵（${pixels.width} × ${pixels.height} ドット）`;

        const colors = usedColors(pixels);
        paletteList.replaceChildren(
            ...colors.map((color) => {
                const item = document.createElement("li");
                item.className = "pixel-swatch";
                item.style.backgroundColor = hex(color);
                item.title = hex(color);
                return item;
            }),
        );
        paletteList.setAttribute("aria-label", `使っている色（${colors.length} 色）`);
    }

    async function load(file: File | undefined): Promise<void> {
        if (file === undefined) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            showError("画像のファイルを選んでください");
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            showError("20 MB より小さい画像を選んでください");
            return;
        }
        let canvas: HTMLCanvasElement;
        try {
            canvas = await readImage(file);
        } catch {
            showError("この画像は読み込めませんでした。JPEG や PNG の画像を選んでください");
            return;
        }
        showError("");
        before.width = canvas.width;
        before.height = canvas.height;
        before.getContext("2d")!.drawImage(canvas, 0, 0);
        const image = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
        source = { width: image.width, height: image.height, data: image.data };
        result.hidden = false;
        render();
    }

    fileInput.addEventListener("change", () => {
        void load(fileInput.files?.[0]);
        // 同じファイルをもう一度選んでも読み込めるようにする
        fileInput.value = "";
    });

    drop.addEventListener("dragover", (event) => {
        event.preventDefault();
        drop.classList.add("is-dragover");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragover"));
    drop.addEventListener("drop", (event) => {
        event.preventDefault();
        drop.classList.remove("is-dragover");
        void load(event.dataTransfer?.files[0]);
    });
    // 枠の外に落としたとき、ブラウザが画像を開いてページから離れないようにする
    window.addEventListener("dragover", (event) => event.preventDefault());
    window.addEventListener("drop", (event) => event.preventDefault());

    document.addEventListener("paste", (event) => {
        const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
        if (file !== undefined) {
            event.preventDefault();
            void load(file);
        }
    });

    document.querySelectorAll<HTMLInputElement>('input[name="pixel-size"], input[name="pixel-colors"]').forEach((input) => {
        input.addEventListener("change", render);
    });

    save.addEventListener("click", () => {
        const scale = Math.max(1, Math.floor(SAVE_SIZE / Math.max(after.width, after.height)));
        const canvas = document.createElement("canvas");
        canvas.width = after.width * scale;
        canvas.height = after.height * scale;
        const context = canvas.getContext("2d")!;
        context.imageSmoothingEnabled = false;
        context.drawImage(after, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (blob === null) {
                return;
            }
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "pixel-art.png";
            link.click();
            // ダウンロードが始まるまで待ってから片づける
            setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
        }, "image/png");
    });
});
