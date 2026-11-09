import assert from "node:assert/strict";
import { test } from "node:test";
import { BYTES_PER_GB, monthStart, notificationOf, parseState, shouldEnable, transitionOf } from "../lambda/usage.ts";

test("今月の初めは UTC で数える（日本時間の 1 日 0〜9 時は、まだ前の月）", () => {
    assert.equal(monthStart(new Date("2026-11-10T03:00:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
    // 日本時間 12 月 1 日 8:59 は、UTC ではまだ 11 月
    assert.equal(monthStart(new Date("2026-11-30T23:59:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
    assert.equal(monthStart(new Date("2027-01-01T00:00:00Z")).toISOString(), "2027-01-01T00:00:00.000Z");
});

test("上限より少なければ配信し、上限に達したら止める", () => {
    const limit = 700 * BYTES_PER_GB;
    assert.equal(shouldEnable(0, limit), true);
    assert.equal(shouldEnable(limit - 1, limit), true);
    assert.equal(shouldEnable(limit, limit), false);
    assert.equal(shouldEnable(limit + 1, limit), false);
});

test("前回から変わったときだけ切り替え、前回がわからないときは今の判定を書く", () => {
    assert.equal(transitionOf(true, true), null);
    assert.equal(transitionOf(false, false), null);
    assert.equal(transitionOf(true, false), "disable");
    assert.equal(transitionOf(false, true), "enable");
    assert.equal(transitionOf(null, true), "enable");
    assert.equal(transitionOf(null, false), "disable");
});

test("Parameter Store の値は true / false だけを読み、それ以外は不明", () => {
    assert.equal(parseState("true"), true);
    assert.equal(parseState("false"), false);
    assert.equal(parseState(undefined), null);
    assert.equal(parseState("TRUE"), null);
});

test("通知の件名は ASCII だけ（SNS の決まり）で、本文に今月の転送量を書く", () => {
    const now = new Date("2026-11-20T00:00:00Z");
    for (const transition of ["disable", "enable"] as const) {
        const { subject, message } = notificationOf(transition, 701 * BYTES_PER_GB, 700 * BYTES_PER_GB, now);
        assert.match(subject, /^[\x20-\x7e]+$/);
        assert.ok(subject.length < 100);
        assert.match(message, /2026 年 11 月/);
        assert.match(message, /701\.0 GB（上限 700\.0 GB）/);
    }
});
