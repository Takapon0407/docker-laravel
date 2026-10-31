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
