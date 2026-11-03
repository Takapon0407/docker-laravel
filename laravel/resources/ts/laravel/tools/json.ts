import { formatJson, type Indent } from "@/lib/json-format";
import { setUpCopyButtons } from "../util/copy";

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("json-input") as HTMLTextAreaElement;
    const output = document.getElementById("json-output") as HTMLTextAreaElement;
    const indent = document.getElementById("json-indent") as HTMLSelectElement;
    const error = document.getElementById("json-error") as HTMLElement;
    const jump = document.getElementById("json-error-jump") as HTMLButtonElement;
    const status = document.getElementById("json-status") as HTMLElement;
    // エラーの場所（入力欄の何文字目か）
    let errorOffset: number | null = null;

    // settingsChanged：整形のしかた・インデントを変えたとき（結果の欄を一瞬光らせて、変わったことを知らせる）
    function render(settingsChanged = false): void {
        const minify = (document.getElementById("json-mode-minify") as HTMLInputElement).checked;
        indent.disabled = minify;
        if (input.value.trim() === "") {
            output.value = "";
            status.textContent = "";
            showError(null);
            return;
        }
        const result = formatJson(input.value, minify ? null : (indent.value === "tab" ? "tab" : (Number(indent.value) as Indent)));
        if (result.ok) {
            output.value = result.text;
            // スペース 4 とタブは見た目では区別できないので、どう整形したかを文字で出す
            status.textContent = minify
                ? `1 行に圧縮しました（${result.text.length.toLocaleString()} 文字）`
                : `${indent.selectedOptions[0]?.textContent ?? ""}で整形しました（${result.text.split("\n").length.toLocaleString()} 行）`;
            showError(null);
            if (settingsChanged) {
                flash();
            }
            return;
        }
        output.value = "";
        status.textContent = "";
        showError(`${result.line} 行目の ${result.column} 文字目：${result.message}`, offsetOf(input.value, result.line, result.column));
    }

    function showError(message: string | null, offset: number | null = null): void {
        error.hidden = message === null;
        error.textContent = message ?? "";
        errorOffset = offset;
        jump.hidden = offset === null;
    }

    function flash(): void {
        output.classList.remove("is-updated");
        // 続けて切り替えたときも、もう一度光らせる（クラスを外したことをブラウザに反映させてから付け直す）
        void output.offsetWidth;
        output.classList.add("is-updated");
    }

    input.addEventListener("input", () => render());
    indent.addEventListener("change", () => render(true));
    document.querySelectorAll<HTMLInputElement>('input[name="json-mode"]').forEach((radio) => radio.addEventListener("change", () => render(true)));
    jump.addEventListener("click", () => {
        if (errorOffset === null) {
            return;
        }
        input.focus();
        input.setSelectionRange(errorOffset, Math.min(errorOffset + 1, input.value.length));
    });
    setUpCopyButtons();
    render();
});

// 行・列（1 から数える）を、入力欄の何文字目かにする
function offsetOf(text: string, line: number, column: number): number {
    const lines = text.split("\n").slice(0, line - 1);
    return lines.reduce((sum, current) => sum + current.length + 1, 0) + column - 1;
}
