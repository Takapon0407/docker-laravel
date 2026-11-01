import assert from "node:assert/strict";
import { test } from "node:test";
import type { ServerMessage } from "../shared/protocol.ts";
import { CONNECTION_TTL_SECONDS, createRouter, DEFAULT_TOPIC_TITLE, hash, viewerIp, type WebSocketEvent } from "../lambda/router.ts";
import { createMemoryStore } from "./memory-store.ts";

const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const NOW_SECONDS = NOW / 1000;

function setUp({ secret = null, debug = false }: { secret?: string | null; debug?: boolean } = {}) {
    const sent: [string, ServerMessage][] = [];
    const memory = createMemoryStore();
    let now = NOW;
    let counter = 0;
    const route = createRouter({
        debug,
        store: memory.store,
        now: () => now,
        // 22 文字の決まった値を順に返す
        randomToken: () => `token${String(++counter).padStart(17, "0")}`,
        async send(connectionId, message) {
            sent.push([connectionId, message]);
        },
        async originSecret() {
            return secret;
        },
    });
    const call = (routeKey: string, connectionId: string, extra: Partial<WebSocketEvent> = {}) =>
        route({ requestContext: { routeKey, connectionId }, isBase64Encoded: false, ...extra } as WebSocketEvent);
    const send = (connectionId: string, body: unknown) => call("$default", connectionId, { body: JSON.stringify(body) });
    // 最後に送ったメッセージ
    const last = () => sent.at(-1)?.[1];
    return { route, call, send, sent, last, memory, advance: (ms: number) => (now += ms) };
}

async function createRoom(t: ReturnType<typeof setUp>, overrides: Record<string, unknown> = {}) {
    await t.send("owner", { action: "createRoom", requestId: "c", title: "A勉強会", retention: "7d", nameMode: "nickname", topics: [], ...overrides });
    const created = t.last();
    assert.ok(created?.type === "roomCreated", JSON.stringify(created));
    return created;
}

test("ping には同じ requestId で pong を返す", async () => {
    const t = setUp();

    const result = await t.send("c1", { action: "ping", requestId: "r1" });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(t.sent, [["c1", { type: "pong", requestId: "r1" }]]);
});

test("形が正しくない・知らない操作にはエラーを返す", async () => {
    const t = setUp();

    await t.call("$default", "c1", { body: "oops" });
    await t.send("c1", { action: "hack", requestId: "r2" });

    assert.deepEqual(
        t.sent.map(([, m]) => m.type === "error" && [m.code, m.requestId]),
        [
            ["invalid_message", null],
            ["unknown_action", "r2"],
        ],
    );
});

test("createRoom：ルームとトピックを作り、管理用の鍵はハッシュだけ保存する", async () => {
    const t = setUp();

    const created = await createRoom(t, { topics: ["A スライド", "B スライド"] });

    const room = t.memory.rooms.get(created.roomId)!;
    assert.equal(room.title, "A勉強会");
    assert.equal(room.joinKey, created.joinKey);
    assert.equal(room.adminKeyHash, hash(created.adminKey));
    assert.notEqual(room.adminKeyHash, created.adminKey);
    assert.equal(room.expiresAt, NOW_SECONDS + 7 * 24 * 60 * 60);
    assert.equal(room.accepting, true);

    const topics = t.memory.topics.get(created.roomId)!;
    assert.deepEqual(topics.map((x) => [x.title, x.order]), [["A スライド", 0], ["B スライド", 1]]);
    // 最初のトピックが「今のトピック」になる
    assert.equal(room.currentTopicId, topics[0]!.id);
});

test("createRoom：トピックを指定しなければ「全体」を 1 つ作る", async () => {
    const t = setUp();

    const created = await createRoom(t);

    assert.deepEqual(t.memory.topics.get(created.roomId)!.map((x) => x.title), [DEFAULT_TOPIC_TITLE]);
});

