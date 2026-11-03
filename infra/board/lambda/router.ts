import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
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
    type Role,
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
    // 接続をサーバーから切る（メッセージを送りすぎた接続に使う）
    disconnect(connectionId: string): Promise<void>;
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
const tooManyRequests: APIGatewayProxyResult = { statusCode: 429, body: "" };

// 操作の途中で断るときに投げる（router がエラーのメッセージにして返す）
// detail を渡すと、画面に出す文言を ERROR_MESSAGES の代わりにそれにする
class ActionError extends Error {
    readonly code: ErrorCode;
    readonly detail: string | undefined;

    constructor(code: ErrorCode, detail?: string) {
        super(code);
        this.code = code;
        this.detail = detail;
    }
}

// 同じ IP から 1 分間に投稿できる数（ブラウザ ID を変えて連投されたときの上限。会場の Wi-Fi で同じ IP になる人がいても足りる数）
const POSTS_PER_IP_PER_MINUTE = 60;

// 同じ IP から 1 分間に新しくつなげる数（会場の Wi-Fi で 30 人が同じ IP から一斉に開いても足りる数）
const CONNECTS_PER_IP_PER_MINUTE = 60;

// 1 つの接続から 10 秒間に送れるメッセージの数。超えたら接続を切る
// （ステージの流量制限は全ルームで 1 つなので、1 つの接続が送り続けてほかのルームを止めないように。ブラウザは切れたら入り直す）
const MESSAGES_PER_CONNECTION = { windowSeconds: 10, limit: 20 } as const;

