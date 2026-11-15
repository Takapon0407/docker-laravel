import { diffText, foldUnchanged, type DiffLine, type FoldedItem } from "@/lib/text-diff";

// 入力のたびに比べると、長い文章で打つのが重くなるため、少し待ってから比べる
const DELAY_MS = 150;
// 変わった行の前後に残す、変わっていない行の数
const CONTEXT_LINES = 3;

const MARKERS = { equal: " ", delete: "-", insert: "+" } as const;
const LABELS = { equal: "変更なし", delete: "削除", insert: "追加" } as const;

document.addEventListener("DOMContentLoaded", () => {
    const oldInput = document.getElementById("diff-old") as HTMLTextAreaElement;
    const newInput = document.getElementById("diff-new") as HTMLTextAreaElement;
    const ignoreWhitespace = document.getElementById("diff-ignore-whitespace") as HTMLInputElement;
    const fold = document.getElementById("diff-fold") as HTMLInputElement;
    const summary = document.getElementById("diff-summary") as HTMLElement;
    const approximate = document.getElementById("diff-approximate") as HTMLElement;
    const body = document.getElementById("diff-body") as HTMLTableSectionElement;
    const empty = document.getElementById("diff-empty") as HTMLElement;
    let timer: number | undefined;

    function render(): void {
        if (oldInput.value === "" && newInput.value === "") {
            body.replaceChildren();
            summary.textContent = "";
            summary.className = "diff-summary mb-0";
            approximate.hidden = true;
            empty.hidden = false;
            return;
        }
        const result = diffText(oldInput.value, newInput.value, { ignoreWhitespace: ignoreWhitespace.checked });
        empty.hidden = true;
        approximate.hidden = !result.approximate;
        const same = result.added === 0 && result.removed === 0;
        summary.textContent = same ? "違いはありません" : `+${result.added.toLocaleString()} 行 / -${result.removed.toLocaleString()} 行`;
        summary.className = `diff-summary mb-0${same ? " is-same" : ""}`;

        const items: FoldedItem[] = fold.checked ? foldUnchanged(result.lines, CONTEXT_LINES) : result.lines.map((line) => ({ kind: "line", line }));
        body.replaceChildren(...items.map((item) => (item.kind === "skip" ? skipRow(item.count) : lineRow(item.line))));
    }

    function schedule(): void {
        window.clearTimeout(timer);
        timer = window.setTimeout(render, DELAY_MS);
    }

    oldInput.addEventListener("input", schedule);
    newInput.addEventListener("input", schedule);
    ignoreWhitespace.addEventListener("change", render);
    fold.addEventListener("change", render);
    (document.getElementById("diff-swap") as HTMLButtonElement).addEventListener("click", () => {
        [oldInput.value, newInput.value] = [newInput.value, oldInput.value];
        render();
    });
    render();
});

function lineRow(line: DiffLine): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className = `diff-line is-${line.type}`;
    const content = cell("diff-text");
    // 読み上げでは、記号ではなく「削除」「追加」と読む
    const label = document.createElement("span");
    label.className = "visually-hidden";
    label.textContent = `${LABELS[line.type]}：`;
    content.append(label);
    if (line.parts === null) {
        content.append(line.text);
    } else {
        for (const part of line.parts) {
            if (part.changed) {
                const mark = document.createElement("mark");
                mark.textContent = part.text;
                content.append(mark);
            } else {
                content.append(part.text);
            }
        }
    }
    const marker = cell("diff-marker", MARKERS[line.type]);
    marker.setAttribute("aria-hidden", "true");
    row.append(cell("diff-number", line.oldNumber?.toString() ?? ""), cell("diff-number", line.newNumber?.toString() ?? ""), marker, content);
    return row;
}

function skipRow(count: number): HTMLTableRowElement {
    const row = document.createElement("tr");
    row.className = "diff-skip";
    const content = cell("", `… 変わっていない ${count.toLocaleString()} 行 …`);
    content.colSpan = 4;
    row.append(content);
    return row;
}

function cell(className: string, text = ""): HTMLTableCellElement {
    const td = document.createElement("td");
    td.className = className;
    td.textContent = text;
    return td;
}
