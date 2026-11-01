import assert from "node:assert/strict";
import { test } from "node:test";
import type { ServerMessage } from "../shared/protocol.ts";
import { LIMITS, POSTS_PER_MESSAGE } from "../shared/protocol.ts";
import { CONNECTION_TTL_SECONDS, createRouter, DEFAULT_TOPIC_TITLE, hash, viewerIp, type WebSocketEvent } from "../lambda/router.ts";
import { createMemoryStore } from "./memory-store.ts";

const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);
const NOW_SECONDS = NOW / 1000;
const BROWSER = "browser".padEnd(22, "0");

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

    await t.send("admin", { action: "join", requestId: "j1", browserId: BROWSER, roomId: created.roomId, key: created.adminKey });
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

    await t.send("guest", { action: "join", requestId: "j2", browserId: BROWSER, roomId: created.roomId, key: created.joinKey });
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

    await t.send("guest", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key: created.joinKey });
    assert.equal(t.memory.members.get(created.roomId)!.get("guest")!.expiresAt, NOW_SECONDS + CONNECTION_TTL_SECONDS);

    // ルームの期限の 1 時間前に入ったときは、ルームの期限まで
    t.advance((24 - 1) * 60 * 60 * 1000);
    await t.send("late", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key: created.joinKey });
    assert.equal(t.memory.members.get(created.roomId)!.get("late")!.expiresAt, NOW_SECONDS + 24 * 60 * 60);
});

