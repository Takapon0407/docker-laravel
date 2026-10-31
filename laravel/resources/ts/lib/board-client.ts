// 匿名質問ボードの WebSocket のクライアント（DOM に依存しない。node --test でテストする）
// - 送ったメッセージには requestId を付け、同じ requestId の返事で request() の Promise を解決する
// - 切断されたら少しずつ間隔をあけて再接続し、onOpen で呼び出し元に知らせる（ルームに入り直すため）

import type { ClientMessage, ErrorCode, ServerMessage } from "../../../../infra/board/shared/protocol.ts";

// ClientMessage から requestId を除いたもの（requestId はクライアントが付ける）
export type Request = ClientMessage extends infer M ? (M extends ClientMessage ? Omit<M, "requestId"> : never) : never;

export type Status = "connecting" | "open" | "closed";

export class BoardRequestError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.code = code;
    }
}

// テストで偽物に差し替えられるよう、使う機能だけを書く
export interface SocketLike {
    readonly readyState: number;
    send(data: string): void;
    close(): void;
    addEventListener(type: "open" | "close", listener: () => void): void;
    addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

export interface BoardClientOptions {
    url: string;
    createSocket?: (url: string) => SocketLike;
    // 接続できたとき（再接続を含む）
    onOpen?: () => void;
    // 返事以外のメッセージ（ほかの人の操作の通知など）
    onPush?: (message: ServerMessage) => void;
    onStatus?: (status: Status) => void;
    // 返事が来ないとき、あきらめるまでの時間
    timeoutMs?: number;
    setTimeout?: (callback: () => void, ms: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
}

const OPEN = 1;
// 再接続の間隔（回数ごと。最後の値をくり返す）
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000];

interface Pending {
    resolve: (message: ServerMessage) => void;
    reject: (error: Error) => void;
    timer: unknown;
}

export class BoardClient {
    private readonly options: Required<Omit<BoardClientOptions, "onOpen" | "onPush" | "onStatus">> & BoardClientOptions;
    private socket: SocketLike | null = null;
    private readonly pending = new Map<string, Pending>();
    private sequence = 0;
    private attempts = 0;
    private stopped = false;

    constructor(options: BoardClientOptions) {
        this.options = {
            createSocket: (url) => new WebSocket(url),
            timeoutMs: 10000,
            setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
            clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
            ...options,
        };
    }

    connect(): void {
        this.stopped = false;
        this.open();
    }

    close(): void {
        this.stopped = true;
        this.socket?.close();
    }

    // 送って、同じ requestId の返事を待つ。エラーの返事は BoardRequestError で reject する
    request(message: Request): Promise<ServerMessage> {
        const socket = this.socket;
        if (!socket || socket.readyState !== OPEN) {
            return Promise.reject(new BoardRequestError("internal_error", "サーバーにつながっていません。少し待ってからもう一度お試しください"));
        }
        const requestId = `r${++this.sequence}`;
        return new Promise((resolve, reject) => {
            const timer = this.options.setTimeout(() => {
                this.pending.delete(requestId);
                reject(new BoardRequestError("internal_error", "サーバーから返事がありません。もう一度お試しください"));
            }, this.options.timeoutMs);
            this.pending.set(requestId, { resolve, reject, timer });
            socket.send(JSON.stringify({ ...message, requestId }));
        });
    }

    private open(): void {
        this.options.onStatus?.("connecting");
        const socket = this.options.createSocket(this.options.url);
        this.socket = socket;

        socket.addEventListener("open", () => {
            this.attempts = 0;
            this.options.onStatus?.("open");
            this.options.onOpen?.();
        });
        socket.addEventListener("message", (event) => this.receive(event.data));
        socket.addEventListener("close", () => {
            if (this.socket !== socket) {
                return;
            }
            this.socket = null;
            // 返事を待っていたものは、もう返事が来ないので失敗にする
            for (const [requestId, pending] of this.pending) {
                this.options.clearTimeout(pending.timer);
                pending.reject(new BoardRequestError("internal_error", "接続が切れました。もう一度お試しください"));
                this.pending.delete(requestId);
            }
            this.options.onStatus?.("closed");
            if (!this.stopped) {
                const delay = RECONNECT_DELAYS_MS[Math.min(this.attempts, RECONNECT_DELAYS_MS.length - 1)]!;
                this.attempts++;
                this.options.setTimeout(() => this.open(), delay);
            }
        });
    }

    private receive(data: unknown): void {
        let message: ServerMessage;
        try {
            message = JSON.parse(String(data)) as ServerMessage;
        } catch {
            return;
        }
        const requestId = "requestId" in message ? message.requestId : null;
        const pending = requestId ? this.pending.get(requestId) : undefined;
        if (!requestId || !pending) {
            this.options.onPush?.(message);
            return;
        }
        this.pending.delete(requestId);
        this.options.clearTimeout(pending.timer);
        if (message.type === "error") {
            pending.reject(new BoardRequestError(message.code, message.message));
        } else {
            pending.resolve(message);
        }
    }
}
