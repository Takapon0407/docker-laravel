import { formatJson, type Indent } from "@/lib/json-format";
import { setUpCopyButtons } from "../util/copy";

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("json-input") as HTMLTextAreaElement;
    const output = document.getElementById("json-output") as HTMLTextAreaElement;
    const indent = document.getElementById("json-indent") as HTMLSelectElement;
    const error = document.getElementById("json-error") as HTMLElement;
    const jump = document.getElementById("json-error-jump") as HTMLButtonElement;
    // エラーの場所（入力欄の何文字目か）
    let errorOffset: number | null = null;

    function render(): void {
        const minify = (document.getElementById("json-mode-minify") as HTMLInputElement).checked;
        indent.disabled = minify;
        if (input.value.trim() === "") {
            output.value = "";
            showError(null);
            return;
        }
        const result = formatJson(input.value, minify ? null : (indent.value === "tab" ? "tab" : (Number(indent.value) as Indent)));
        if (result.ok) {
            output.value = result.text;
            showError(null);
            return;
        }
        output.value = "";
        showError(`${result.line} 行目の ${result.column} 文字目：${result.message}`, offsetOf(input.value, result.line, result.column));
    }

    function showError(message: string | null, offset: number | null = null): void {
        error.hidden = message === null;
        error.textContent = message ?? "";
        errorOffset = offset;
        jump.hidden = offset === null;
    }

    input.addEventListener("input", render);
    indent.addEventListener("change", render);
    document.querySelectorAll<HTMLInputElement>('input[name="json-mode"]').forEach((radio) => radio.addEventListener("change", render));
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
