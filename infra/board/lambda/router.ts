import { createHash, timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import {
    ERROR_MESSAGES,
    LIMITS,
    parseClientMessage,
    POSTS_PER_MESSAGE,
    RETENTIONS,
    type ClientMessage,
    type ErrorCode,
    type PostView,
    type ServerMessage,
} from "../shared/protocol.ts";
import type { BoardStore, ConnectionRecord, PostRecord, RoomRecord, TopicRecord } from "./store.ts";

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

    // join したルームと接続の情報。入っていない・ルームの期限が切れたときは断る
    async function currentRoom(connectionId: string): Promise<{ connection: ConnectionRecord & { roomId: string }; room: RoomRecord }> {
        const connection = await deps.store.getConnection(connectionId);
        if (!connection?.roomId) {
            throw new ActionError("not_joined");
        }
        const room = await deps.store.getRoom(connection.roomId);
        if (!room || room.expiresAt <= nowSeconds()) {
            throw new ActionError("room_not_found");
        }
        return { connection: { ...connection, roomId: connection.roomId }, room };
    }

    // 主催者として join した接続だけ通す
    async function adminRoom(connectionId: string): Promise<RoomRecord> {
        const { connection, room } = await currentRoom(connectionId);
        if (connection.role !== "admin") {
            throw new ActionError("forbidden");
        }
        return room;
    }

    async function broadcastTopics(roomId: string, currentTopicId: string): Promise<void> {
        const topics = await deps.store.listTopics(roomId, nowSeconds());
        await broadcast(roomId, { type: "topicsUpdated", topics, currentTopicId });
    }

    // 同じルームに入っている全員に送る（1 人に送れなくても、ほかの人には送る）
    async function broadcast(roomId: string, message: ServerMessage): Promise<void> {
        const members = await deps.store.listMembers(roomId, nowSeconds());
        const results = await Promise.allSettled(members.map((member) => deps.send(member.connectionId, message)));
        for (const result of results) {
            if (result.status === "rejected") {
                console.error(result.reason);
            }
        }
    }

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
                    postCount: 0,
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

                await deps.store.joinRoom(connectionId, room.id, role, message.browserId, Math.min(room.expiresAt, nowSeconds() + CONNECTION_TTL_SECONDS));
                const [topics, posts] = await Promise.all([deps.store.listTopics(room.id, nowSeconds()), deps.store.listPosts(room.id)]);
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
                // 投稿は 1 メッセージの上限に収まるよう分けて送る（古い順）
                const views = posts.sort((a, b) => a.createdAt - b.createdAt).map(toView);
                for (let i = 0; i < views.length; i += POSTS_PER_MESSAGE) {
                    await deps.send(connectionId, { type: "posts", posts: views.slice(i, i + POSTS_PER_MESSAGE) });
                }
                return;
            }

            case "post": {
                const { room } = await currentRoom(connectionId);
                const deleteKey = deps.randomToken();
                const post: PostRecord = {
                    id: deps.randomToken(),
                    // 投稿は今のトピックに入れる
                    topicId: room.currentTopicId,
                    kind: message.kind,
                    body: message.body,
                    nickname: room.nameMode === "anonymous" ? null : message.nickname,
                    likes: 0,
                    pinned: false,
                    deleteKeyHash: hash(deleteKey),
                    createdAt: deps.now(),
                };
                const result = await deps.store.addPost(room.id, post, room.expiresAt);
                if (result !== "added") {
                    throw new ActionError(result);
                }
                await deps.send(connectionId, { type: "posted", requestId: message.requestId, postId: post.id, deleteKey });
                await broadcast(room.id, { type: "postAdded", post: toView(post) });
                return;
            }

            case "deletePost": {
                const { room } = await currentRoom(connectionId);
                if (!(await deps.store.deletePost(room.id, message.postId, hash(message.key)))) {
                    // 鍵が違うときも、投稿がないのと同じに扱う
                    throw new ActionError("post_not_found");
                }
                await deps.send(connectionId, { type: "ok", requestId: message.requestId });
                await broadcast(room.id, { type: "postDeleted", postId: message.postId });
                return;
            }

            case "like":
            case "unlike": {
                const { connection, room } = await currentRoom(connectionId);
                if (!connection.browserId) {
                    throw new ActionError("not_joined");
                }
                const result =
                    message.action === "like"
                        ? await deps.store.like(room.id, message.postId, connection.browserId, room.expiresAt)
                        : await deps.store.unlike(room.id, message.postId, connection.browserId);
                if (result.status === "not_found") {
                    throw new ActionError("post_not_found");
                }
                await deps.send(connectionId, { type: "ok", requestId: message.requestId });
                const liked: ServerMessage = { type: "postLiked", postId: message.postId, likes: result.likes };
                // 数が変わったときだけ全員に送る（すでにいいね済みなどのときは、押した人の表示だけ合わせる）
                await (result.status === "changed" ? broadcast(room.id, liked) : deps.send(connectionId, liked));
                return;
            }

            case "addTopic": {
                const room = await adminRoom(connectionId);
                const topics = await deps.store.listTopics(room.id, nowSeconds());
                if (topics.length >= LIMITS.topics) {
                    throw new ActionError("too_many_topics");
                }
                // 最後に足す
                const topic: TopicRecord = { id: deps.randomToken(), title: message.title, order: Math.max(-1, ...topics.map((t) => t.order)) + 1 };
                await deps.store.putTopic(room.id, topic, room.expiresAt);
                if (message.select) {
                    await deps.store.setCurrentTopic(room.id, topic.id);
                }
                await deps.send(connectionId, { type: "ok", requestId: message.requestId });
                await broadcastTopics(room.id, message.select ? topic.id : room.currentTopicId);
                return;
            }

            case "renameTopic": {
                const room = await adminRoom(connectionId);
                if (!(await deps.store.renameTopic(room.id, message.topicId, message.title))) {
                    throw new ActionError("topic_not_found");
                }
                await deps.send(connectionId, { type: "ok", requestId: message.requestId });
                await broadcastTopics(room.id, room.currentTopicId);
                return;
            }

            case "setTopic": {
                const room = await adminRoom(connectionId);
                const topics = await deps.store.listTopics(room.id, nowSeconds());
                if (!topics.some((t) => t.id === message.topicId)) {
                    throw new ActionError("topic_not_found");
                }
                await deps.store.setCurrentTopic(room.id, message.topicId);
                await deps.send(connectionId, { type: "ok", requestId: message.requestId });
                await broadcast(room.id, { type: "topicsUpdated", topics, currentTopicId: message.topicId });
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

// 取り消し用の鍵のハッシュは画面に送らない
function toView({ deleteKeyHash: _deleteKeyHash, ...post }: PostRecord): PostView {
    return post;
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
