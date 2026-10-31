import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClientMessage } from "../shared/protocol.ts";

test("ping を受け付ける", () => {
    assert.deepEqual(parseClientMessage('{"action":"ping","requestId":"r1"}'), {
        ok: true,
        message: { action: "ping", requestId: "r1" },
    });
});

test("JSON でない・オブジェクトでない・requestId が正しくないものは invalid_message", () => {
    for (const body of [null, "", "not json", "[]", "null", '{"action":"ping"}', '{"action":"ping","requestId":"a b"}', `{"action":"ping","requestId":"${"x".repeat(65)}"}`]) {
        assert.deepEqual(parseClientMessage(body), { ok: false, requestId: null, code: "invalid_message" }, String(body));
    }
});

test("知らない操作は requestId を付けて unknown_action", () => {
    assert.deepEqual(parseClientMessage('{"action":"hack","requestId":"r2"}'), { ok: false, requestId: "r2", code: "unknown_action" });
});

test("createRoom：前後の空白を除いて検証する", () => {
    const result = parseClientMessage(JSON.stringify({ action: "createRoom", requestId: "r", title: "  A勉強会 ", retention: "24h", nameMode: "anonymous", topics: [" A "] }));

    assert.deepEqual(result, {
        ok: true,
        message: { action: "createRoom", requestId: "r", title: "A勉強会", retention: "24h", nameMode: "anonymous", topics: ["A"] },
    });
});

test("createRoom：タイトル・保存期間・名前の扱い・トピックが正しくなければ validation_error", () => {
    const base = { action: "createRoom", requestId: "r", title: "A", retention: "7d", nameMode: "nickname", topics: [] };
    const cases: Record<string, unknown>[] = [
        { title: "   " },
        { title: "あ".repeat(51) },
        { title: 1 },
        { retention: "1y" },
        { retention: "toString" },
        { nameMode: "real" },
        { topics: "A" },
        { topics: Array.from({ length: 21 }, () => "t") },
        { topics: ["ok", " "] },
        { topics: ["あ".repeat(41)] },
        { topics: [1] },
    ];
    for (const override of cases) {
        const result = parseClientMessage(JSON.stringify({ ...base, ...override }));
        assert.equal(result.ok === false && result.code, "validation_error", JSON.stringify(override));
    }
    // 絵文字は 1 文字として数える
    assert.equal(parseClientMessage(JSON.stringify({ ...base, title: "🎉".repeat(50) })).ok, true);
});

test("join：ルーム ID・鍵の形が正しくなければ room_not_found", () => {
    const valid = "a".repeat(22);
    assert.equal(parseClientMessage(JSON.stringify({ action: "join", requestId: "r", roomId: valid, key: valid })).ok, true);
    for (const [roomId, key] of [[valid, "short"], ["a".repeat(23), valid], [valid, "a".repeat(21) + "!"], [1, valid]]) {
        const result = parseClientMessage(JSON.stringify({ action: "join", requestId: "r", roomId, key }));
        assert.equal(result.ok === false && result.code, "room_not_found");
    }
});