test("join：鍵の違い・存在しないルーム・期限切れは、どれも room_not_found", async () => {
    const t = setUp();
    const created = await createRoom(t, { retention: "24h" });
    const join = async (roomId: string, key: string) => {
        await t.send("guest", { action: "join", requestId: "j", browserId: BROWSER, roomId, key });
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

    await t.send("guest", { action: "join", requestId: "j", browserId: BROWSER, roomId: a.roomId, key: a.joinKey });
    await t.send("guest", { action: "join", requestId: "j", browserId: BROWSER, roomId: b.roomId, key: b.joinKey });

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
        await t.send("guest", { action: "join", requestId: "j", browserId: BROWSER, roomId: "r".repeat(22), key: "k".repeat(22) });
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
    await t.send("guest", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key: created.joinKey });

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

// ルームを作り、主催者（owner）と参加者（guest1・guest2）が入った状態にする
async function roomWithMembers(overrides: Record<string, unknown> = {}) {
    const t = setUp();
    const created = await createRoom(t, overrides);
    await t.send("owner", { action: "join", requestId: "j", browserId: "owner".padEnd(22, "0"), roomId: created.roomId, key: created.adminKey });
    for (const guest of ["guest1", "guest2"]) {
        await t.send(guest, { action: "join", requestId: "j", browserId: guest.padEnd(22, "0"), roomId: created.roomId, key: created.joinKey });
    }
    t.sent.length = 0;
    const post = async (connectionId: string, fields: Record<string, unknown> = {}) => {
        await t.send(connectionId, { action: "post", requestId: "p", kind: "question", body: "質問です", nickname: "たか", ...fields });
        const posted = t.sent.find(([id, m]) => id === connectionId && m.type === "posted")?.[1];
        assert.ok(posted?.type === "posted", JSON.stringify(t.sent));
        t.sent.length = 0;
        return posted;
    };
    // 最後の送信で、各接続が受け取ったメッセージ
    const received = (connectionId: string) => t.sent.filter(([id]) => id === connectionId).map(([, m]) => m);
    return { t, created, post, received };
}

test("post：今のトピックに入れ、投稿した人に取り消し用の鍵を返し、全員に送る", async () => {
    const { t, created, received } = await roomWithMembers({ topics: ["A", "B"] });

    await t.send("guest1", { action: "post", requestId: "p1", kind: "question", body: "質問です", nickname: "たか" });

    const [posted, added] = received("guest1");
    assert.ok(posted?.type === "posted");
    assert.equal(posted.requestId, "p1");
    const room = t.memory.rooms.get(created.roomId)!;
    const expected = { id: posted.postId, topicId: room.currentTopicId, kind: "question", body: "質問です", nickname: "たか", likes: 0, pinned: false, createdAt: NOW };
    assert.deepEqual(added, { type: "postAdded", post: expected });
    for (const other of ["owner", "guest2"]) {
        assert.deepEqual(received(other), [{ type: "postAdded", post: expected }]);
    }
    // 取り消し用の鍵はハッシュだけ保存し、ほかの人には送らない
    const stored = t.memory.posts.get(created.roomId)!.get(posted.postId)!;
    assert.equal(stored.deleteKeyHash, hash(posted.deleteKey));
    assert.doesNotMatch(JSON.stringify(t.sent.filter(([id]) => id !== "guest1")), new RegExp(posted.deleteKey));
    assert.equal(room.postCount, 1);
});

test("post：完全に匿名のルームでは、ニックネームを保存しない", async () => {
    const { t, created, post } = await roomWithMembers({ nameMode: "anonymous" });

    const posted = await post("guest1", { nickname: "たか" });

    assert.equal(t.memory.posts.get(created.roomId)!.get(posted.postId)!.nickname, null);
});

test("post：ルームに入っていない・受付を締め切っている・投稿が上限のときは断る", async () => {
    const { t, created, received } = await roomWithMembers();
    const tryPost = async (connectionId: string) => {
        t.sent.length = 0;
        await t.send(connectionId, { action: "post", requestId: "p", kind: "comment", body: "本文", nickname: null });
        const m = received(connectionId)[0];
        return m?.type === "error" ? m.code : m?.type;
    };

    assert.equal(await tryPost("stranger"), "not_joined");

    const room = t.memory.rooms.get(created.roomId)!;
    room.postCount = LIMITS.posts;
    assert.equal(await tryPost("guest1"), "too_many_posts");

    room.accepting = false;
    assert.equal(await tryPost("guest1"), "not_accepting");
    // 断ったときは、ほかの人に何も送らない
    assert.deepEqual(received("guest2"), []);
});

test("post：ルームの期限が切れていたら room_not_found", async () => {
    const { t, received } = await roomWithMembers({ retention: "24h" });

    t.advance(24 * 60 * 60 * 1000);
    await t.send("guest1", { action: "post", requestId: "p", kind: "comment", body: "本文", nickname: null });

    const m = received("guest1")[0];
    assert.equal(m?.type === "error" && m.code, "room_not_found");
});

test("deletePost：取り消し用の鍵が合えば消して全員に送る。違えば post_not_found", async () => {
    const { t, created, post, received } = await roomWithMembers();
    const posted = await post("guest1");

    await t.send("guest2", { action: "deletePost", requestId: "d1", postId: posted.postId, key: "x".repeat(22) });
    const denied = received("guest2")[0];
    assert.equal(denied?.type === "error" && denied.code, "post_not_found");
    assert.equal(t.memory.posts.get(created.roomId)!.has(posted.postId), true);
    t.sent.length = 0;

    await t.send("guest1", { action: "deletePost", requestId: "d2", postId: posted.postId, key: posted.deleteKey });
    assert.deepEqual(received("guest1"), [
        { type: "ok", requestId: "d2" },
        { type: "postDeleted", postId: posted.postId },
    ]);
    assert.deepEqual(received("owner"), [{ type: "postDeleted", postId: posted.postId }]);
    assert.equal(t.memory.posts.get(created.roomId)!.has(posted.postId), false);
    assert.equal(t.memory.rooms.get(created.roomId)!.postCount, 0);
});

test("like / unlike：ブラウザごとに 1 回。数が変わったら全員に送る", async () => {
    const { t, post, received } = await roomWithMembers();
    const { postId } = await post("guest1");
    const act = async (connectionId: string, action: "like" | "unlike") => {
        t.sent.length = 0;
        await t.send(connectionId, { action, requestId: "l", postId });
    };

    await act("guest2", "like");
    assert.deepEqual(received("guest2"), [{ type: "ok", requestId: "l" }, { type: "postLiked", postId, likes: 1 }]);
    assert.deepEqual(received("owner"), [{ type: "postLiked", postId, likes: 1 }]);

    // 同じブラウザの 2 回目は数を変えず、押した人の表示だけ合わせる
    await act("guest2", "like");
    assert.deepEqual(received("guest2"), [{ type: "ok", requestId: "l" }, { type: "postLiked", postId, likes: 1 }]);
    assert.deepEqual(received("owner"), []);

    await act("owner", "like");
    assert.deepEqual(received("guest1"), [{ type: "postLiked", postId, likes: 2 }]);

    await act("guest2", "unlike");
    assert.deepEqual(received("guest1"), [{ type: "postLiked", postId, likes: 1 }]);
});

test("like：ない投稿には post_not_found", async () => {
    const { t, received } = await roomWithMembers();

    await t.send("guest1", { action: "like", requestId: "l", postId: "n".repeat(22) });

    const m = received("guest1")[0];
    assert.equal(m?.type === "error" && m.code, "post_not_found");
});

test("join：それまでの投稿を、古い順に分けて送る（取り消し用の鍵のハッシュは送らない）", async () => {
    const { t, created, post } = await roomWithMembers();
    const count = POSTS_PER_MESSAGE + 3;
    for (let i = 0; i < count; i++) {
        await post("guest1", { body: `投稿 ${i}` });
        t.advance(1000);
    }

    await t.send("late", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key: created.joinKey });

    const messages = t.sent.filter(([id]) => id === "late").map(([, m]) => m);
    assert.deepEqual(messages.map((m) => m.type), ["joined", "posts", "posts"]);
    const posts = messages.flatMap((m) => (m.type === "posts" ? m.posts : []));
    assert.deepEqual(posts.map((p) => p.body), Array.from({ length: count }, (_, i) => `投稿 ${i}`));
    assert.equal(JSON.stringify(messages).includes("deleteKeyHash"), false);
});

test("addTopic：最後に足して、全員にトピックの一覧を送る。select なら今のトピックにする", async () => {
    const { t, created, received } = await roomWithMembers({ topics: ["A"] });
    const room = t.memory.rooms.get(created.roomId)!;
    const first = room.currentTopicId;

    await t.send("owner", { action: "addTopic", requestId: "a1", title: "B", select: false });
    assert.deepEqual(received("owner")[0], { type: "ok", requestId: "a1" });
    const updated = received("guest1")[0];
    assert.ok(updated?.type === "topicsUpdated");
    assert.deepEqual(updated.topics.map((x) => [x.title, x.order]), [["A", 0], ["B", 1]]);
    assert.equal(updated.currentTopicId, first);
    assert.equal(room.currentTopicId, first);
    t.sent.length = 0;

    await t.send("owner", { action: "addTopic", requestId: "a2", title: "C", select: true });
    const selected = received("guest2")[0];
    assert.ok(selected?.type === "topicsUpdated");
    const c = selected.topics.find((x) => x.title === "C")!;
    assert.equal(selected.currentTopicId, c.id);
    assert.equal(room.currentTopicId, c.id);
});

test("setTopic：今のトピックを切り替えて全員に送り、そのあとの投稿は新しいトピックに入る", async () => {
    const { t, created, post, received } = await roomWithMembers({ topics: ["A", "B"] });
    const b = t.memory.topics.get(created.roomId)![1]!;

    await t.send("owner", { action: "setTopic", requestId: "s", topicId: b.id });

    assert.deepEqual(received("owner")[0], { type: "ok", requestId: "s" });
    for (const id of ["owner", "guest1", "guest2"]) {
        const m = received(id).at(-1);
        assert.ok(m?.type === "topicsUpdated", id);
        assert.equal(m.currentTopicId, b.id);
    }
    const posted = await post("guest1");
    assert.equal(t.memory.posts.get(created.roomId)!.get(posted.postId)!.topicId, b.id);
});

test("renameTopic：名前を変えて全員に送る。ないトピックは topic_not_found", async () => {
    const { t, created, received } = await roomWithMembers({ topics: ["A"] });
    const a = t.memory.topics.get(created.roomId)![0]!;

    await t.send("owner", { action: "renameTopic", requestId: "r", topicId: a.id, title: "A（質疑）" });
    const m = received("guest1")[0];
    assert.ok(m?.type === "topicsUpdated");
    assert.deepEqual(m.topics.map((x) => x.title), ["A（質疑）"]);
    t.sent.length = 0;

    await t.send("owner", { action: "renameTopic", requestId: "r", topicId: "n".repeat(22), title: "X" });
    const denied = received("owner")[0];
    assert.equal(denied?.type === "error" && denied.code, "topic_not_found");
    await t.send("owner", { action: "setTopic", requestId: "s", topicId: "n".repeat(22) });
    const deniedSet = received("owner").at(-1);
    assert.equal(deniedSet?.type === "error" && deniedSet.code, "topic_not_found");
});

test("トピックの操作は主催者だけ。参加者は forbidden で、何も変わらない", async () => {
    const { t, created, received } = await roomWithMembers({ topics: ["A", "B"] });
    const b = t.memory.topics.get(created.roomId)![1]!;

    for (const body of [
        { action: "addTopic", requestId: "x", title: "C", select: true },
        { action: "renameTopic", requestId: "x", topicId: b.id, title: "X" },
        { action: "setTopic", requestId: "x", topicId: b.id },
    ]) {
        t.sent.length = 0;
        await t.send("guest1", body);
        const m = received("guest1")[0];
        assert.equal(m?.type === "error" && m.code, "forbidden", body.action);
        assert.deepEqual(received("guest2"), []);
    }
    assert.deepEqual(t.memory.topics.get(created.roomId)!.map((x) => x.title), ["A", "B"]);
    assert.notEqual(t.memory.rooms.get(created.roomId)!.currentTopicId, b.id);
});

test("addTopic：トピックが上限なら too_many_topics", async () => {
    const { t, received } = await roomWithMembers({ topics: Array.from({ length: LIMITS.topics }, (_, i) => `T${i}`) });

    await t.send("owner", { action: "addTopic", requestId: "a", title: "もう 1 つ", select: false });

    const m = received("owner")[0];
    assert.equal(m?.type === "error" && m.code, "too_many_topics");
});

test("deletePost：主催者は鍵なしでどの投稿でも消せる。参加者は鍵なしでは forbidden", async () => {
    const { t, created, post, received } = await roomWithMembers();
    const { postId } = await post("guest1");

    await t.send("guest2", { action: "deletePost", requestId: "d", postId, key: null });
    const denied = received("guest2")[0];
    assert.equal(denied?.type === "error" && denied.code, "forbidden");
    assert.equal(t.memory.posts.get(created.roomId)!.has(postId), true);
    t.sent.length = 0;

    await t.send("owner", { action: "deletePost", requestId: "d", postId, key: null });
    assert.deepEqual(received("owner")[0], { type: "ok", requestId: "d" });
    assert.deepEqual(received("guest1"), [{ type: "postDeleted", postId }]);
    assert.equal(t.memory.posts.get(created.roomId)!.has(postId), false);
});

test("pin / unpin：主催者だけ。全員に送る", async () => {
    const { t, created, post, received } = await roomWithMembers();
    const { postId } = await post("guest1");

    await t.send("guest1", { action: "pin", requestId: "p", postId });
    const denied = received("guest1")[0];
    assert.equal(denied?.type === "error" && denied.code, "forbidden");
    t.sent.length = 0;

    await t.send("owner", { action: "pin", requestId: "p", postId });
    assert.deepEqual(received("guest2"), [{ type: "postPinned", postId, pinned: true }]);
    assert.equal(t.memory.posts.get(created.roomId)!.get(postId)!.pinned, true);
    t.sent.length = 0;

    await t.send("owner", { action: "unpin", requestId: "p", postId });
    assert.deepEqual(received("guest2"), [{ type: "postPinned", postId, pinned: false }]);
    t.sent.length = 0;

    await t.send("owner", { action: "pin", requestId: "p", postId: "n".repeat(22) });
    const missing = received("owner")[0];
    assert.equal(missing?.type === "error" && missing.code, "post_not_found");
});

test("setAccepting：締め切ると全員に送り、投稿を断る。再開すると投稿できる", async () => {
    const { t, created, received } = await roomWithMembers();

    await t.send("guest1", { action: "setAccepting", requestId: "s", accepting: false });
    const denied = received("guest1")[0];
    assert.equal(denied?.type === "error" && denied.code, "forbidden");
    t.sent.length = 0;

    await t.send("owner", { action: "setAccepting", requestId: "s", accepting: false });
    assert.deepEqual(received("guest1"), [{ type: "acceptingChanged", accepting: false }]);
    assert.equal(t.memory.rooms.get(created.roomId)!.accepting, false);
    t.sent.length = 0;

    await t.send("guest1", { action: "post", requestId: "p", kind: "comment", body: "本文", nickname: null });
    const closed = received("guest1")[0];
    assert.equal(closed?.type === "error" && closed.code, "not_accepting");
    t.sent.length = 0;

    await t.send("owner", { action: "setAccepting", requestId: "s", accepting: true });
    await t.send("guest1", { action: "post", requestId: "p", kind: "comment", body: "本文", nickname: null });
    assert.ok(received("guest1").some((m) => m.type === "posted"));
});

test("rotateKeys join：古い共有用 URL では入れない。入っている参加者はそのまま、ほかの主催者には新しい鍵を送る", async () => {
    const { t, created, received } = await roomWithMembers();
    await t.send("owner2", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key: created.adminKey });
    t.sent.length = 0;

    await t.send("guest1", { action: "rotateKeys", requestId: "k", target: "join" });
    const denied = received("guest1")[0];
    assert.equal(denied?.type === "error" && denied.code, "forbidden");
    t.sent.length = 0;

    await t.send("owner", { action: "rotateKeys", requestId: "k", target: "join" });
    const rotated = received("owner")[0];
    assert.ok(rotated?.type === "keysRotated");
    assert.notEqual(rotated.joinKey, created.joinKey);
    assert.equal("adminKey" in rotated, false);
    assert.deepEqual(received("owner2"), [{ type: "joinKeyChanged", joinKey: rotated.joinKey }]);
    // 参加者には新しい鍵を送らない
    assert.deepEqual(received("guest1"), []);
    assert.equal(t.memory.members.get(created.roomId)!.get("guest1")!.role, "participant");

    const join = async (key: string) => {
        t.sent.length = 0;
        await t.send("late", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key });
        return received("late")[0];
    };
    const old = await join(created.joinKey);
    assert.equal(old?.type === "error" && old.code, "room_not_found");
    assert.equal((await join(rotated.joinKey))?.type, "joined");
});