test("join：管理用の鍵なら主催者（共有用の鍵も返す）、参加用の鍵なら参加者", async () => {
    const t = setUp();
    const created = await createRoom(t, { topics: ["A スライド"] });

    await t.send("admin", { action: "join", requestId: "j1", roomId: created.roomId, key: created.adminKey });
    const admin = t.last();
    assert.ok(admin?.type === "joined");
    assert.equal(admin.role, "admin");
    assert.equal(admin.joinKey, created.joinKey);
    assert.deepEqual(admin.room, {
        id: created.roomId,
        title: "A勉強会",
        nameMode: "nickname",
        accepting: true,
        currentTopicId: admin.topics[0]!.id,
        expiresAt: (NOW_SECONDS + 7 * 24 * 60 * 60) * 1000,
    });
    assert.deepEqual(admin.topics.map((x) => x.title), ["A スライド"]);

    await t.send("guest", { action: "join", requestId: "j2", roomId: created.roomId, key: created.joinKey });
    const guest = t.last();
    assert.ok(guest?.type === "joined");
    assert.equal(guest.role, "participant");
    assert.equal("joinKey" in guest, false);

    // 変更を送る相手として、ルームの接続一覧に入る
    assert.deepEqual([...t.memory.members.get(created.roomId)!.entries()].map(([id, m]) => [id, m.role]), [
        ["admin", "admin"],
        ["guest", "participant"],
    ]);
});

test("join：接続の登録の期限は、接続の上限とルームの期限の早い方", async () => {
    const t = setUp();
    const created = await createRoom(t, { retention: "24h" });

    await t.send("guest", { action: "join", requestId: "j", roomId: created.roomId, key: created.joinKey });
    assert.equal(t.memory.members.get(created.roomId)!.get("guest")!.expiresAt, NOW_SECONDS + CONNECTION_TTL_SECONDS);

    // ルームの期限の 1 時間前に入ったときは、ルームの期限まで
    t.advance((24 - 1) * 60 * 60 * 1000);
    await t.send("late", { action: "join", requestId: "j", roomId: created.roomId, key: created.joinKey });
    assert.equal(t.memory.members.get(created.roomId)!.get("late")!.expiresAt, NOW_SECONDS + 24 * 60 * 60);
});

test("join：鍵の違い・存在しないルーム・期限切れは、どれも room_not_found", async () => {
    const t = setUp();
    const created = await createRoom(t, { retention: "24h" });
    const join = async (roomId: string, key: string) => {
        await t.send("guest", { action: "join", requestId: "j", roomId, key });
        const m = t.last();
        return m?.type === "error" ? m.code : m?.type;
    };

    assert.equal(await join(created.roomId, "x".repeat(22)), "room_not_found");
    assert.equal(await join("y".repeat(22), created.joinKey), "room_not_found");
    assert.equal(await join(created.roomId, "short"), "room_not_found");

    t.advance(24 * 60 * 60 * 1000);
    assert.equal(await join(created.roomId, created.joinKey), "room_not_found");
    assert.equal(t.memory.members.get(created.roomId), undefined);
});

test("別のルームに入り直すと、前のルームの接続一覧から抜ける", async () => {
    const t = setUp();
    const a = await createRoom(t);
    const b = await createRoom(t);

    await t.send("guest", { action: "join", requestId: "j", roomId: a.roomId, key: a.joinKey });
    await t.send("guest", { action: "join", requestId: "j", roomId: b.roomId, key: b.joinKey });

    assert.equal(t.memory.members.get(a.roomId)!.has("guest"), false);
    assert.equal(t.memory.members.get(b.roomId)!.has("guest"), true);
});

