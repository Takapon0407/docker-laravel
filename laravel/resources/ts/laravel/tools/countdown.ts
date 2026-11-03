import { clock, type Clock, type CustomDay, isValidCustomDay, MAX_CUSTOM_DAYS, nextOccurrence, parseCustomDays, upcomingHolidays, yearRemaining } from "@/lib/countdown";

// 自分で足した日
const STORAGE_KEY = "countdown:v1";

const dateFormat = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" });

function loadDays(): CustomDay[] {
    try {
        return parseCustomDays(localStorage.getItem(STORAGE_KEY));
    } catch {
        // 読めない環境（プライベートブラウズなど）では、まだないものとする
        return [];
    }
}

function saveDays(days: CustomDay[]): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
        return true;
    } catch {
        return false;
    }
}

// 「3 分」のように数字と単位の間で改行しないよう、ひとまとまりずつ囲む
function clockPieces(prefix: string, value: Clock): Node[] {
    const pieces = [prefix, `${value.days} 日`, `${value.hours} 時間`, `${value.minutes} 分`, `${value.seconds} 秒`];
    return pieces.flatMap((piece, index) => {
        const span = document.createElement("span");
        span.className = "countdown-unit";
        span.textContent = piece;
        return index === 0 ? [span] : [document.createTextNode(" "), span];
    });
}

// 一覧は日付で数える（「あと ◯ 日 ◯ 時間」と食い違って見えないよう「◯ 日後」にする）
function daysLeftText(daysLeft: number): string {
    return daysLeft === 0 ? "今日" : daysLeft === 1 ? "明日" : `${daysLeft} 日後`;
}

// 祝日の一覧は、はじめの数件だけを出し、残りはたたむ
const HOLIDAYS_SHOWN = 5;

function listItem(name: string, startMs: number, daysLeft: number): HTMLLIElement {
    const item = document.createElement("li");
    item.className = daysLeft === 0 ? "countdown-item is-today" : "countdown-item";
    const label = document.createElement("span");
    label.className = "countdown-item-name";
    label.textContent = name;
    const date = document.createElement("span");
    date.className = "countdown-item-date";
    date.textContent = dateFormat.format(startMs);
    const left = document.createElement("span");
    left.className = "countdown-item-left";
    left.textContent = daysLeftText(daysLeft);
    item.append(label, date, left);
    return item;
}

