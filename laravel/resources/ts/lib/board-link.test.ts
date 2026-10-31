import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoomUrl, forgetAdminKey, loadAdminKey, parseRoomHash, saveAdminKey, websocketUrl, type KeyValueStorage } from "./board-link.ts";

const ROOM = "R".repeat(22);
const KEY = "k-_".repeat(7) + "x";

test("URL の # にルーム ID と鍵を入れ、そこから読み戻せる", () => {
    const url = buildRoomUrl("https://example.com", { roomId: ROOM, key: KEY });

    assert.equal(url, `https://example.com/tools/board/room#r=${ROOM}&k=${KEY}`);
    assert.deepEqual(parseRoomHash(new URL(url).hash), { roomId: ROOM, key: KEY });
    assert.deepEqual(parseRoomHash(`r=${ROOM}&k=${KEY}`), { roomId: ROOM, key: KEY });
});

test("# がない・形が正しくないときは null", () => {
    for (const hash of ["", "#", `#r=${ROOM}`, `#k=${KEY}`, `#r=short&k=${KEY}`, `#r=${ROOM}&k=${KEY}!`]) {
        assert.equal(parseRoomHash(hash), null, hash);
    }
});

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
        data,
        getItem: (k) => data.get(k) ?? null,
        setItem: (k, v) => void data.set(k, v),
        removeItem: (k) => void data.delete(k),
    };
}

test("主催者の鍵をルームごとに残し、読み出し・削除できる", () => {
    const storage = memoryStorage();

    saveAdminKey(storage, ROOM, KEY);
    assert.equal(loadAdminKey(storage, ROOM), KEY);
    assert.equal(loadAdminKey(storage, "O".repeat(22)), null);

    forgetAdminKey(storage, ROOM);
    assert.equal(loadAdminKey(storage, ROOM), null);
});

test("壊れた値や、保存できない環境では null として扱い、例外を出さない", () => {
    const storage = memoryStorage();
    storage.data.set(`board:admin:${ROOM}`, "broken");
    assert.equal(loadAdminKey(storage, ROOM), null);

    const failing: KeyValueStorage = {
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
    assert.equal(loadAdminKey(failing, ROOM), null);
    saveAdminKey(failing, ROOM, KEY);
    forgetAdminKey(failing, ROOM);
});

test("WebSocket の URL は設定を優先し、なければページと同じドメインの /tools/board/ws", () => {
    assert.equal(websocketUrl("wss://dev.example.net/tools/board/ws", { protocol: "http:", host: "localhost" }), "wss://dev.example.net/tools/board/ws");
    assert.equal(websocketUrl("", { protocol: "https:", host: "tektektech-portfolio.com" }), "wss://tektektech-portfolio.com/tools/board/ws");
    assert.equal(websocketUrl(null, { protocol: "http:", host: "localhost:8080" }), "ws://localhost:8080/tools/board/ws");
});
