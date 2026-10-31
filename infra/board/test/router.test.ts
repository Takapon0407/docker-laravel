import assert from "node:assert/strict";
import { test } from "node:test";
import type { ServerMessage } from "../shared/protocol.ts";
import { createRouter, viewerIp, type Connection, type Dependencies, type WebSocketEvent } from "../lambda/router.ts";

function setUp({ secret = null, debug = false }: { secret?: string | null; debug?: boolean } = {}) {
    const sent: [string, ServerMessage][] = [];
    const connections = new Map<string, Connection>();
    const deps: Dependencies = {
        debug,
        async send(connectionId, message) {
            sent.push([connectionId, message]);
        },
        async originSecret() {
            return secret;
        },
        async saveConnection(connectionId, connection) {
            connections.set(connectionId, connection);
        },
        async getConnection(connectionId) {
            return connections.get(connectionId) ?? null;
        },
        async deleteConnection(connectionId) {
            connections.delete(connectionId);
        },
    };
    return { route: createRouter(deps), sent, connections };
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
    const { route } = setUp();

    assert.equal((await route(event("$connect"))).statusCode, 200);
});

test("確認用ヘッダーが一致するときだけ $connect を通す（ヘッダー名の大文字・小文字は問わない）", async () => {
    const { route } = setUp({ secret: "s3cret" });

    assert.equal((await route(event("$connect", { headers: { "X-Origin-Verify": "s3cret" } }))).statusCode, 200);
    assert.equal((await route(event("$connect", { headers: { "x-origin-verify": "wrong!" } }))).statusCode, 403);
    assert.equal((await route(event("$connect", { headers: { "x-origin-verify": "s3cre" } }))).statusCode, 403);
    assert.equal((await route(event("$connect"))).statusCode, 403);
});

test("$connect で閲覧者の IP を保存し、$disconnect で消す（何も送らない）", async () => {
    const { route, sent, connections } = setUp();

    await route(event("$connect", { headers: { "CloudFront-Viewer-Address": "198.51.100.10:46532" } }));
    assert.deepEqual(connections.get("c1"), { ip: "198.51.100.10" });

    assert.equal((await route(event("$disconnect"))).statusCode, 200);
    assert.equal(connections.has("c1"), false);
    assert.deepEqual(sent, []);
});

test("確認用ヘッダーが合わない接続は保存しない", async () => {
    const { route, connections } = setUp({ secret: "s3cret" });

    await route(event("$connect"));

    assert.equal(connections.size, 0);
});

test("debug のときだけ、pong に保存した IP を入れる", async () => {
    const dev = setUp({ debug: true });
    await dev.route(event("$connect", { headers: { "cloudfront-viewer-address": "198.51.100.10:1" } }));
    await dev.route(event("ping", { body: '{"action":"ping","requestId":"r1"}' }));
    assert.deepEqual(dev.sent, [["c1", { type: "pong", requestId: "r1", debug: { ip: "198.51.100.10" } }]]);

    const prod = setUp();
    await prod.route(event("$connect", { headers: { "cloudfront-viewer-address": "198.51.100.10:1" } }));
    await prod.route(event("ping", { body: '{"action":"ping","requestId":"r1"}' }));
    assert.deepEqual(prod.sent, [["c1", { type: "pong", requestId: "r1" }]]);
});

test("閲覧者の IP は CloudFront のヘッダーを優先し、なければ API Gateway が見た送信元", () => {
    const withHeader = (value: string) => viewerIp(event("$connect", { headers: { "CloudFront-Viewer-Address": value } }));
    assert.equal(withHeader("198.51.100.10:46532"), "198.51.100.10");
    assert.equal(withHeader("2001:db8::1:46532"), "2001:db8::1");
    assert.equal(withHeader("[2001:db8::1]:46532"), "2001:db8::1");

    const direct = event("$connect");
    direct.requestContext.identity = { sourceIp: "203.0.113.5" };
    assert.equal(viewerIp(direct), "203.0.113.5");
    assert.equal(viewerIp(event("$connect")), null);
});
