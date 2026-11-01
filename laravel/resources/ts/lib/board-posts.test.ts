import { test } from "node:test";
import assert from "node:assert/strict";
import type { PostView } from "../../../../infra/board/shared/protocol.ts";
import type { KeyValueStorage } from "./board-link.ts";
import { loadBrowserId, loadDeleteKeys, loadLikes, randomToken, saveDeleteKeys, saveLikes, sortPosts } from "./board-posts.ts";

function post(id: string, fields: Partial<PostView> = {}): PostView {
    return { id, topicId: "t", kind: "question", body: id, nickname: null, likes: 0, pinned: false, createdAt: 0, ...fields };
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => void data.set(k, v),
        removeItem: (k) => void data.delete(k),
    };
}

const throwingStorage: KeyValueStorage = {
    getItem: () => {
        throw new Error("denied");
    },
    setItem: () => {
        throw new Error("denied");
    },
    removeItem: () => {
        throw new Error("denied");
    },
};

test("新着順：ピン留めが一番上、あとは新しい順", () => {
    const posts = [post("old", { createdAt: 1 }), post("pinned", { createdAt: 0, pinned: true }), post("new", { createdAt: 2 })];

    assert.deepEqual(sortPosts(posts, "new").map((p) => p.id), ["pinned", "new", "old"]);
});

test("いいね順：ピン留めが一番上、あとはいいねの多い順。同じ数なら新しい順", () => {
    const posts = [
        post("few", { likes: 1, createdAt: 3 }),
        post("many-old", { likes: 5, createdAt: 1 }),
        post("many-new", { likes: 5, createdAt: 2 }),
        post("pinned", { likes: 0, pinned: true }),
    ];

    assert.deepEqual(sortPosts(posts, "likes").map((p) => p.id), ["pinned", "many-new", "many-old", "few"]);
});

test("randomToken：16 バイトを base64url の 22 文字にする", () => {
    assert.equal(randomToken((bytes) => bytes.fill(0xff)), "_".repeat(21) + "w");
    assert.match(randomToken(), /^[A-Za-z0-9_-]{22}$/);
});

test("ブラウザ ID：なければ作って残し、次からは同じものを使う", () => {
    const storage = memoryStorage();

    const first = loadBrowserId(storage, () => "a".repeat(22));
    const second = loadBrowserId(storage, () => "b".repeat(22));

    assert.equal(first, "a".repeat(22));
    assert.equal(second, first);
    // 形が正しくなければ作り直す
    storage.data.set("board:browser", "broken");
    assert.equal(loadBrowserId(storage, () => "c".repeat(22)), "c".repeat(22));
});

test("取り消し用の鍵・いいねした投稿は、ルームごとに残して読み戻せる", () => {
    const storage = memoryStorage();

    saveDeleteKeys(storage, "room1", new Map([["p1", "k1"]]));
    saveLikes(storage, "room1", new Set(["p2"]));

    assert.deepEqual([...loadDeleteKeys(storage, "room1")], [["p1", "k1"]]);
    assert.deepEqual([...loadLikes(storage, "room1")], ["p2"]);
    assert.equal(loadDeleteKeys(storage, "room2").size, 0);
});

test("残したものが壊れている・使えない環境でも、空として扱う", () => {
    const storage = memoryStorage();
    storage.data.set("board:posts:room", "not json");
    storage.data.set("board:likes:room", '{"a":1}');

    assert.equal(loadDeleteKeys(storage, "room").size, 0);
    assert.equal(loadLikes(storage, "room").size, 0);
    assert.equal(loadBrowserId(throwingStorage, () => "a".repeat(22)), "a".repeat(22));
    assert.doesNotThrow(() => saveLikes(throwingStorage, "room", new Set(["p"])));
});