test("想定外のエラーは internal_error として返し、中身は返さない", async () => {
    const t = setUp();
    t.memory.store.getRoom = async () => {
        throw new Error("DynamoDB is down: secret details");
    };
    const original = console.error;
    console.error = () => {};
    try {
        await t.send("guest", { action: "join", requestId: "j", roomId: "r".repeat(22), key: "k".repeat(22) });
    } finally {
        console.error = original;
    }

    const m = t.last();
    assert.ok(m?.type === "error");
    assert.equal(m.code, "internal_error");
    assert.doesNotMatch(m.message, /secret/);
});

test("確認用ヘッダーの値が設定されていなければ、$connect はそのまま通す", async () => {
    const t = setUp();

    assert.equal((await t.call("$connect", "c1")).statusCode, 200);
});

test("確認用ヘッダーが一致するときだけ $connect を通す（ヘッダー名の大文字・小文字は問わない）", async () => {
    const t = setUp({ secret: "s3cret" });

    assert.equal((await t.call("$connect", "c1", { headers: { "X-Origin-Verify": "s3cret" } })).statusCode, 200);
    assert.equal((await t.call("$connect", "c2", { headers: { "x-origin-verify": "wrong!" } })).statusCode, 403);
    assert.equal((await t.call("$connect", "c3", { headers: { "x-origin-verify": "s3cre" } })).statusCode, 403);
    assert.equal((await t.call("$connect", "c4")).statusCode, 403);
    // 弾いた接続は保存しない
    assert.deepEqual([...t.memory.connections.keys()], ["c1"]);
});

test("$connect で閲覧者の IP を保存し、$disconnect で接続とルームの接続一覧から消す", async () => {
    const t = setUp();
    const created = await createRoom(t);

    await t.call("$connect", "guest", { headers: { "CloudFront-Viewer-Address": "198.51.100.10:46532" } });
    assert.equal(t.memory.connections.get("guest")?.ip, "198.51.100.10");
    assert.equal(t.memory.connections.get("guest")?.expiresAt, NOW_SECONDS + CONNECTION_TTL_SECONDS);
    await t.send("guest", { action: "join", requestId: "j", roomId: created.roomId, key: created.joinKey });

    const before = t.sent.length;
    assert.equal((await t.call("$disconnect", "guest")).statusCode, 200);
    assert.equal(t.memory.connections.has("guest"), false);
    assert.equal(t.memory.members.get(created.roomId)!.has("guest"), false);
    assert.equal(t.sent.length, before);
});

test("debug のときだけ、pong に保存した IP を入れる", async () => {
    const dev = setUp({ debug: true });
    await dev.call("$connect", "c1", { headers: { "cloudfront-viewer-address": "198.51.100.10:1" } });
    await dev.send("c1", { action: "ping", requestId: "r1" });
    assert.deepEqual(dev.last(), { type: "pong", requestId: "r1", debug: { ip: "198.51.100.10" } });

    const prod = setUp();
    await prod.call("$connect", "c1", { headers: { "cloudfront-viewer-address": "198.51.100.10:1" } });
    await prod.send("c1", { action: "ping", requestId: "r1" });
    assert.deepEqual(prod.last(), { type: "pong", requestId: "r1" });
});

test("閲覧者の IP は CloudFront のヘッダーを優先し、なければ API Gateway が見た送信元", () => {
    const event = (extra: Partial<WebSocketEvent>) => ({ requestContext: { routeKey: "$connect", connectionId: "c" }, ...extra }) as WebSocketEvent;
    const withHeader = (value: string) => viewerIp(event({ headers: { "CloudFront-Viewer-Address": value } }));
    assert.equal(withHeader("198.51.100.10:46532"), "198.51.100.10");
    assert.equal(withHeader("2001:db8::1:46532"), "2001:db8::1");
    assert.equal(withHeader("[2001:db8::1]:46532"), "2001:db8::1");

    const direct = event({});
    direct.requestContext.identity = { sourceIp: "203.0.113.5" };
    assert.equal(viewerIp(direct), "203.0.113.5");
    assert.equal(viewerIp(event({})), null);
});
