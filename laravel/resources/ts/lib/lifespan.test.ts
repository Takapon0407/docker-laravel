import { test } from "node:test";
import assert from "node:assert/strict";
import { birthYearCandidates, breakdown, daysInMonth, expectedEnd, LIFE_EXPECTANCY, parseBirthday, remaining, todayInJapan } from "./lifespan.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 2026-11-04 12:00 JST
const NOW = Date.UTC(2026, 10, 4, 3, 0, 0);

test("誕生日は日本時間のその日の 0 時として読み、おかしな日付・未来・1900 年より前は断る", () => {
    assert.equal(parseBirthday("2000-01-31", NOW), Date.UTC(2000, 0, 30, 15));
    for (const value of ["", "2000-02-30", "2000/01/31", "1899-12-31", "2026-11-05", "abcd-ef-gh"]) {
        assert.equal(parseBirthday(value, NOW), null, value);
    }
    // 今日生まれは計算できる
    assert.equal(parseBirthday("2026-11-04", NOW), Date.UTC(2026, 10, 3, 15));
});

test("平均寿命を迎える日は、誕生日に平均寿命 × 365.2425 日を足した日", () => {
    const birth = Date.UTC(2000, 0, 1);
    assert.equal(expectedEnd(birth, 1), birth + Math.round(365.2425 * DAY));
    assert.equal(new Date(expectedEnd(birth, 81.35)).toISOString().slice(0, 10), "2081-05-07");
});

test("残りを、年はカレンダーどおり、あとは日・時間・分・秒に分ける", () => {
    const from = Date.UTC(2026, 10, 4, 3, 0, 0);
    const to = Date.UTC(2071, 2, 4, 6, 12, 8);
    assert.deepEqual(breakdown(from, to), { years: 44, days: 120, hours: 3, minutes: 12, seconds: 8 });
    // ちょうど 1 年前の同じ時刻なら 1 年 0 日
    assert.deepEqual(breakdown(Date.UTC(2025, 5, 1), Date.UTC(2026, 5, 1)), { years: 1, days: 0, hours: 0, minutes: 0, seconds: 0 });
    // 1 年に 1 秒足りなければ 0 年 364 日…
    assert.equal(breakdown(Date.UTC(2025, 5, 1), Date.UTC(2026, 5, 1) - 1000).years, 0);
    // 2 月 29 日からの 1 年は 3 月 1 日まで
    assert.deepEqual(breakdown(Date.UTC(2024, 1, 29), Date.UTC(2025, 2, 1)), { years: 1, days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test("残りの時間と、単位ごとの合計・これまでに過ごした割合", () => {
    const birth = Date.UTC(1990, 0, 1);
    const end = expectedEnd(birth, LIFE_EXPECTANCY.japan.male.years);
    const result = remaining(birth, end, NOW);

    assert.equal(result.passed, false);
    assert.equal(result.totals.days, Math.floor((end - NOW) / DAY));
    assert.equal(result.totals.hours, Math.floor((end - NOW) / HOUR));
    assert.equal(result.totals.seconds, Math.floor((end - NOW) / 1000));
    assert.equal(result.totals.years, 44.5);
    assert.ok(Math.abs(result.progress - (NOW - birth) / (end - birth)) < 1e-12);
});

test("平均寿命をすでに過ぎているときは、過ぎてからの時間を返す", () => {
    const birth = Date.UTC(1930, 0, 1);
    const end = expectedEnd(birth, LIFE_EXPECTANCY.world.unspecified.years);
    const result = remaining(birth, end, NOW);

    assert.equal(result.passed, true);
    assert.equal(result.progress, 1);
    assert.equal(result.totals.days, Math.floor((NOW - end) / DAY));
});

test("日本の男女を合わせた値は、公表値がないので男女の平均にする", () => {
    const { male, female, unspecified } = LIFE_EXPECTANCY.japan;
    assert.equal(unspecified.years, Math.round(((male.years + female.years) / 2) * 100) / 100);
    assert.equal(unspecified.derived, true);
    assert.equal(LIFE_EXPECTANCY.world.unspecified.derived, false);
});

test("その月の日数（うるう年の 2 月は 29 日）", () => {
    assert.deepEqual([daysInMonth(2026, 1), daysInMonth(2026, 2), daysInMonth(2024, 2), daysInMonth(1900, 2), daysInMonth(2000, 2), daysInMonth(2026, 4)], [31, 28, 29, 28, 29, 30]);
});

test("今日の日付は日本時間で数える", () => {
    // UTC では 11 月 4 日 15 時 = 日本時間 11 月 5 日 0 時
    assert.deepEqual(todayInJapan(Date.UTC(2026, 10, 4, 15)), { year: 2026, month: 11, day: 5 });
    assert.deepEqual(todayInJapan(NOW), { year: 2026, month: 11, day: 4 });
});

test("年齢から生まれた年の候補：誕生日が分からなければ 2 つ、分かれば 1 つ", () => {
    // 今日は 2026 年 11 月 4 日
    assert.deepEqual(birthYearCandidates(35, NOW), [1991, 1990]);
    // 今年の誕生日を過ぎた（4 月 1 日・今日）
    assert.deepEqual(birthYearCandidates(35, NOW, 4, 1), [1991]);
    assert.deepEqual(birthYearCandidates(35, NOW, 11, 4), [1991]);
    // 今年の誕生日がまだ（11 月 5 日・12 月 31 日）
    assert.deepEqual(birthYearCandidates(35, NOW, 11, 5), [1990]);
    assert.deepEqual(birthYearCandidates(35, NOW, 12, 31), [1990]);
    // 1900 年より前の年は出さない
    assert.deepEqual(birthYearCandidates(126, NOW), [1900]);
    assert.deepEqual(birthYearCandidates(130, NOW), []);
});
