import { test } from "node:test";
import assert from "node:assert/strict";
import { holidaysOf } from "./holidays.ts";

const list = (year: number) => holidaysOf(year).map(({ month, day, name }) => `${month}/${day} ${name}`);

test("2026 年の祝日（内閣府の一覧と同じ。5 月の振替休日と 9 月の国民の休日を含む）", () => {
    assert.deepEqual(list(2026), [
        "1/1 元日",
        "1/12 成人の日",
        "2/11 建国記念の日",
        "2/23 天皇誕生日",
        "3/20 春分の日",
        "4/29 昭和の日",
        "5/3 憲法記念日",
        "5/4 みどりの日",
        "5/5 こどもの日",
        "5/6 振替休日",
        "7/20 海の日",
        "8/11 山の日",
        "9/21 敬老の日",
        "9/22 休日",
        "9/23 秋分の日",
        "10/12 スポーツの日",
        "11/3 文化の日",
        "11/23 勤労感謝の日",
    ]);
});

test("2027 年の祝日（春分の日が日曜日なので、次の月曜日が振替休日）", () => {
    assert.deepEqual(list(2027), [
        "1/1 元日",
        "1/11 成人の日",
        "2/11 建国記念の日",
        "2/23 天皇誕生日",
        "3/21 春分の日",
        "3/22 振替休日",
        "4/29 昭和の日",
        "5/3 憲法記念日",
        "5/4 みどりの日",
        "5/5 こどもの日",
        "7/19 海の日",
        "8/11 山の日",
        "9/20 敬老の日",
        "9/23 秋分の日",
        "10/11 スポーツの日",
        "11/3 文化の日",
        "11/23 勤労感謝の日",
    ]);
});

test("日曜日の祝日の振替休日（2025 年：2/23・5/4・11/23、2024 年：2/11・5/5・8/11・9/22・11/3）", () => {
    const substitutes = (year: number) => holidaysOf(year).filter(({ name }) => name === "振替休日").map(({ month, day }) => `${month}/${day}`);
    assert.deepEqual(substitutes(2025), ["2/24", "5/6", "11/24"]);
    assert.deepEqual(substitutes(2024), ["2/12", "5/6", "8/12", "9/23", "11/4"]);
});

test("今の決まりで計算できない年は空にする", () => {
    for (const year of [2021, 2100, 2026.5, Number.NaN]) {
        assert.deepEqual(holidaysOf(year), [], String(year));
    }
});
