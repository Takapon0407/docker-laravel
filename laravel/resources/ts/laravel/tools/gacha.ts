// ガチャ天井計算機のページ：入力の読み取り・出し入れ・Worker とのやり取り・結果の表の描画
import { chartEnd, chartPoints, type GachaResult } from "@/lib/gacha";
import { readForm, type FieldId, type FormState, type MoneyInput, type RawInput } from "@/lib/gacha-input";
import { budgetText, chartLabel, formatInteger, resultRows } from "@/lib/gacha-format";
import type { GachaRequest, GachaResponse } from "@/lib/gacha-worker";

const DEBOUNCE_MS = 150;
const SVG_NS = "http://www.w3.org/2000/svg";
// グラフの大きさ（viewBox の中の座標）と、軸の文字のための余白
const CHART = { width: 400, height: 220, left: 40, right: 14, top: 12, bottom: 28 } as const;
const MESSAGES = {
    invalid: "赤い欄を直すと、結果が出ます",
    missing: "確率・石の数・値段を入れると、結果が出ます",
    tooMany: "回数が多すぎて計算できません。すり抜けの確定か、狙いが確定するまでの回数を入れてください。",
    failed: "計算できませんでした。ページを読み込み直してください。",
} as const;

document.addEventListener("DOMContentLoaded", () => {
    const fields = new Map<FieldId, HTMLInputElement>(
        [...document.querySelectorAll<HTMLInputElement>("[data-gacha-field]")].map((input) => [input.dataset["gachaField"] as FieldId, input]),
    );
    const streakLimit = document.getElementById("gacha-k") as HTMLSelectElement;
    const streakNow = document.getElementById("gacha-s0") as HTMLSelectElement;
    const streakNowField = document.getElementById("gacha-s0-field") as HTMLElement;
    const ceilingFields = (["c0", "softStart", "softStep"] as const).map((id) => document.getElementById(`gacha-${id}-field`) as HTMLElement);
    const message = document.getElementById("gacha-message") as HTMLElement;
    const resultArea = document.getElementById("gacha-result") as HTMLElement;
    const rows = [...(document.getElementById("gacha-rows") as HTMLElement).querySelectorAll("tr")];
    const budget = document.getElementById("gacha-budget-text") as HTMLElement;
    const chart = document.getElementById("gacha-chart") as unknown as SVGSVGElement;

    let worker: Worker | null = null;
    let busy = false;
    let requestId = 0;
    let pendingMoney: MoneyInput | null = null;
    let debounce: number | undefined;

    function createWorker(): Worker | null {
        try {
            const created = new Worker(new URL("../../lib/gacha-worker.ts", import.meta.url), { type: "module" });
            created.addEventListener("message", (event: MessageEvent<GachaResponse>) => {
                // 入力を変えたあとに届いた、古い結果は使わない
                if (event.data.id !== requestId || pendingMoney === null) {
                    return;
                }
                busy = false;
                showResult(event.data.result, pendingMoney);
            });
            created.addEventListener("error", () => {
                busy = false;
                worker = null;
                showMessage(MESSAGES.failed);
            });
            return created;
        } catch {
            return null;
        }
    }

    function rawInput(): RawInput {
        const value = (id: FieldId): string => fields.get(id)?.value ?? "";
        return {
            p: value("p"),
            q: value("q"),
            k: streakLimit.value === "" ? null : Number(streakLimit.value),
            s0: Number(streakNow.value),
            n: value("n"),
            c0: value("c0"),
            softStart: value("softStart"),
            softStep: value("softStep"),
            m: value("m"),
            stones: value("stones"),
            price: value("price"),
            owned: value("owned"),
            budget: value("budget"),
        };
    }

    /** 「いま続いているすり抜け」の選択肢を 0〜k 回にする（k を下げて超えたら k に） */
    function syncStreakOptions(): void {
        const limit = streakLimit.value === "" ? null : Number(streakLimit.value);
        streakNowField.hidden = limit === null;
        if (limit === null || streakNow.options.length === limit + 1) {
            return;
        }
        const current = Math.min(Number(streakNow.value), limit);
        streakNow.replaceChildren(
            ...Array.from({ length: limit + 1 }, (_, times) => {
                const option = document.createElement("option");
                option.value = String(times);
                option.textContent = times === limit ? `${times} 回（次は確定）` : `${times} 回`;
                option.selected = times === current;
                return option;
            }),
        );
    }

    function showErrors(state: FormState): void {
        for (const [id, input] of fields) {
            const text = state.errors[id];
            const error = document.getElementById(`gacha-${id}-error`) as HTMLElement;
            error.hidden = text === undefined;
            error.textContent = text ?? "";
            input.classList.toggle("is-invalid", text !== undefined);
            if (text === undefined) {
                input.removeAttribute("aria-invalid");
            } else {
                input.setAttribute("aria-invalid", "true");
            }
        }
        for (const field of ceilingFields) {
            field.hidden = !state.ceilingShown;
        }
    }

    function showMessage(text: string): void {
        message.textContent = text;
        message.hidden = false;
        resultArea.hidden = true;
    }

    function showResult(result: GachaResult, money: MoneyInput): void {
        if (result.kind === "too-many") {
            showMessage(MESSAGES.tooMany);
            return;
        }
        resultRows(result, money).forEach((row, index) => {
            const cells = rows[index]!.querySelectorAll("td");
            cells[0]!.textContent = row.draws;
            cells[1]!.textContent = row.stones;
            cells[2]!.textContent = row.money;
        });
        const sentence = budgetText(result, money);
        budget.hidden = sentence === null;
        budget.textContent = sentence ?? "";
        drawChart(result);
        message.hidden = true;
        resultArea.hidden = false;
    }

    function svg<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
        const element = document.createElementNS(SVG_NS, name);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, String(value));
        }
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }

    /** 回数ごとの、狙いが手に入る確率の折れ線（横は 0〜右端の回数、縦は 0〜100%） */
    function drawChart(result: Extract<GachaResult, { kind: "ok" }>): void {
        const end = chartEnd(result);
        const plotWidth = CHART.width - CHART.left - CHART.right;
        const plotHeight = CHART.height - CHART.top - CHART.bottom;
        const x = (draws: number): number => CHART.left + (end === 0 ? 0 : (draws / end) * plotWidth);
        const y = (chance: number): number => CHART.top + (1 - chance) * plotHeight;
        const round = (value: number): string => String(Math.round(value * 100) / 100);

        const points = chartPoints(result).map((point) => `${round(x(point.x))},${round(y(point.y))}`);
        const bottom = round(y(0));
        const children: SVGElement[] = [];
        for (const [chance, label] of [
            [0, "0%"],
            [0.5, "50%"],
            [1, "100%"],
        ] as const) {
            children.push(svg("line", { class: chance === 0 ? "gacha-chart-axis" : "gacha-chart-grid", x1: CHART.left, x2: CHART.width - CHART.right, y1: y(chance), y2: y(chance) }));
            children.push(svg("text", { class: "gacha-chart-label", x: CHART.left - 6, y: y(chance), "text-anchor": "end", "dominant-baseline": "middle" }, label));
        }
        children.push(svg("line", { class: "gacha-chart-axis", x1: CHART.left, x2: CHART.left, y1: CHART.top, y2: y(0) }));
        children.push(svg("path", { class: "gacha-chart-area", d: `M ${round(x(0))},${bottom} L ${points.join(" L ")} L ${round(x(end))},${bottom} Z` }));
        children.push(svg("polyline", { class: "gacha-chart-line", points: points.join(" ") }));
        children.push(svg("text", { class: "gacha-chart-label", x: CHART.left, y: CHART.height - 8, "text-anchor": "start" }, "0 回"));
        children.push(svg("text", { class: "gacha-chart-label", x: CHART.width - CHART.right, y: CHART.height - 8, "text-anchor": "end" }, `${formatInteger(end)} 回`));
        chart.replaceChildren(...children);
        chart.setAttribute("aria-label", chartLabel(result));
    }

    function update(immediate: boolean): void {
        syncStreakOptions();
        const state = readForm(rawInput());
        showErrors(state);
        window.clearTimeout(debounce);
        // 計算中に入力が変わったら、古い計算は捨てる
        const id = ++requestId;
        if (state.kind !== "ok") {
            pendingMoney = null;
            showMessage(state.kind === "invalid" ? MESSAGES.invalid : MESSAGES.missing);
            return;
        }
        const start = (): void => {
            if (id !== requestId) {
                return;
            }
            if (busy && worker !== null) {
                // 重い計算の途中なら、Worker ごと止めて作り直す
                worker.terminate();
                worker = null;
            }
            worker ??= createWorker();
            if (worker === null) {
                showMessage(MESSAGES.failed);
                return;
            }
            busy = true;
            pendingMoney = state.money;
            const request: GachaRequest = { id, input: state.gacha };
            worker.postMessage(request);
        };
        if (immediate) {
            start();
        } else {
            debounce = window.setTimeout(start, DEBOUNCE_MS);
        }
    }

    for (const input of fields.values()) {
        input.addEventListener("input", () => update(false));
    }
    streakLimit.addEventListener("change", () => update(false));
    streakNow.addEventListener("change", () => update(false));
    update(true);
});
