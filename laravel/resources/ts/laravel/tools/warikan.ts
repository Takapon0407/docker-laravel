import { split, splitPerPerson, ROUNDING_UNITS, type Group, type Person, type SplitMode } from "@/lib/warikan";
import { showPopupNotification } from "../util/notification";
import { setUpInstallButton } from "../util/install-prompt";

// group: グループごとに比率か固定額を決める / person: 1人ずつ金額を決める（空欄の人は自動）
type PageMode = "group" | "person";

interface State {
    mode: PageMode;
    total: number;
    unit: number;
    groups: Group[];
    people: Person[];
}

// 入力内容はこの端末のブラウザにだけ残す（リロードしても消えないように）
const STORAGE_KEY = "warikan:v1";

const yen = new Intl.NumberFormat("ja-JP");

function newGroup(index: number): Group {
    return { name: `グループ${index}`, count: 1, mode: "ratio", ratio: 1, fixed: 0 };
}

function newPerson(index: number): Person {
    return { name: `${index}人目`, amount: null };
}

function initialState(): State {
    return {
        mode: "group",
        total: 0,
        unit: 100,
        groups: [{ ...newGroup(1), name: "全員", count: 4 }],
        people: [1, 2, 3].map(newPerson),
    };
}

function loadState(): State {
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
        if (isState(saved)) {
            return saved;
        }
    } catch {
        // 保存できない環境（プライベートブラウズなど）や壊れた値は無視する
    }
    return initialState();
}

function saveState(state: State): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // 保存できなくても計算はできるので無視する
    }
}

function isState(value: unknown): value is State {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const v = value as Partial<State>;
    return (
        (v.mode === "group" || v.mode === "person") &&
        typeof v.total === "number" &&
        ROUNDING_UNITS.some((unit) => unit === v.unit) &&
        Array.isArray(v.groups) &&
        v.groups.length > 0 &&
        v.groups.every(
            (g: Partial<Group>) =>
                typeof g.name === "string" &&
                typeof g.count === "number" &&
                (g.mode === "ratio" || g.mode === "fixed") &&
                typeof g.ratio === "number" &&
                typeof g.fixed === "number",
        ) &&
        Array.isArray(v.people) &&
        v.people.length > 0 &&
        v.people.every(
            (p: Partial<Person>) => typeof p.name === "string" && (p.amount === null || typeof p.amount === "number"),
        )
    );
}

// 空欄や不正な値は 0 として扱う（エラーの表示は split に任せる）
function toNumber(value: string): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function element<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