test("rotateKeys admin：古い主催者用 URL では主催者になれない。ほかの主催者はすぐに参加者になる", async () => {
    const { t, created, received } = await roomWithMembers();
    await t.send("owner2", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key: created.adminKey });
    t.sent.length = 0;

    await t.send("owner", { action: "rotateKeys", requestId: "k", target: "admin" });
    const rotated = received("owner")[0];
    assert.ok(rotated?.type === "keysRotated" && rotated.adminKey !== undefined);
    assert.equal(rotated.joinKey, created.joinKey);
    assert.deepEqual(received("owner2"), [{ type: "roleChanged", role: "participant" }]);
    assert.equal(t.memory.connections.get("owner2")!.role, "participant");
    assert.equal(t.memory.connections.get("owner")!.role, "admin");
    t.sent.length = 0;

    // 参加者になったので、主催者の操作はできない
    await t.send("owner2", { action: "setAccepting", requestId: "s", accepting: false });
    const denied = received("owner2")[0];
    assert.equal(denied?.type === "error" && denied.code, "forbidden");

    const join = async (key: string) => {
        t.sent.length = 0;
        await t.send("late", { action: "join", requestId: "j", browserId: BROWSER, roomId: created.roomId, key });
        return received("late")[0];
    };
    const old = await join(created.adminKey);
    assert.equal(old?.type === "error" && old.code, "room_not_found");
    const fresh = await join(rotated.adminKey!);
    assert.equal(fresh?.type === "joined" && fresh.role, "admin");
});
