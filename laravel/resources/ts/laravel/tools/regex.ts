import { splitByMatches, type Flag, type RegexInput, type RegexResult } from "@/lib/regex-check";
import type { RegexRequest } from "@/lib/regex-worker";
import { setUpCopyButtons } from "../util/copy";

// これより時間がかかったら止める（(a+)+$ のように、文字列が長いと終わらないパターンがある）
const TIMEOUT_MS = 1000;
// 打っている途中で何度も動かさないよう、入力が止まってから動かす
const DEBOUNCE_MS = 150;

document.addEventListener("DOMContentLoaded", () => {
    const pattern = document.getElementById("regex-pattern") as HTMLInputElement;
    const text = document.getElementById("regex-text") as HTMLTextAreaElement;
    const replaceEnabled = document.getElementById("regex-replace-enabled") as HTMLInputElement;
    const replaceFields = document.getElementById("regex-replace-fields") as HTMLElement;
    const replacement = document.getElementById("regex-replacement") as HTMLInputElement;
    const flagsView = document.getElementById("regex-flags-view") as HTMLElement;
    const error = document.getElementById("regex-error") as HTMLElement;
    const summary = document.getElementById("regex-summary") as HTMLElement;
    const highlight = document.getElementById("regex-highlight") as HTMLElement;
    const matchRows = document.getElementById("regex-matches") as HTMLElement;
    const replacedCard = document.getElementById("regex-replaced-card") as HTMLElement;
    const replaced = document.getElementById("regex-replaced") as HTMLElement;
    const flagInputs = [...document.querySelectorAll<HTMLInputElement>("[data-regex-flag]")];

    let worker = createWorker();
    let requestId = 0;
    let timeout: number | undefined;
    let debounce: number | undefined;

    function createWorker(): Worker {
        const created = new Worker(new URL("../../lib/regex-worker.ts", import.meta.url), { type: "module" });
        created.addEventListener("message", (event: MessageEvent<{ id: number; result: RegexResult }>) => {
            // 新しい入力で動かし直したあとに届いた、古い結果は使わない
            if (event.data.id !== requestId) {
                return;
            }
            window.clearTimeout(timeout);
            render(event.data.result, currentInput());
        });
        return created;
    }

    function currentInput(): RegexInput {
        return {
            pattern: pattern.value,
            flags: flagInputs.filter((input) => input.checked).map((input) => input.value as Flag),
            text: text.value,
            replacement: replaceEnabled.checked ? replacement.value : null,
        };
    }

    function run(): void {
        const input = currentInput();
        flagsView.textContent = `/${input.flags.join("")}`;
        replaceFields.hidden = !replaceEnabled.checked;
        if (input.pattern === "") {
            render(null, input);
            return;
        }
        const request: RegexRequest = { id: ++requestId, input };
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => {
            // 終わらないので Worker ごと止めて作り直す
            worker.terminate();
            worker = createWorker();
            render({ ok: false, message: `${TIMEOUT_MS / 1000} 秒たっても終わらないため止めました。繰り返しが入れ子になっていないか（(a+)+ など）確かめてください` }, input);
        }, TIMEOUT_MS);
        worker.postMessage(request);
    }

    function render(result: RegexResult | null, input: RegexInput): void {
        error.hidden = result === null || result.ok;
        error.textContent = result && !result.ok ? result.message : "";
        const ok = result?.ok ? result : null;

        summary.textContent = ok === null ? "一致" : ok.total === 0 ? "一致：なし" : `一致：${ok.total} 件${ok.truncated ? `（一覧は最初の ${ok.matches.length} 件）` : ""}`;
        highlight.replaceChildren(
            ...splitByMatches(input.text, ok?.matches ?? []).map((part) => {
                if (!part.matched) {
                    return document.createTextNode(part.text);
                }
                const mark = document.createElement("mark");
                mark.textContent = part.text;
                return mark;
            }),
        );
        matchRows.replaceChildren(
            ...(ok?.matches ?? []).map((match, index) => {
                const row = document.createElement("tr");
                const groups = [
                    ...match.groups.map((group, groupIndex) => `$${groupIndex + 1}: ${group ?? "（一致なし）"}`),
                    ...Object.entries(match.named).map(([name, value]) => `${name}: ${value ?? "（一致なし）"}`),
                ];
                for (const value of [String(index + 1), `${match.start}〜${match.end}`, match.text === "" ? "（空の文字列）" : match.text, groups.join("\n")]) {
                    const cell = document.createElement("td");
                    cell.className = "devtool-code";
                    cell.textContent = value;
                    row.append(cell);
                }
                return row;
            }),
        );
        replacedCard.hidden = ok === null || ok.replaced === null;
        replaced.textContent = ok?.replaced ?? "";
    }

    const schedule = () => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(run, DEBOUNCE_MS);
    };
    for (const element of [pattern, text, replacement]) {
        element.addEventListener("input", schedule);
    }
    for (const element of [replaceEnabled, ...flagInputs]) {
        element.addEventListener("change", run);
    }
    setUpCopyButtons();
    run();
});