document.addEventListener("DOMContentLoaded", () => {
    const totalInput = element<HTMLInputElement>("warikan-total");
    const unitSelect = element<HTMLSelectElement>("warikan-unit");
    const groupsEl = element<HTMLDivElement>("warikan-groups");
    const groupTemplate = element<HTMLTemplateElement>("warikan-group-template");
    const peopleEl = element<HTMLDivElement>("warikan-people");
    const personTemplate = element<HTMLTemplateElement>("warikan-person-template");
    const errorEl = element<HTMLParagraphElement>("warikan-error");
    const resultBody = element<HTMLDivElement>("warikan-result-body");
    const resultList = element<HTMLUListElement>("warikan-result-list");
    const collectedEl = element<HTMLElement>("warikan-collected");
    const changeEl = element<HTMLElement>("warikan-change");
    const lineLink = element<HTMLAnchorElement>("warikan-line");

    let state = loadState();
    let shareText = "";

    function field(rowEl: Element, name: string): HTMLInputElement {
        return rowEl.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
    }

    function cloneRow(template: HTMLTemplateElement, index: number): HTMLElement {
        const rowEl = (template.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
        rowEl.dataset.index = String(index);
        return rowEl;
    }

    function setPressed(buttons: NodeListOf<HTMLButtonElement>, isActive: (button: HTMLButtonElement) => boolean): void {
        buttons.forEach((button) => {
            const active = isActive(button);
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
    }

    function showPageMode(): void {
        document.querySelectorAll<HTMLElement>("[data-split-section]").forEach((section) => {
            section.hidden = section.dataset.splitSection !== state.mode;
        });
        setPressed(document.querySelectorAll("[data-split-mode]"), (b) => b.dataset.splitMode === state.mode);
    }

    function showGroupMode(groupEl: Element, mode: SplitMode): void {
        groupEl.querySelectorAll<HTMLElement>("[data-show]").forEach((row) => {
            row.hidden = row.dataset.show !== mode;
        });
        setPressed(groupEl.querySelectorAll("[data-mode]"), (b) => b.dataset.mode === mode);
    }

    // 追加・削除のときだけ作り直す（入力のたびに作り直すと入力中の欄からフォーカスが外れる）
    function renderGroups(): void {
        groupsEl.replaceChildren(
            ...state.groups.map((group, index) => {
                const groupEl = cloneRow(groupTemplate, index);
                field(groupEl, "name").value = group.name;
                field(groupEl, "count").value = String(group.count);
                field(groupEl, "ratio").value = String(group.ratio);
                field(groupEl, "fixed").value = group.fixed ? String(group.fixed) : "";
                showGroupMode(groupEl, group.mode);
                // 1 つだけのときは消せない
                groupEl.querySelector<HTMLButtonElement>('[data-action="remove"]')!.hidden = state.groups.length === 1;
                return groupEl;
            }),
        );
    }

    function renderPeople(): void {
        peopleEl.replaceChildren(
            ...state.people.map((person, index) => {
                const personEl = cloneRow(personTemplate, index);
                field(personEl, "name").value = person.name;
                field(personEl, "amount").value = person.amount === null ? "" : String(person.amount);
                // 1 人だけのときは消せない（金額の欄の幅がずれないよう、場所は残して見えなくする）
                const remove = personEl.querySelector<HTMLButtonElement>('[data-action="remove"]')!;
                remove.classList.toggle("invisible", state.people.length === 1);
                remove.disabled = state.people.length === 1;
                return personEl;
            }),
        );
    }

    function renderResult(): void {
        const result =
            state.mode === "group" ? split(state.total, state.groups, state.unit) : splitPerPerson(state.total, state.people, state.unit);

        // 自動の人の欄には、計算した金額を薄く出す
        peopleEl.querySelectorAll<HTMLElement>(".warikan-person").forEach((personEl) => {
            const perPerson = result.ok ? result.groups[Number(personEl.dataset.index)]?.perPerson : undefined;
            field(personEl, "amount").placeholder = perPerson === undefined ? "自動" : `自動 ${yen.format(perPerson)}`;
        });

        if (!result.ok) {
            errorEl.textContent = result.error;
            resultBody.hidden = true;
            shareText = "";
            return;
        }

        errorEl.textContent = "";
        resultBody.hidden = false;
        const fallbackName = state.mode === "group" ? (i: number) => `グループ${i + 1}` : (i: number) => `${i + 1}人目`;
        const lines = result.groups
            .map((g, i) => {
                const name = g.name || fallbackName(i);
                // 1人ずつのときは人数を出さない
                return { ...g, name, label: state.mode === "group" ? `${name}（${g.count}人）` : name };
            })
            .filter((g) => g.count > 0);
        resultList.replaceChildren(
            ...lines.map((g) => {
                const li = document.createElement("li");
                const name = document.createElement("span");
                name.className = "warikan-result-name";
                name.textContent = g.label;
                const amount = document.createElement("span");
                amount.className = "warikan-result-amount";
                amount.textContent = `${yen.format(g.perPerson)}円`;
                li.append(name, amount);
                return li;
            }),
        );
        collectedEl.textContent = `${yen.format(result.collected)}円`;
        changeEl.textContent = `${yen.format(result.change)}円`;

        shareText = [
            `割り勘（合計 ${yen.format(state.total)}円）`,
            ...lines.map((g) =>
                state.mode === "group"
                    ? `${g.name}: 1人 ${yen.format(g.perPerson)}円 × ${g.count}人`
                    : `${g.name}: ${yen.format(g.perPerson)}円`,
            ),
            `集める合計 ${yen.format(result.collected)}円（幹事のお釣り ${yen.format(result.change)}円）`,
        ].join("\n");
        lineLink.href = `https://line.me/R/share?text=${encodeURIComponent(shareText)}`;
    }

    function update(): void {
        saveState(state);
        renderResult();
    }

    function rowOf<T>(target: EventTarget | null, selector: string, items: T[]): [HTMLElement, T] | null {
        const rowEl = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
        const item = rowEl ? items[Number(rowEl.dataset.index)] : undefined;
        return rowEl && item ? [rowEl, item] : null;
    }

    function clickedButton(event: Event): HTMLButtonElement | null {
        return event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    }

    function render(): void {
        totalInput.value = state.total ? String(state.total) : "";
        unitSelect.value = String(state.unit);
        showPageMode();
        renderGroups();
        renderPeople();
        renderResult();
    }

    render();

    document.querySelectorAll<HTMLButtonElement>("[data-split-mode]").forEach((button) => {
        button.addEventListener("click", () => {
            state.mode = button.dataset.splitMode === "person" ? "person" : "group";
            showPageMode();
            update();
        });
    });

    totalInput.addEventListener("input", () => {
        state.total = toNumber(totalInput.value);
        update();
    });

    unitSelect.addEventListener("change", () => {
        state.unit = toNumber(unitSelect.value);
        update();
    });

    groupsEl.addEventListener("input", (event) => {
        const found = rowOf(event.target, ".warikan-group", state.groups);
        if (!found || !(event.target instanceof HTMLInputElement)) {
            return;
        }
        const [, group] = found;
        const { value } = event.target;
        const key = event.target.dataset.field;
        switch (key) {
            case "name":
                group.name = value;
                break;
            case "count":
            case "ratio":
            case "fixed":
                group[key] = toNumber(value);
                break;
        }
        update();
    });

    groupsEl.addEventListener("click", (event) => {
        const button = clickedButton(event);
        const found = rowOf(button, ".warikan-group", state.groups);
        if (!button || !found) {
            return;
        }
        const [groupEl, group] = found;

        if (button.dataset.mode === "ratio" || button.dataset.mode === "fixed") {
            group.mode = button.dataset.mode;
            showGroupMode(groupEl, group.mode);
        } else if (button.dataset.action === "increment" || button.dataset.action === "decrement") {
            group.count = Math.max(0, Math.floor(group.count) + (button.dataset.action === "increment" ? 1 : -1));
            field(groupEl, "count").value = String(group.count);
        } else if (button.dataset.action === "remove") {
            state.groups.splice(state.groups.indexOf(group), 1);
            renderGroups();
        } else {
            return;
        }
        update();
    });

    peopleEl.addEventListener("input", (event) => {
        const found = rowOf(event.target, ".warikan-person", state.people);
        if (!found || !(event.target instanceof HTMLInputElement)) {
            return;
        }
        const [, person] = found;
        const { value } = event.target;
        if (event.target.dataset.field === "name") {
            person.name = value;
        } else if (event.target.dataset.field === "amount") {
            // 空欄に戻したら自動にする
            person.amount = value.trim() === "" ? null : toNumber(value);
        }
        update();
    });

    peopleEl.addEventListener("click", (event) => {
        const button = clickedButton(event);
        const found = rowOf(button, ".warikan-person", state.people);
        if (!button || !found || button.dataset.action !== "remove") {
            return;
        }
        state.people.splice(state.people.indexOf(found[1]), 1);
        renderPeople();
        update();
    });

    element<HTMLButtonElement>("warikan-add-group").addEventListener("click", () => {
        state.groups.push(newGroup(state.groups.length + 1));
        renderGroups();
        update();
        // 追加した行の名前をすぐ入力できるようにする
        field(groupsEl.lastElementChild!, "name").select();
    });

    element<HTMLButtonElement>("warikan-add-person").addEventListener("click", () => {
        state.people.push(newPerson(state.people.length + 1));
        renderPeople();
        update();
        field(peopleEl.lastElementChild!, "name").select();
    });

    element<HTMLButtonElement>("warikan-copy").addEventListener("click", () => {
        navigator.clipboard.writeText(shareText).then(
            () => showPopupNotification("結果をコピーしました"),
            () => showPopupNotification("コピーできませんでした"),
        );
    });

    // OS の共有メニュー（LINE・メッセージなどを選べる）。未対応のブラウザではボタンを出さない
    const shareButton = element<HTMLButtonElement>("warikan-share");
    shareButton.hidden = typeof navigator.share !== "function";
    shareButton.addEventListener("click", () => {
        navigator.share({ text: shareText }).catch((error: unknown) => {
            // 共有メニューを閉じただけのとき（AbortError）は何も出さない
            if (!(error instanceof DOMException && error.name === "AbortError")) {
                showPopupNotification("共有できませんでした");
            }
        });
    });

    // LINE の共有用 URL は PC 版の LINE では使えないため、スマホなどタッチ操作の端末だけで出す
    lineLink.hidden = !window.matchMedia("(pointer: coarse)").matches;

    setUpInstallButton(
        element<HTMLElement>("warikan-install"),
        element<HTMLButtonElement>("warikan-install-button"),
        element<HTMLElement>("warikan-install-ios"),
    );

    element<HTMLButtonElement>("warikan-reset").addEventListener("click", () => {
        // 割り方の種類はそのままにして、入力だけ消す
        state = { ...initialState(), mode: state.mode };
        render();
        update();
    });
});