document.addEventListener("DOMContentLoaded", () => {
    const yearTitle = document.getElementById("countdown-year-title") as HTMLElement;
    const yearMain = document.getElementById("countdown-year-main") as HTMLElement;
    const yearProgress = document.getElementById("countdown-year-progress") as HTMLElement;
    const yearProgressBar = document.getElementById("countdown-year-progress-bar") as HTMLElement;
    const yearLabel = document.getElementById("countdown-year-label") as HTMLElement;
    const holidayBasis = document.getElementById("countdown-holiday-basis") as HTMLElement;
    const holidayMain = document.getElementById("countdown-holiday-main") as HTMLElement;
    const holidayList = document.getElementById("countdown-holidays") as HTMLElement;
    const holidayMore = document.getElementById("countdown-holidays-more") as HTMLDetailsElement;
    const holidayMoreSummary = holidayMore.querySelector("summary") as HTMLElement;
    const holidayMoreList = document.getElementById("countdown-holidays-rest") as HTMLElement;
    const customList = document.getElementById("countdown-custom") as HTMLElement;
    const customEmpty = document.getElementById("countdown-custom-empty") as HTMLElement;
    const form = document.getElementById("countdown-form") as HTMLFormElement;
    const nameInput = document.getElementById("countdown-name") as HTMLInputElement;
    const monthSelect = document.getElementById("countdown-month") as HTMLSelectElement;
    const daySelect = document.getElementById("countdown-day") as HTMLSelectElement;
    const error = document.getElementById("countdown-error") as HTMLElement;

    let days = loadDays();

    for (let month = 1; month <= 12; month++) {
        monthSelect.add(new Option(String(month), String(month)));
    }
    // 日は選んだ月の日数まで（2 月は 29 日まで選べる。うるう年でない年は次のうるう年に数える）
    function updateDayOptions(): void {
        const month = monthSelect.value === "" ? null : Number(monthSelect.value);
        const count = month === null ? 31 : new Date(Date.UTC(2000, month, 0)).getUTCDate();
        const current = daySelect.value;
        while (daySelect.options.length - 1 > count) {
            daySelect.remove(daySelect.options.length - 1);
        }
        for (let day = daySelect.options.length; day <= count; day++) {
            daySelect.add(new Option(String(day), String(day)));
        }
        if (current !== "" && Number(current) > count) {
            daySelect.value = String(count);
        }
    }

    // 日付が変わったときと、自分の日を足した・消したときだけ一覧を作り直す
    function renderLists(now: number): void {
        const holidays = upcomingHolidays(now).map((holiday) => listItem(holiday.name, holiday.startMs, holiday.daysLeft));
        holidayList.replaceChildren(...holidays.slice(0, HOLIDAYS_SHOWN));
        holidayMoreList.replaceChildren(...holidays.slice(HOLIDAYS_SHOWN));
        holidayMore.hidden = holidays.length <= HOLIDAYS_SHOWN;
        holidayMoreSummary.textContent = `ほかの祝日を見る（${holidays.length - HOLIDAYS_SHOWN} 日）`;

        const sorted = days.map((day, index) => ({ day, index, next: nextOccurrence(day.month, day.day, now) })).sort((a, b) => a.next.daysLeft - b.next.daysLeft);
        customList.replaceChildren(
            ...sorted.map(({ day, index, next }) => {
                const item = listItem(day.name, next.startMs, next.daysLeft);
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "btn btn-outline-secondary btn-sm countdown-item-remove";
                remove.textContent = "消す";
                remove.setAttribute("aria-label", `${day.name}を消す`);
                remove.addEventListener("click", () => {
                    const rest = days.filter((_, i) => i !== index);
                    if (saveDays(rest)) {
                        days = rest;
                        renderLists(Date.now());
                    }
                });
                item.append(remove);
                return item;
            }),
        );
        customEmpty.hidden = days.length > 0;
    }

    let renderedDate = "";
    function render(): void {
        const now = Date.now();

        const year = yearRemaining(now);
        yearTitle.textContent = `${year.year} 年の残り`;
        yearMain.replaceChildren(...clockPieces("あと", year.remaining));
        const percent = Math.floor(year.progress * 1000) / 10;
        yearProgress.setAttribute("aria-valuenow", String(percent));
        yearProgress.setAttribute("aria-label", `今年のうち、過ぎた割合 ${percent}%`);
        yearProgressBar.style.width = `${percent}%`;
        yearLabel.textContent = `今年の ${percent}% が過ぎました`;

        const holidays = upcomingHolidays(now);
        const next = holidays[0];
        if (next === undefined) {
            holidayBasis.textContent = "";
            holidayMain.textContent = "祝日を計算できる期間を過ぎました";
        } else if (next.daysLeft === 0) {
            holidayBasis.textContent = `${next.name}：${dateFormat.format(next.startMs)}`;
            holidayMain.textContent = `今日は${next.name}です`;
        } else {
            holidayBasis.textContent = `${next.name}：${dateFormat.format(next.startMs)}`;
            holidayMain.replaceChildren(...clockPieces("あと", clock(next.startMs - now)));
        }

        const date = dateFormat.format(now);
        if (date !== renderedDate) {
            renderedDate = date;
            renderLists(now);
        }
    }

    monthSelect.addEventListener("change", updateDayOptions);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const day: CustomDay = { name: nameInput.value.trim(), month: Number(monthSelect.value), day: Number(daySelect.value) };
        let message = "";
        if (day.name === "") {
            message = "名前を入れてください";
        } else if (monthSelect.value === "" || daySelect.value === "" || !isValidCustomDay(day)) {
            message = "月と日を選んでください";
        } else if (days.length >= MAX_CUSTOM_DAYS) {
            message = `足せるのは ${MAX_CUSTOM_DAYS} 件までです`;
        } else if (!saveDays([...days, day])) {
            message = "このブラウザでは保存できませんでした";
        }
        error.hidden = message === "";
        error.textContent = message;
        if (message !== "") {
            return;
        }
        days = [...days, day];
        form.reset();
        updateDayOptions();
        renderLists(Date.now());
    });

    updateDayOptions();
    render();
    // 秒が変わるタイミングにそろえて書き換える
    window.setTimeout(() => {
        render();
        window.setInterval(() => render(), 1000);
    }, 1000 - (Date.now() % 1000));
});
