import { birthYearCandidates, daysInMonth, expectedEnd, LIFE_EXPECTANCY, parseBirthday, remaining, shareText, todayInJapan, type Region, type Sex } from "@/lib/lifespan";

const number = new Intl.NumberFormat("ja-JP");
const dateFormat = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" });

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
                    render();
                });
                return button;
            }),
        );
    }

    const share = document.getElementById("lifespan-share") as HTMLElement;
    const shareLink = document.getElementById("lifespan-share-x") as HTMLAnchorElement;
    const REGION_LABELS: Record<Region, string> = { japan: "日本", world: "世界" };

    // 押した瞬間の結果で文章を作ってから、X の投稿画面を開く
    shareLink.addEventListener("click", () => {
        const now = Date.now();
        const birthMs = parseBirthday(birthdayValue(), now);
        if (birthMs === null) {
            return;
        }
        const sex = (document.querySelector<HTMLInputElement>('input[name="lifespan-sex"]:checked')?.value ?? "unspecified") as Sex;
        const text = shareText(
            (["japan", "world"] as const).map((region) => {
                const { years } = LIFE_EXPECTANCY[region][sex];
                return { label: REGION_LABELS[region], years, result: remaining(birthMs, expectedEnd(birthMs, years), now) };
            }),
        );
        const params = new URLSearchParams({ text, url: `${window.location.origin}${window.location.pathname}` });
        shareLink.href = `https://x.com/intent/post?${params.toString()}`;
    });

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

    function render(): void {
        const sex = (document.querySelector<HTMLInputElement>('input[name="lifespan-sex"]:checked')?.value ?? "unspecified") as Sex;
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

    for (const select of [yearSelect, monthSelect, daySelect]) {
        select.addEventListener("change", () => {
            updateDays();
            updateCandidates();
            render();
        });
    }
    ageInput.addEventListener("input", updateCandidates);
    document.querySelectorAll<HTMLInputElement>('input[name="lifespan-sex"]').forEach((radio) => radio.addEventListener("change", render));
    updateDays();
    render();
    // 秒が変わるタイミングにそろえて書き換える
    window.setTimeout(() => {
        render();
        window.setInterval(render, 1000);
    }, 1000 - (Date.now() % 1000));
});
