// 日本の祝日（「国民の祝日に関する法律」の今の決まりで計算する）
// 春分の日・秋分の日は天文の計算で決まり、正式には前の年の 2 月に官報で発表される。ここでは広く使われている近似式で求める（1980〜2099 年で使える）

export interface Holiday {
    month: number;
    day: number;
    name: string;
}

// 今の決まり（山の日・スポーツの日・天皇誕生日 2 月 23 日。東京五輪の移動が終わった 2022 年から）で計算できる年
export const FIRST_YEAR = 2022;
export const LAST_YEAR = 2099;

const DAY_MS = 24 * 60 * 60 * 1000;

// その月の第 n 月曜日
function nthMonday(year: number, month: number, n: number): number {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((8 - firstWeekday) % 7) + (n - 1) * 7;
}

function equinox(year: number, base: number): number {
    return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

// その年の祝日・休日（振替休日・国民の休日を含む）を日付の順に返す。計算できない年は空
export function holidaysOf(year: number): Holiday[] {
    if (!Number.isInteger(year) || year < FIRST_YEAR || year > LAST_YEAR) {
        return [];
    }
    const base: Holiday[] = [
        { month: 1, day: 1, name: "元日" },
        { month: 1, day: nthMonday(year, 1, 2), name: "成人の日" },
        { month: 2, day: 11, name: "建国記念の日" },
        { month: 2, day: 23, name: "天皇誕生日" },
        { month: 3, day: equinox(year, 20.8431), name: "春分の日" },
        { month: 4, day: 29, name: "昭和の日" },
        { month: 5, day: 3, name: "憲法記念日" },
        { month: 5, day: 4, name: "みどりの日" },
        { month: 5, day: 5, name: "こどもの日" },
        { month: 7, day: nthMonday(year, 7, 3), name: "海の日" },
        { month: 8, day: 11, name: "山の日" },
        { month: 9, day: nthMonday(year, 9, 3), name: "敬老の日" },
        { month: 9, day: equinox(year, 23.2488), name: "秋分の日" },
        { month: 10, day: nthMonday(year, 10, 2), name: "スポーツの日" },
        { month: 11, day: 3, name: "文化の日" },
        { month: 11, day: 23, name: "勤労感謝の日" },
    ];
    const byTime = new Map(base.map((holiday) => [Date.UTC(year, holiday.month - 1, holiday.day), holiday]));
    const toHoliday = (time: number, name: string): Holiday => {
        const date = new Date(time);
        return { month: date.getUTCMonth() + 1, day: date.getUTCDate(), name };
    };

    // 国民の休日：前の日と次の日が祝日にはさまれた、祝日でない日（9 月の敬老の日と秋分の日の間など）
    for (const time of [...byTime.keys()]) {
        const between = time + DAY_MS;
        if (!byTime.has(between) && byTime.has(between + DAY_MS) && new Date(between).getUTCDay() !== 0) {
            byTime.set(between, toHoliday(between, "休日"));
        }
    }
    // 振替休日：祝日が日曜日のときは、そのあとの最初の祝日でない日を休みにする
    for (const time of [...byTime.keys()]) {
        if (new Date(time).getUTCDay() === 0) {
            let next = time + DAY_MS;
            while (byTime.has(next)) {
                next += DAY_MS;
            }
            byTime.set(next, toHoliday(next, "振替休日"));
        }
    }
    return [...byTime.entries()].sort(([a], [b]) => a - b).map(([, holiday]) => holiday);
}
