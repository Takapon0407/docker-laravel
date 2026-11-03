import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, japanMidnight, nextOccurrence, parseCustomDays, seasonOf, upcomingHolidays, yearRemaining } from "./countdown.ts";

const HOUR = 60 * 60 * 1000;
// 2026-11-04 12:00 JST
const NOW = Date.UTC(2026, 10, 4, 3, 0, 0);

test("今年の残りは、来年の元日 0 時（日本時間）まで", () => {
    const result = yearRemaining(NOW);

    assert.equal(result.year, 2026);
    assert.deepEqual(result.remaining, { days: 57, hours: 12, minutes: 0, seconds: 0 });
    assert.ok(result.progress > 0.84 && result.progress < 0.85);
    // 大みそかの 23:59:59（日本時間）。UTC ではもう 12 月 31 日の昼
    assert.deepEqual(yearRemaining(japanMidnight(2027, 1, 1) - 1000).remaining, { days: 0, hours: 0, minutes: 0, seconds: 1 });
    // 元日の 0 時（UTC ではまだ前の年）は新しい年
    assert.equal(yearRemaining(japanMidnight(2027, 1, 1)).year, 2027);
});

test("時間を日・時・分・秒に分け、過ぎていたら 0 にする", () => {
    assert.deepEqual(clock(2 * 24 * HOUR + 3 * HOUR + 4 * 60 * 1000 + 5999), { days: 2, hours: 3, minutes: 4, seconds: 5 });
    assert.deepEqual(clock(-1000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test("毎年の日は、今日なら 0 日、過ぎていたら来年、2 月 29 日は次のうるう年", () => {
    assert.deepEqual(nextOccurrence(11, 4, NOW), { year: 2026, month: 11, day: 4, startMs: japanMidnight(2026, 11, 4), daysLeft: 0 });
    assert.equal(nextOccurrence(12, 25, NOW).daysLeft, 51);
    assert.deepEqual([nextOccurrence(11, 3, NOW).year, nextOccurrence(11, 3, NOW).daysLeft], [2027, 364]);
    assert.deepEqual([nextOccurrence(2, 29, NOW).year, nextOccurrence(2, 29, NOW).daysLeft], [2028, 482]);
    // 日本時間の 0 時を過ぎたら、UTC ではまだ前の日でも次の日として数える
    assert.equal(nextOccurrence(11, 5, Date.UTC(2026, 10, 4, 15, 0, 0)).daysLeft, 0);
});

test("これからの祝日は、今日から 1 年のうち（年をまたいで来年の分も入る）", () => {
    const holidays = upcomingHolidays(NOW);

    assert.deepEqual(holidays.slice(0, 3).map(({ year, month, day, name, daysLeft }) => [year, month, day, name, daysLeft]), [
        [2026, 11, 23, "勤労感謝の日", 19],
        [2027, 1, 1, "元日", 58],
        [2027, 1, 11, "成人の日", 68],
    ]);
    assert.equal(holidays.at(-1)!.name, "文化の日");
    assert.equal(holidays.at(-1)!.daysLeft, 364);
    // 祝日の当日は 0 日として残す
    assert.equal(upcomingHolidays(japanMidnight(2026, 11, 23) + HOUR)[0]!.daysLeft, 0);
});

test("覚えた自分の日は、正しいものだけを読む", () => {
    assert.deepEqual(parseCustomDays('[{"name":"記念日","month":5,"day":12,"extra":1},{"name":"","month":1,"day":1},{"name":"x","month":2,"day":30},{"name":"うるう","month":2,"day":29},{"name":"x","month":13,"day":1},{"name":"x","month":"1","day":1}]'), [
        { name: "記念日", month: 5, day: 12 },
        { name: "うるう", month: 2, day: 29 },
    ]);
    for (const json of [null, "", "{", "{}", '"a"']) {
        assert.deepEqual(parseCustomDays(json), [], String(json));
    }
    assert.equal(parseCustomDays(JSON.stringify(Array.from({ length: 25 }, () => ({ name: "a", month: 1, day: 1 })))).length, 20);
    assert.deepEqual(parseCustomDays(JSON.stringify([{ name: "あ".repeat(31), month: 1, day: 1 }])), []);
});

test("今の季節は気象庁の決まり（春 3〜5 月・夏 6〜8 月・秋 9〜11 月・冬 12〜2 月）で、残りの日数は今日を含める", () => {
    const autumn = seasonOf(NOW);
    assert.equal(autumn.name, "秋");
    assert.equal(autumn.startMs, japanMidnight(2026, 9, 1));
    assert.equal(autumn.endMs, japanMidnight(2026, 12, 1));
    assert.deepEqual(autumn.lastDay, { year: 2026, month: 11, day: 30 });
    assert.equal(autumn.daysLeft, 27);
    // 9 月 1 日から 64.5 日 / 91 日
    assert.ok(Math.abs(autumn.progress - 64.5 / 91) < 1e-9);

    // 1 月の冬は前の年の 12 月から。うるう年の 2 月 29 日まで数える
    const winter = seasonOf(japanMidnight(2028, 1, 15));
    assert.deepEqual([winter.name, winter.startMs, winter.lastDay, winter.daysLeft], ["冬", japanMidnight(2027, 12, 1), { year: 2028, month: 2, day: 29 }, 46]);
    // 季節の最後の日は残り 1 日、次の日の 0 時からは次の季節
    assert.deepEqual([seasonOf(japanMidnight(2026, 5, 31) + HOUR).name, seasonOf(japanMidnight(2026, 5, 31) + HOUR).daysLeft], ["春", 1]);
    assert.deepEqual([seasonOf(japanMidnight(2026, 6, 1)).name, seasonOf(japanMidnight(2026, 6, 1)).progress], ["夏", 0]);
    assert.equal(seasonOf(japanMidnight(2026, 12, 1)).name, "冬");
    assert.equal(seasonOf(japanMidnight(2027, 3, 1) - 1000).name, "冬");
});
