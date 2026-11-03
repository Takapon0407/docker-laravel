import { expectedEnd, LIFE_EXPECTANCY, parseBirthday, remaining, type Region, type Sex } from "@/lib/lifespan";

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
    const birthday = document.getElementById("lifespan-birthday") as HTMLInputElement;
    const error = document.getElementById("lifespan-error") as HTMLElement;
    const cards = [...document.querySelectorAll<HTMLElement>("[data-lifespan-region]")];
    // 入力欄で未来の日を選べないようにする（日本時間の今日まで）
    birthday.max = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
        const birthMs = birthday.value === "" ? null : parseBirthday(birthday.value, now);
        error.hidden = birthday.value === "" || birthMs !== null;
        error.textContent = "1900 年 1 月 1 日から今日までの日付を入れてください";
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

    birthday.addEventListener("input", render);
    document.querySelectorAll<HTMLInputElement>('input[name="lifespan-sex"]').forEach((radio) => radio.addEventListener("change", render));
    render();
    // 秒が変わるタイミングにそろえて書き換える
    window.setTimeout(() => {
        render();
        window.setInterval(render, 1000);
    }, 1000 - (Date.now() % 1000));
});
