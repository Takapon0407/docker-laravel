import { birthYearCandidates, daysInMonth, expectedEnd, LIFE_EXPECTANCY, parseBirthday, parseSaved, remaining, shareText, todayInJapan, type Region, type Sex } from "@/lib/lifespan";

import { flash } from "../util/flash";
import { showPopupNotification } from "../util/notification";

const number = new Intl.NumberFormat("ja-JP");
const dateFormat = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" });

// 「この端末に覚える」を選んだときの入力
const STORAGE_KEY = "lifespan:v1";

const TOTAL_LABELS = [
    ["years", "年"],
    ["days", "日"],
    ["hours", "時間"],
    ["minutes", "分"],
    ["seconds", "秒"],
] as const;

document.addEventListener("DOMContentLoaded", () => {
    const yearSelect = document.getElementById("lifespan-year") as HTMLSelectElement;
    const monthSelect = document.getElementById("lifespan-month") as HTMLSelectElement;
    const daySelect = document.getElementById("lifespan-day") as HTMLSelectElement;
    const ageInput = document.getElementById("lifespan-age") as HTMLInputElement;
    const candidates = document.getElementById("lifespan-age-candidates") as HTMLElement;
    const error = document.getElementById("lifespan-error") as HTMLElement;
    const cards = [...document.querySelectorAll<HTMLElement>("[data-lifespan-region]")];

    const option = (value: number) => new Option(String(value), String(value));
    // 年は新しい順（今年から 1900 年まで）
    for (let year = todayInJapan(Date.now()).year; year >= 1900; year--) {
        yearSelect.add(option(year));
    }
    for (let month = 1; month <= 12; month++) {
        monthSelect.add(option(month));
    }
    const selected = (select: HTMLSelectElement) => (select.value === "" ? null : Number(select.value));

    // 日の選択肢を、選んだ年・月の日数にそろえる（年・月がまだなら 31 日まで。選んでいた日が多すぎれば月末にする）
    function updateDays(): void {
        const year = selected(yearSelect) ?? 2000;
        const month = selected(monthSelect);
        const count = month === null ? 31 : daysInMonth(year, month);
        const current = selected(daySelect);
        while (daySelect.options.length - 1 > count) {
            daySelect.remove(daySelect.options.length - 1);
        }
        for (let day = daySelect.options.length; day <= count; day++) {
            daySelect.add(option(day));
        }
        if (current !== null && current > count) {
            daySelect.value = String(count);
        }
    }

    // 年齢から生まれた年の候補を出す（押すと年に入る）
    function updateCandidates(): void {
        const age = ageInput.value === "" ? null : Number(ageInput.value);
        const years = age === null || !Number.isInteger(age) || age < 0 ? [] : birthYearCandidates(age, Date.now(), selected(monthSelect), selected(daySelect));
        const decided = selected(monthSelect) !== null && selected(daySelect) !== null;
        candidates.replaceChildren(
            ...years.map((year, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "btn btn-outline-success btn-sm";
                const note = decided ? "" : index === 0 ? "（今年の誕生日を過ぎた）" : "（今年の誕生日がまだ）";
                button.textContent = `${year} 年${note}`;
                button.addEventListener("click", () => {
                    yearSelect.value = String(year);
                    updateDays();
                    render(true);
                });
                return button;
            }),
        );
    }

    const share = document.getElementById("lifespan-share") as HTMLElement;
    const REGION_LABELS: Record<Region, string> = { japan: "日本", world: "世界" };

    const dialog = document.getElementById("lifespan-share-dialog") as HTMLDialogElement;
    const preview = document.getElementById("lifespan-share-preview") as HTMLElement;
    const sendButton = document.getElementById("lifespan-share-send") as HTMLButtonElement;
    const copyButton = document.getElementById("lifespan-share-copy") as HTMLButtonElement;
    // 共有メニュー（Web Share API）が使えるブラウザでは共有、使えなければコピー
    const canShare = typeof navigator.share === "function";
    sendButton.hidden = !canShare;
    copyButton.hidden = canShare;
    // 確認の画面で見せている文章（押したときの結果）
    let sharing: { text: string; url: string } | null = null;

    // 「共有する」を押したら、その時点の結果で文章を作り、確認の画面で見せる（まだ共有しない）
    (document.getElementById("lifespan-share-open") as HTMLButtonElement).addEventListener("click", () => {
        const now = Date.now();
        const birthMs = parseBirthday(birthdayValue(), now);
        if (birthMs === null) {
            return;
        }
        const sex = selectedSex();
        const text = shareText(
            (["japan", "world"] as const).map((region) => {
                const { years } = LIFE_EXPECTANCY[region][sex];
                return { label: REGION_LABELS[region], years, result: remaining(birthMs, expectedEnd(birthMs, years), now) };
            }),
        );
        sharing = { text, url: `${window.location.origin}${window.location.pathname}` };
        preview.textContent = `${sharing.text}\n${sharing.url}`;
        dialog.showModal();
    });
    sendButton.addEventListener("click", () => {
        if (!sharing) {
            return;
        }
        const data = sharing;
        dialog.close();
        navigator.share(data).catch((error: unknown) => {
            // 共有メニューを閉じただけのときは何もしない
            if (!(error instanceof DOMException && error.name === "AbortError")) {
                showPopupNotification("共有できませんでした");
            }
        });
    });
    copyButton.addEventListener("click", () => {
        if (!sharing) {
            return;
        }
        const data = sharing;
        navigator.clipboard.writeText(`${data.text}\n${data.url}`).then(
            () => {
                dialog.close();
                showPopupNotification("文章をコピーしました");
            },
            () => showPopupNotification("コピーできませんでした"),
        );
    });
    (document.getElementById("lifespan-share-cancel") as HTMLButtonElement).addEventListener("click", () => dialog.close());
    // 画面の外側（暗いところ）を押しても閉じる（dialog の余白を押したときは閉じないよう、押した位置で確かめる）
    dialog.addEventListener("click", (event) => {
        const rect = dialog.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (event.target === dialog && !inside) {
            dialog.close();
        }
    });

    function selectedSex(): Sex {
        return (document.querySelector<HTMLInputElement>('input[name="lifespan-sex"]:checked')?.value ?? "unspecified") as Sex;
    }

    function birthdayValue(): string {
        const [year, month, day] = [selected(yearSelect), selected(monthSelect), selected(daySelect)];
        if (year === null || month === null || day === null) {
            return "";
        }
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const part = (card: HTMLElement, name: string) => card.querySelector<HTMLElement>(`[data-lifespan="${name}"]`)!;
    // 単位ごとの合計は 1 秒ごとに書き換えるので、一度だけ作って値だけを変える
    const totals = new Map(
        cards.map((card) => {
            const list = part(card, "totals");
            const values = TOTAL_LABELS.map(([, unit]) => {
                const dt = document.createElement("dt");
                dt.textContent = `${unit}で`;
                const dd = document.createElement("dd");
                list.append(dt, dd);
                return dd;
            });
            return [card, values];
        }),
    );

    // changed：誕生日・性別を変えたとき（結果のカードを一瞬光らせる。1 秒ごとの書き換えでは光らせない）
    function render(changed = false): void {
        const sex = selectedSex();
        const now = Date.now();
        const value = birthdayValue();
        const birthMs = value === "" ? null : parseBirthday(value, now);
        error.hidden = value === "" || birthMs !== null;
        error.textContent = "今日より後の日は選べません";
        share.hidden = birthMs === null;
        for (const card of cards) {
            card.hidden = birthMs === null;
            if (birthMs === null) {
                continue;
            }
            if (changed) {
                flash(card);
            }
            const expectancy = LIFE_EXPECTANCY[card.dataset.lifespanRegion as Region][sex];
            const end = expectedEnd(birthMs, expectancy.years);
            const result = remaining(birthMs, end, now);
            const { years, days, hours, minutes, seconds } = result.breakdown;
            part(card, "basis").textContent = `平均寿命 ${expectancy.years} 年${expectancy.derived ? "（男女の平均）" : ""}：${dateFormat.format(end)}に迎えます`;
            // 「3 分」のように数字と単位の間で改行しないよう、ひとまとまりずつ囲む
            const pieces = [result.passed ? "平均寿命を" : "あと", `${years} 年`, `${days} 日`, `${hours} 時間`, `${minutes} 分`, `${seconds} 秒`, ...(result.passed ? ["超えています"] : [])];
            part(card, "main").replaceChildren(
                ...pieces.flatMap((piece, index) => {
                    const span = document.createElement("span");
                    span.className = "lifespan-unit";
                    span.textContent = piece;
                    return index === 0 ? [span] : [document.createTextNode(" "), span];
                }),
            );
            const percent = Math.floor(result.progress * 1000) / 10;
            part(card, "progress").setAttribute("aria-valuenow", String(percent));
            part(card, "progress").setAttribute("aria-label", `平均寿命までのうち、これまでに過ごした割合 ${percent}%`);
            part(card, "progress-bar").style.width = `${percent}%`;
            part(card, "progress-label").textContent = result.passed ? "平均寿命を超えました" : `これまでに ${percent}% を過ごしました`;
            totals.get(card)!.forEach((dd, index) => {
                const [key] = TOTAL_LABELS[index]!;
                const value = result.totals[key];
                dd.textContent = `${result.passed ? "" : "あと "}${key === "years" ? value.toFixed(1) : number.format(value)} ${TOTAL_LABELS[index]![1]}${result.passed ? " 超え" : ""}`;
            });
        }
    }

    // 覚えるのは誕生日がそろったときだけ（途中の入力は残さない）。チェックを外したら消す
    const remember = document.getElementById("lifespan-remember") as HTMLInputElement;
    function saveInput(): void {
        try {
            const birthday = birthdayValue();
            if (!remember.checked) {
                localStorage.removeItem(STORAGE_KEY);
            } else if (parseBirthday(birthday, Date.now()) !== null) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ birthday, sex: selectedSex() }));
            }
        } catch {
            // 保存できない環境（プライベートブラウズなど）でも計算はできるので無視する
        }
    }
    function loadInput(): void {
        let saved = null;
        try {
            saved = parseSaved(localStorage.getItem(STORAGE_KEY), Date.now());
        } catch {
            // 読めない環境では、覚えていないものとする
        }
        if (saved === null) {
            return;
        }
        const [year, month, day] = saved.birthday.split("-").map(Number) as [number, number, number];
        yearSelect.value = String(year);
        monthSelect.value = String(month);
        updateDays();
        daySelect.value = String(day);
        (document.getElementById(`lifespan-sex-${saved.sex}`) as HTMLInputElement).checked = true;
        remember.checked = true;
    }

    for (const select of [yearSelect, monthSelect, daySelect]) {
        select.addEventListener("change", () => {
            updateDays();
            updateCandidates();
            render(true);
            saveInput();
        });
    }
    ageInput.addEventListener("input", updateCandidates);
    document.querySelectorAll<HTMLInputElement>('input[name="lifespan-sex"]').forEach((radio) =>
        radio.addEventListener("change", () => {
            render(true);
            saveInput();
        }),
    );
    remember.addEventListener("change", saveInput);
    updateDays();
    loadInput();
    render();
    // 秒が変わるタイミングにそろえて書き換える
    window.setTimeout(() => {
        render();
        window.setInterval(() => render(), 1000);
    }, 1000 - (Date.now() % 1000));
});
