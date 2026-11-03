import { formatInstant, parseInstant, type BaseZone, type InputKind } from "@/lib/datetime";
import { setUpCopyButtons } from "../util/copy";
import { flash } from "../util/flash";

const KIND_LABELS: Record<InputKind, string> = {
    "unix-seconds": "UNIX 時間（秒）として読みました",
    "unix-milliseconds": "UNIX 時間（ミリ秒）として読みました",
    "with-offset": "書かれているタイムゾーンの時刻として読みました",
    "without-offset": "",
};

// ブラウザの地域の時刻（Asia/Tokyo など）
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const localFormat = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
});

document.addEventListener("DOMContentLoaded", () => {
    const now = document.getElementById("datetime-now") as HTMLElement;
    const input = document.getElementById("datetime-input") as HTMLInputElement;
    const kind = document.getElementById("datetime-kind") as HTMLElement;
    const error = document.getElementById("datetime-error") as HTMLElement;
    const result = document.getElementById("datetime-result") as HTMLElement;

    const showNow = createValues(now, "now");
    const showResult = createValues(result, "result");

    function renderNow(): void {
        showNow(Date.now());
    }

    function renderInput(): void {
        const zone: BaseZone = (document.getElementById("datetime-zone-utc") as HTMLInputElement).checked ? "utc" : "jst";
        if (input.value.trim() === "") {
            kind.textContent = "";
            error.hidden = true;
            showResult(null);
            return;
        }
        const parsed = parseInstant(input.value, zone);
        if (!parsed.ok) {
            kind.textContent = "";
            error.hidden = false;
            error.textContent = parsed.message;
            showResult(null);
            return;
        }
        error.hidden = true;
        kind.textContent = parsed.kind === "without-offset" ? `${zone === "jst" ? "JST" : "UTC"} の時刻として読みました` : KIND_LABELS[parsed.kind];
        showResult(parsed.epochMs);
        // 入力・読み方を変えたら、結果が変わったことを知らせる
        flash(result);
    }

    input.addEventListener("input", renderInput);
    document.querySelectorAll<HTMLInputElement>('input[name="datetime-zone"]').forEach((radio) => radio.addEventListener("change", renderInput));
    (document.getElementById("datetime-fill-now") as HTMLButtonElement).addEventListener("click", () => {
        input.value = new Date().toISOString();
        renderInput();
    });

    renderNow();
    // 秒が変わるタイミングにそろえて書き換える
    window.setTimeout(() => {
        renderNow();
        window.setInterval(renderNow, 1000);
    }, 1000 - (Date.now() % 1000));
    renderInput();
});

const ROW_LABELS = ["JST", "JST（ISO 8601）", "UTC", "UTC（ISO 8601）", `ブラウザの地域（${localZone}）`, "UNIX 時間（秒）", "UNIX 時間（ミリ秒）"];

// 値とコピーのボタンを一度だけ並べ、値を書き換える関数を返す
// （いまの時刻は 1 秒ごとに書き換えるので、ボタンを作り直してフォーカスが外れないように）
function createValues(list: HTMLElement, prefix: string): (epochMs: number | null) => void {
    const values = ROW_LABELS.map((label, index) => {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.className = "devtool-code";
        dd.id = `${prefix}-${index}`;
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "btn btn-outline-success btn-sm";
        copy.dataset.copyTarget = dd.id;
        copy.textContent = "コピー";
        copy.setAttribute("aria-label", `${label}をコピー`);
        const wrapper = document.createElement("div");
        wrapper.append(copy);
        list.append(dt, dd, wrapper);
        return dd;
    });
    setUpCopyButtons(list);

    return (epochMs) => {
        list.hidden = epochMs === null;
        if (epochMs === null) {
            return;
        }
        const formatted = formatInstant(epochMs);
        const texts = [formatted.jst, formatted.jstIso, formatted.utc, formatted.utcIso, localFormat.format(epochMs), formatted.unixSeconds, formatted.unixMilliseconds];
        texts.forEach((text, index) => {
            values[index]!.textContent = text;
        });
    };
}