// 1 ルームに同時に入れる主催者の接続の数（主催者 2〜3 人が何枚かタブを開いても足りる数。全員への配信が膨らみすぎないように）
const ADMIN_CONNECTIONS_PER_ROOM = 10;

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

    // 時間枠（windowSeconds 秒ごと）で limit 回まで。超えたら断る
    async function limit(key: string, windowSeconds: number, count: number, detail: string): Promise<void> {
        const windowStart = Math.floor(nowSeconds() / windowSeconds) * windowSeconds;
        if (!(await deps.store.consume(key, windowStart, windowSeconds, count))) {
            throw new ActionError("rate_limited", detail);
        }
    }

    // 主催者として join した接続だけ通す
    async function adminRoom(connectionId: string): Promise<RoomRecord> {
        const { connection, room } = await currentRoom(connectionId);
        if (!isAdmin(connection, room)) {
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
                const connection = await deps.store.getConnection(connectionId);
                await limit(`create#${connection?.ip ?? "unknown"}`, 60 * 60, LIMITS.roomsPerHour, `ルームを作れるのは 1 時間に ${LIMITS.roomsPerHour} 件までです。時間をおいてお試しください`);
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
                // 参加者と主催者は別に数え、主催者は参加者が満員でも入れる（入り直しで自分が数えられている場合もあるので、自分は除く）
                const members = await deps.store.listMembers(room.id, nowSeconds());
                const sameRole = members.filter((member) => member.role === role && member.connectionId !== connectionId).length;
                if (role === "participant" && sameRole >= LIMITS.members) {
                    throw new ActionError("room_full");
                }
                if (role === "admin" && sameRole >= ADMIN_CONNECTIONS_PER_ROOM) {
                    throw new ActionError("room_full", `主催者として同時に開けるのは ${ADMIN_CONNECTIONS_PER_ROOM} 件までです。使っていないタブを閉じてからもう一度開いてください`);
                }

                // 主催者は、確かめた鍵のハッシュも持たせる（このあと主催者用 URL が作り直されていたら、主催者の操作は断られる）
                const adminKeyHash = role === "admin" ? room.adminKeyHash : null;
                await deps.store.joinRoom(connectionId, room.id, role, adminKeyHash, message.browserId, Math.min(room.expiresAt, nowSeconds() + CONNECTION_TTL_SECONDS));
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
                const { connection, room } = await currentRoom(connectionId);
                // 断ることが分かっている投稿で、レート制限の回数を使わない（確実な確認は addPost の条件付きの書き込みで行う）
                if (!room.accepting) {
                    throw new ActionError("not_accepting");
                }
                if (room.postCount >= LIMITS.posts) {
                    throw new ActionError("too_many_posts");
                }
                // 同じブラウザからは postInterval 秒に 1 回。ブラウザ ID を変えた連投に備えて IP ごとの上限も付ける
                await limit(
                    `post#${room.id}#${connection.browserId ?? connectionId}`,
                    LIMITS.postInterval,
                    1,
                    `投稿は ${LIMITS.postInterval} 秒に 1 回までです。少し待ってからもう一度お試しください`,
                );
                await limit(`post-ip#${connection.ip ?? "unknown"}`, 60, POSTS_PER_IP_PER_MINUTE, "投稿が多すぎます。少し待ってからもう一度お試しください");
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
                // 鍵がなければ主催者の削除
                const room = message.key === null ? await adminRoom(connectionId) : (await currentRoom(connectionId)).room;
                if (!(await deps.store.deletePost(room.id, message.postId, message.key === null ? null : hash(message.key)))) {
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

            case "pin":
            case "unpin": {
                const room = await adminRoom(connectionId);
                const pinned = message.action === "pin";
                if (!(await deps.store.setPinned(room.id, message.postId, pinned))) {
                    throw new ActionError("post_not_found");
                }
                await deps.send(connectionId, { type: "ok", requestId: message.requestId });
                await broadcast(room.id, { type: "postPinned", postId: message.postId, pinned });
                return;
            }

            case "setAccepting": {
                const room = await adminRoom(connectionId);
                await deps.store.updateRoom(room.id, { accepting: message.accepting });
                await deps.send(connectionId, { type: "ok", requestId: message.requestId });
                await broadcast(room.id, { type: "acceptingChanged", accepting: message.accepting });
                return;
            }

            case "rotateKeys": {
                const room = await adminRoom(connectionId);
                const members = (await deps.store.listMembers(room.id, nowSeconds())).filter(
                    (member) => member.role === "admin" && member.connectionId !== connectionId,
                );
                if (message.target === "join") {
                    // 入っている参加者はそのまま（全員を追い出すと、勉強会の途中で全員が入り直すことになる）。新しく入るときは新しい URL が要る
                    const joinKey = deps.randomToken();
                    await deps.store.updateRoom(room.id, { joinKey });
                    await deps.send(connectionId, { type: "keysRotated", requestId: message.requestId, joinKey });
                    // 古い主催者用 URL で入ったまま参加者に戻せていない接続には送らない
                    await Promise.all(members.filter((member) => isAdmin(member, room)).map((member) => deps.send(member.connectionId, { type: "joinKeyChanged", joinKey })));
                    return;
                }
                // 主催者用 URL が漏れたときのため、ほかの主催者はすぐに参加者にする（新しい URL を受け取ったら入り直す）
                // 主催者の操作は、入ったときの鍵がルームの鍵と同じかで確かめるので、鍵を変えた時点で古い鍵の主催者は操作できなくなる。
                // 参加者に戻すのは表示を合わせるためで、途中で接続が切れた人がいても、ほかの人は続けて戻す
                const adminKey = deps.randomToken();
                await deps.store.rotateAdminKey(room.id, connectionId, hash(adminKey));
                await deps.send(connectionId, { type: "keysRotated", requestId: message.requestId, joinKey: room.joinKey, adminKey });
                const results = await Promise.allSettled(
                    members.map(async (member) => {
                        await deps.store.demote(member.connectionId, room.id);
                        await deps.send(member.connectionId, { type: "roleChanged", role: "participant" });
                    }),
                );
                for (const result of results) {
                    if (result.status === "rejected") {
                        console.error(result.reason);
                    }
                }
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
            case "$connect": {
                if (!(await isFromOrigin(event, deps))) {
                    return forbidden;
                }
                const ip = viewerIp(event);
                const windowStart = Math.floor(nowSeconds() / 60) * 60;
                if (!(await deps.store.consume(`connect#${ip ?? "unknown"}`, windowStart, 60, CONNECTS_PER_IP_PER_MINUTE))) {
                    return tooManyRequests;
                }
                await deps.store.saveConnection(connectionId, { ip }, nowSeconds() + CONNECTION_TTL_SECONDS);
                return ok;
            }
            case "$disconnect":
                await deps.store.deleteConnection(connectionId);
                return ok;
        }

        // 送りすぎた接続は、断ってから切る
        const windowStart = Math.floor(nowSeconds() / MESSAGES_PER_CONNECTION.windowSeconds) * MESSAGES_PER_CONNECTION.windowSeconds;
        if (!(await deps.store.consume(`message#${connectionId}`, windowStart, MESSAGES_PER_CONNECTION.windowSeconds, MESSAGES_PER_CONNECTION.limit))) {
            await sendError(connectionId, null, "rate_limited");
            await deps.disconnect(connectionId);
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
            await sendError(
                connectionId,
                parsed.message.requestId,
                error instanceof ActionError ? error.code : "internal_error",
                error instanceof ActionError ? error.detail : undefined,
            );
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

// 主催者として入っていて、そのときの鍵がいまのルームの鍵と同じか
function isAdmin(record: { role?: Role; adminKeyHash?: string }, room: RoomRecord): boolean {
    return record.role === "admin" && record.adminKeyHash !== undefined && equals(record.adminKeyHash, room.adminKeyHash);
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
// IPv6 は、ふつう 1 つの契約に /64 がまとめて割り当てられ、アドレスを変えながらつなげるので、/64 ごとに数える
// IP の形になっていない値は使わない（IP ごとの上限は "unknown" でまとめて数える）
export function viewerIp(event: WebSocketEvent): string | null {
    const address = header(event, VIEWER_ADDRESS_HEADER);
    const ip = address === undefined ? event.requestContext.identity?.sourceIp : (/^\[(.+)\]:\d+$/.exec(address)?.[1] ?? address.replace(/:\d+$/, ""));
    if (ip === undefined) {
        return null;
    }
    switch (isIP(ip)) {
        case 4:
            return ip;
        case 6:
            return ipv6Prefix64(ip);
        default:
            return null;
    }
}

// IPv6 の上位 64 ビット（例：2001:db8:0:1::5 → 2001:db8:0:1::/64）。IPv4 を埋め込んだ形（::ffff:192.0.2.1）は IPv4 にする
function ipv6Prefix64(ip: string): string {
    const embedded = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (embedded) {
        return embedded[1]!;
    }
    const [head, tail] = ip.split("::") as [string, string | undefined];
    const groups = (part: string | undefined) => (part ? part.split(":") : []);
    // 末尾が IPv4 の形のときは 2 つの 16 ビットにする（上位 64 ビットには関わらないので 0 で埋める）
    const tailGroups = groups(tail).flatMap((group) => (group.includes(".") ? ["0", "0"] : [group]));
    const headGroups = groups(head).flatMap((group) => (group.includes(".") ? ["0", "0"] : [group]));
    const all = tail === undefined ? headGroups : [...headGroups, ...Array<string>(8 - headGroups.length - tailGroups.length).fill("0"), ...tailGroups];
    return `${all
        .slice(0, 4)
        .map((group) => parseInt(group, 16).toString(16))
        .join(":")}::/64`;
}
