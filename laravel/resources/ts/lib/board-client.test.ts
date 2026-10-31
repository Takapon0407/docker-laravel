import { test } from "node:test";
import assert from "node:assert/strict";
import { BoardClient, BoardRequestError, type SocketLike, type Status } from "./board-client.ts";

// 偽物の WebSocket と、手で進めるタイマー
class FakeSocket implements SocketLike {
    readyState = 0;
    sent: unknown[] = [];
    private listeners: Record<string, ((event?: { data: unknown }) => void)[]> = {};

    addEventListener(type: string, listener: (event?: { data: unknown }) => void): void {
        (this.listeners[type] ??= []).push(listener);
    }
    send(data: string): void {
        this.sent.push(JSON.parse(data));
    }
    close(): void {
        this.emitClose();
    }
    emitOpen(): void {
        this.readyState = 1;
        this.listeners.open?.forEach((l) => l());
    }
    emitMessage(message: unknown): void {
        this.listeners.message?.forEach((l) => l({ data: JSON.stringify(message) }));
    }
    emitClose(): void {
        this.readyState = 3;
        this.listeners.close?.forEach((l) => l());
    }
}

function setUp() {
    const sockets: FakeSocket[] = [];
    const timers: { callback: () => void; ms: number; cleared: boolean }[] = [];
    const statuses: Status[] = [];
    const pushes: unknown[] = [];
    let opens = 0;
    const client = new BoardClient({
        url: "wss://example.com/tools/board/ws",
        createSocket: () => {
            const socket = new FakeSocket();
            sockets.push(socket);
            return socket;
        },
        onOpen: () => opens++,
        onPush: (m) => pushes.push(m),
        onStatus: (s) => statuses.push(s),
        timeoutMs: 5000,
        setTimeout: (callback, ms) => {
            const timer = { callback, ms, cleared: false };
            timers.push(timer);
            return timer;
        },
        clearTimeout: (handle) => {
            (handle as { cleared: boolean }).cleared = true;
        },
    });
    const fire = (ms: number) => timers.filter((t) => t.ms === ms && !t.cleared).forEach((t) => ((t.cleared = true), t.callback()));
    return { client, sockets, timers, statuses, pushes, fire, opens: () => opens };
}

test("返事の requestId で request() を解決し、それ以外は onPush に渡す", async () => {
    const t = setUp();
    t.client.connect();
    t.sockets[0]!.emitOpen();

    const promise = t.client.request({ action: "ping" });
    const sent = t.sockets[0]!.sent[0] as { action: string; requestId: string };
    assert.equal(sent.action, "ping");

    t.sockets[0]!.emitMessage({ type: "roomUpdated" });
    t.sockets[0]!.emitMessage({ type: "pong", requestId: sent.requestId });

    assert.deepEqual(await promise, { type: "pong", requestId: sent.requestId });
    assert.deepEqual(t.pushes, [{ type: "roomUpdated" }]);
    assert.deepEqual(t.statuses, ["connecting", "open"]);
});

test("エラーの返事は BoardRequestError で reject する", async () => {
    const t = setUp();
    t.client.connect();
    t.sockets[0]!.emitOpen();

    const promise = t.client.request({ action: "join", roomId: "r", key: "k" });
    const { requestId } = t.sockets[0]!.sent[0] as { requestId: string };
    t.sockets[0]!.emitMessage({ type: "error", requestId, code: "room_not_found", message: "見つかりません" });

    await assert.rejects(promise, (error: unknown) => error instanceof BoardRequestError && error.code === "room_not_found" && error.message === "見つかりません");
});

test("つながっていないとき・返事がないときは失敗にする", async () => {
    const t = setUp();
    t.client.connect();
    await assert.rejects(t.client.request({ action: "ping" }), BoardRequestError);

    t.sockets[0]!.emitOpen();
    const promise = t.client.request({ action: "ping" });
    t.fire(5000);
    await assert.rejects(promise, /返事がありません/);
});

test("切断されたら待っている request を失敗にし、間隔をあけて再接続して onOpen を呼ぶ", async () => {
    const t = setUp();
    t.client.connect();
    t.sockets[0]!.emitOpen();
    const promise = t.client.request({ action: "ping" });

    t.sockets[0]!.emitClose();
    await assert.rejects(promise, /接続が切れました/);
    assert.equal(t.statuses.at(-1), "closed");

    // 1 回目は 1 秒後、続けて失敗すると 2 秒後
    t.fire(1000);
    assert.equal(t.sockets.length, 2);
    t.sockets[1]!.emitClose();
    t.fire(2000);
    assert.equal(t.sockets.length, 3);

    t.sockets[2]!.emitOpen();
    assert.equal(t.opens(), 2);
    // つながったら間隔は最初に戻る
    t.sockets[2]!.emitClose();
    t.fire(1000);
    assert.equal(t.sockets.length, 4);
});

test("close() したあとは再接続しない", () => {
    const t = setUp();
    t.client.connect();
    t.sockets[0]!.emitOpen();

    t.client.close();
    t.fire(1000);

    assert.equal(t.sockets.length, 1);
});
