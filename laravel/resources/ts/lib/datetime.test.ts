import { test } from "node:test";
import assert from "node:assert/strict";
import { formatInstant, parseInstant } from "./datetime.ts";

// 2026-11-04 03:00:00 UTC = 2026-11-04 12:00:00 JST
const EPOCH_MS = Date.UTC(2026, 10, 4, 3, 0, 0);

test("UNIX 時間は、12 桁未満なら秒、12 桁以上ならミリ秒として読む", () => {
    assert.deepEqual(parseInstant(String(EPOCH_MS / 1000), "jst"), { ok: true, epochMs: EPOCH_MS, kind: "unix-seconds" });
    assert.deepEqual(parseInstant(` ${EPOCH_MS} `, "jst"), { ok: true, epochMs: EPOCH_MS, kind: "unix-milliseconds" });
    assert.deepEqual(parseInstant("1.5", "jst"), { ok: true, epochMs: 1500, kind: "unix-seconds" });
    assert.deepEqual(parseInstant("-86400", "jst"), { ok: true, epochMs: -86400000, kind: "unix-seconds" });
});

test("タイムゾーンが書かれた日時は、その時刻として読む", () => {
    for (const text of ["2026-11-04T03:00:00Z", "2026-11-04T03:00:00.000z", "2026-11-04T12:00:00+09:00", "2026/11/04 12:00:00+0900", "2026-11-03T22:00:00-05:00"]) {
        assert.deepEqual(parseInstant(text, "utc"), { ok: true, epochMs: EPOCH_MS, kind: "with-offset" }, text);
    }
    assert.deepEqual(parseInstant("2026-11-04T03:00:00.5Z", "jst"), { ok: true, epochMs: EPOCH_MS + 500, kind: "with-offset" });
});

test("タイムゾーンがない日時は、選んだタイムゾーン（JST / UTC）として読む", () => {
    assert.deepEqual(parseInstant("2026-11-04 12:00", "jst"), { ok: true, epochMs: EPOCH_MS, kind: "without-offset" });
    assert.deepEqual(parseInstant("2026-11-04 03:00:00", "utc"), { ok: true, epochMs: EPOCH_MS, kind: "without-offset" });
    // 日付だけなら 0 時
    assert.deepEqual(parseInstant("2026/11/4", "utc"), { ok: true, epochMs: Date.UTC(2026, 10, 4), kind: "without-offset" });
});

test("読み取れない・存在しない・範囲外の日時は断る", () => {
    for (const text of ["", "   ", "tomorrow", "2026-11-04T12:00:00+9", "2026-13-01", "2026-02-30", "2026-11-04 25:00", "99999999999999999999"]) {
        assert.equal(parseInstant(text, "jst").ok, false, text);
    }
});

test("UTC・JST・UNIX 時間の形にする", () => {
    assert.deepEqual(formatInstant(EPOCH_MS + 123), {
        utcIso: "2026-11-04T03:00:00.123Z",
        utc: "2026-11-04 03:00:00（水）",
        jstIso: "2026-11-04T12:00:00.123+09:00",
        jst: "2026-11-04 12:00:00（水）",
        unixSeconds: String(EPOCH_MS / 1000),
        unixMilliseconds: String(EPOCH_MS + 123),
    });
    // JST では日付が変わる
    assert.equal(formatInstant(Date.UTC(2026, 10, 4, 15, 30)).jst, "2026-11-05 00:30:00（木）");
    // 1970 年より前は UNIX 時間が負になる（秒は切り捨て）
    assert.equal(formatInstant(-1500).unixSeconds, "-2");
});
