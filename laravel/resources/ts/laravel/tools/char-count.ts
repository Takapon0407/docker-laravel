import { countChars, X_LIMIT, xIntentUrl, type CharCount } from "@/lib/char-count";
import { setUpCopyButtons } from "../util/copy";

// 目標と比べられる数え方
type Basis = "withoutNewlines" | "total" | "withoutSpaces";

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("count-input") as HTMLTextAreaElement;
    const targetValue = document.getElementById("count-target-value") as HTMLInputElement;
    const targetBasis = document.getElementById("count-target-basis") as HTMLSelectElement;
    const targetStatus = document.getElementById("count-target-status") as HTMLElement;
    const postX = document.getElementById("count-post-x") as HTMLButtonElement;
    const xOver = document.getElementById("count-x-over") as HTMLElement;

    const show = (id: string, value: number): void => {
        (document.getElementById(id) as HTMLElement).textContent = value.toLocaleString();
    };

    function render(): void {
        const count = countChars(input.value);
        show("count-without-newlines", count.withoutNewlines);
        show("count-total", count.total);
        show("count-without-spaces", count.withoutSpaces);
        show("count-full-width", count.fullWidth);
        show("count-half-width", count.halfWidth);
        show("count-lines", count.lines);
        show("count-manuscript-pages", count.manuscriptPages);
        show("count-manuscript-lines", count.manuscriptLines);
        show("count-x", count.x);
        show("count-bytes", count.bytes);
        (document.getElementById("count-x") as HTMLElement).classList.toggle("is-over", count.x > X_LIMIT);
        postX.disabled = input.value.trim() === "";
        xOver.hidden = count.x <= X_LIMIT;
        renderTarget(count);
    }

    function renderTarget(count: CharCount): void {
        const target = Number(targetValue.value);
        targetStatus.classList.remove("is-over", "is-done");
        if (targetValue.value === "" || !Number.isInteger(target) || target <= 0) {
            targetStatus.textContent = "";
            return;
        }
        const current = count[targetBasis.value as Basis];
        const rest = target - current;
        const percent = Math.floor((current / target) * 100);
        if (rest > 0) {
            targetStatus.textContent = `あと ${rest.toLocaleString()} 文字（${percent}%）`;
        } else if (rest === 0) {
            targetStatus.textContent = "ちょうど目標の文字数です";
            targetStatus.classList.add("is-done");
        } else {
            targetStatus.textContent = `${(-rest).toLocaleString()} 文字オーバー（${percent}%）`;
            targetStatus.classList.add("is-over");
        }
    }

    input.addEventListener("input", render);
    targetValue.addEventListener("input", render);
    targetBasis.addEventListener("change", render);
    (document.getElementById("count-clear") as HTMLButtonElement).addEventListener("click", () => {
        input.value = "";
        render();
        input.focus();
    });
    // 新しいタブで開き、このページの情報（参照元・window.opener）は X に渡さない
    postX.addEventListener("click", () => {
        window.open(xIntentUrl(input.value), "_blank", "noopener,noreferrer");
    });
    setUpCopyButtons();
    render();
});
