import { createHash, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { ERROR_MESSAGES, parseClientMessage, RETENTIONS, type ClientMessage, type ErrorCode, type ServerMessage } from "../shared/protocol.ts";
import type { BoardStore, RoomRecord, TopicRecord } from "./store.ts";

// $connect には headers と identity が付く（APIGatewayProxyWebsocketEventV2 の型には含まれていない）
export type WebSocketEvent = APIGatewayProxyWebsocketEventV2 & {
    headers?: Record<string, string | undefined>;
    requestContext: { identity?: { sourceIp?: string } };
};

// AWS への通信・時刻・乱数は外から渡す（テストでは偽物にする）
export interface Dependencies {
    send(connectionId: string, message: ServerMessage): Promise<void>;
    // CloudFront が付ける確認用ヘッダーの値。null なら確かめない（API Gateway に直接つなぐとき）
    originSecret(): Promise<string | null>;
    store: BoardStore;
    // UNIX ミリ秒
    now(): number;
    // ルーム ID・鍵・トピック ID に使う、推測できない乱数（base64url の 22 文字）
    randomToken(): string;
    // dev 環境では、接続がどう見えているかを pong に入れて返す
    debug: boolean;
}

export const ORIGIN_HEADER = "x-origin-verify";
// CloudFront が付ける閲覧者のアドレス（「IP:ポート」。IPv6 は「[IP]:ポート」）
export const VIEWER_ADDRESS_HEADER = "cloudfront-viewer-address";

// API Gateway の WebSocket の接続は最長 2 時間。切断の通知が来なかったときのために、それより長めに残す
export const CONNECTION_TTL_SECONDS = 3 * 60 * 60;

// ルームを作るときにトピックを指定しなかった場合のトピック名
export const DEFAULT_TOPIC_TITLE = "全体";

const ok: APIGatewayProxyResult = { statusCode: 200, body: "" };
const forbidden: APIGatewayProxyResult = { statusCode: 403, body: "" };

// 操作の途中で断るときに投げる（router がエラーのメッセージにして返す）
class ActionError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode) {
        super(code);
        this.code = code;
    }
}

// API Gateway のルート（$connect / $disconnect / $default / 各操作）ごとに処理を振り分ける
export function createRouter(deps: Dependencies) {
    const nowSeconds = () => Math.floor(deps.now() / 1000);

    async function handle(connectionId: string, message: ClientMessage): Promise<void> {
        switch (message.action) {
            case "ping": {
                const debug = deps.debug ? { ip: (await deps.store.getConnection(connectionId))?.ip ?? null } : undefined;
                await deps.send(connectionId, { type: "pong", requestId: message.requestId, ...(debug && { debug }) });
                return;
            }

            case "createRoom": {
                const createdAt = deps.now();
                const titles = message.topics.length > 0 ? message.topics : [DEFAULT_TOPIC_TITLE];
                const topics: TopicRecord[] = titles.map((title, order) => ({ id: deps.randomToken(), title, order }));
                const adminKey = deps.randomToken();
                const room: RoomRecord = {
                    id: deps.randomToken(),
                    title: message.title,
                    nameMode: message.nameMode,
                    retention: message.retention,
                    accepting: true,
                    currentTopicId: topics[0]!.id,
                    joinKey: deps.randomToken(),
                    adminKeyHash: hash(adminKey),
                    createdAt,
                    expiresAt: Math.floor(createdAt / 1000) + RETENTIONS[message.retention],
                };
                await deps.store.createRoom(room, topics);
                await deps.send(connectionId, { type: "roomCreated", requestId: message.requestId, roomId: room.id, joinKey: room.joinKey, adminKey });
                return;
            }

            case "join": {
                const room = await deps.store.getRoom(message.roomId);
                // 期限切れ（TTL の削除待ち）・鍵の違いは、ルームがないのと同じに扱う（どちらなのかを教えない）
                if (!room || room.expiresAt <= nowSeconds()) {
                    throw new ActionError("room_not_found");
                }
                const role = equals(hash(message.key), room.adminKeyHash) ? "admin" : equals(message.key, room.joinKey) ? "participant" : null;
                if (!role) {
                    throw new ActionError("room_not_found");
                }

                await deps.store.joinRoom(connectionId, room.id, role, Math.min(room.expiresAt, nowSeconds() + CONNECTION_TTL_SECONDS));
                const topics = await deps.store.listTopics(room.id, nowSeconds());
                await deps.send(connectionId, {
                    type: "joined",
                    requestId: message.requestId,
                    role,
                    room: {
                        id: room.id,
                        title: room.title,
                        nameMode: room.nameMode,
                        accepting: room.accepting,
                        currentTopicId: room.currentTopicId,
                        expiresAt: room.expiresAt * 1000,
                    },
                    topics,
                    ...(role === "admin" && { joinKey: room.joinKey }),
                });
                return;
            }
        }
    }

    return async (event: WebSocketEvent): Promise<APIGatewayProxyResult> => {
        const { routeKey, connectionId } = event.requestContext;

        switch (routeKey) {
            case "$connect":
                if (!(await isFromOrigin(event, deps))) {
                    return forbidden;
                }
                await deps.store.saveConnection(connectionId, { ip: viewerIp(event) }, nowSeconds() + CONNECTION_TTL_SECONDS);
                return ok;
            case "$disconnect":
                await deps.store.deleteConnection(connectionId);
                return ok;
        }

        const parsed = parseClientMessage(event.body);
        if (!parsed.ok) {
            await sendError(connectionId, parsed.requestId, parsed.code, parsed.message);
            return ok;
        }

        try {
            await handle(connectionId, parsed.message);
        } catch (error) {
            if (!(error instanceof ActionError)) {
                // 想定外のエラーは中身を返さず、ログにだけ残す
                console.error(error);
            }
            await sendError(connectionId, parsed.message.requestId, error instanceof ActionError ? error.code : "internal_error");
        }
        return ok;
    };

    async function sendError(connectionId: string, requestId: string | null, code: ErrorCode, message?: string): Promise<void> {
        await deps.send(connectionId, { type: "error", requestId, code, message: message ?? ERROR_MESSAGES[code] });
    }
}

export function hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function equals(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

function header(event: WebSocketEvent, name: string): string | undefined {
    // API Gateway はヘッダー名の大文字・小文字をそのまま渡すため、小文字にそろえて探す
    return Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];
}

async function isFromOrigin(event: WebSocketEvent, deps: Dependencies): Promise<boolean> {
    const secret = await deps.originSecret();
    if (secret === null) {
        return true;
    }
    const value = header(event, ORIGIN_HEADER);
    return value !== undefined && equals(value, secret);
}

// CloudFront 経由なら CloudFront が付けたアドレス、直接つないだときは API Gateway が見た送信元を使う
// （CloudFront 経由のとき、送信元は CloudFront のサーバーになる）
export function viewerIp(event: WebSocketEvent): string | null {
    const address = header(event, VIEWER_ADDRESS_HEADER);
    if (address !== undefined) {
        const ipv6 = /^\[(.+)\]:\d+$/.exec(address);
        return ipv6?.[1] ?? address.replace(/:\d+$/, "");
    }
    return event.requestContext.identity?.sourceIp ?? null;
}
