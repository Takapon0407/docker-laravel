import assert from "node:assert/strict";
import { test } from "node:test";
import type { ServerMessage } from "../shared/protocol.ts";
import { createRouter, type Dependencies, type WebSocketEvent } from "../lambda/router.ts";

function setUp(secret: string | null = null) {
    const sent: [string, ServerMessage][] = [];
    const deps: Dependencies = {
        async send(connectionId, message) {
            sent.push([connectionId, message]);
        },
        async originSecret() {
            return secret;
        },
    };
    return { route: createRouter(deps), sent };
}

function event(routeKey: string, extra: Partial<WebSocketEvent> = {}): WebSocketEvent {
    return { requestContext: { routeKey, connectionId: "c1" }, isBase64Encoded: false, ...extra } as WebSocketEvent;
}

test("ping には同じ requestId で pong を返す", async () => {
    const { route, sent } = setUp();

    const result = await route(event("ping", { body: '{"action":"ping","requestId":"r1"}' }));

    assert.equal(result.statusCode, 200);
    assert.deepEqual(sent, [["c1", { type: "pong", requestId: "r1" }]]);
});

test("形が正しくない・知らない操作にはエラーを返す", async () => {
    const { route, sent } = setUp();

    await route(event("$default", { body: "oops" }));
    await route(event("$default", { body: '{"action":"hack","requestId":"r2"}' }));

    assert.deepEqual(
        sent.map(([, m]) => m.type === "error" && [m.code, m.requestId]),
        [
            ["invalid_message", null],
            ["unknown_action", "r2"],
        ],
    );
});

test("確認用ヘッダーの値が設定されていなければ、$connect はそのまま通す", async () => {
    const { route } = setUp(null);

    assert.equal((await route(event("$connect"))).statusCode, 200);
});

test("確認用ヘッダーが一致するときだけ $connect を通す（ヘッダー名の大文字・小文字は問わない）", async () => {
    const { route } = setUp("s3cret");

    assert.equal((await route(event("$connect", { headers: { "X-Origin-Verify": "s3cret" } }))).statusCode, 200);
    assert.equal((await route(event("$connect", { headers: { "x-origin-verify": "wrong!" } }))).statusCode, 403);
    assert.equal((await route(event("$connect", { headers: { "x-origin-verify": "s3cre" } }))).statusCode, 403);
    assert.equal((await route(event("$connect"))).statusCode, 403);
});

test("$disconnect は何も送らずに 200 を返す", async () => {
    const { route, sent } = setUp();

    assert.equal((await route(event("$disconnect"))).statusCode, 200);
    assert.deepEqual(sent, []);
});
