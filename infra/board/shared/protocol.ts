// ブラウザと Lambda がやり取りする WebSocket のメッセージと、その検証（両方から使う）
// 操作は Issue #252 の設計に合わせて少しずつ足していく

export const RETENTIONS = { "24h": 24 * 60 * 60, "7d": 7 * 24 * 60 * 60, "30d": 30 * 24 * 60 * 60 } as const;
export type Retention = keyof typeof RETENTIONS;

// nickname: ニックネームを入れられる / anonymous: 名前の欄を出さない
export type NameMode = "nickname" | "anonymous";

export const LIMITS = {
    title: 50,
    topicTitle: 40,
    topics: 20,
} as const;

export type ClientMessage =
    | { action: "ping"; requestId: string }
    | { action: "createRoom"; requestId: string; title: string; retention: Retention; nameMode: NameMode; topics: string[] }
    | { action: "join"; requestId: string; roomId: string; key: string };

export type Role = "participant" | "admin";

export interface RoomView {
    id: string;
    title: string;
    nameMode: NameMode;
    accepting: boolean;
    currentTopicId: string;
    // UNIX ミリ秒
    expiresAt: number;
}

export interface TopicView {
    id: string;
    title: string;
    order: number;
}

export type ServerMessage =
    // debug は dev 環境でだけ付ける（接続がどう見えているかの確認用）
    | { type: "pong"; requestId: string; debug?: { ip: string | null } }
    | { type: "roomCreated"; requestId: string; roomId: string; joinKey: string; adminKey: string }
    // joinKey は主催者にだけ返す（共有用 URL を表示するため）
    | { type: "joined"; requestId: string; role: Role; room: RoomView; topics: TopicView[]; joinKey?: string }
    | { type: "error"; requestId: string | null; code: ErrorCode; message: string };

export type ErrorCode = "invalid_message" | "unknown_action" | "validation_error" | "room_not_found" | "internal_error";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
// ルーム ID と鍵は 16 バイトの乱数を base64url にしたもの（22 文字）
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export type ParseResult =
    | { ok: true; message: ClientMessage }
    | { ok: false; requestId: string | null; code: ErrorCode; message?: string };

// 絵文字なども 1 文字として数える
export function length(text: string): number {
    return [...text].length;
}

// 受け取った文字列を検証する（形が合わないものは、どのルートでも処理しない）
export function parseClientMessage(body: string | null | undefined): ParseResult {
    let data: unknown;
    try {
        data = JSON.parse(body ?? "");
    } catch {
        return { ok: false, requestId: null, code: "invalid_message" };
    }
    if (typeof data !== "object" || data === null) {
        return { ok: false, requestId: null, code: "invalid_message" };
    }

    const fields = data as Record<string, unknown>;
    const { action, requestId } = fields;
    if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
        return { ok: false, requestId: null, code: "invalid_message" };
    }
    const invalid = (message: string): ParseResult => ({ ok: false, requestId, code: "validation_error", message });

    switch (action) {
        case "ping":
            return { ok: true, message: { action, requestId } };

        case "createRoom": {
            const { retention, nameMode, topics } = fields;
            const title = typeof fields.title === "string" ? fields.title.trim() : "";
            if (title === "" || length(title) > LIMITS.title) {
                return invalid(`タイトルは 1〜${LIMITS.title} 文字で入力してください`);
            }
            if (typeof retention !== "string" || !Object.hasOwn(RETENTIONS, retention)) {
                return invalid("保存期間を選んでください");
            }
            if (nameMode !== "nickname" && nameMode !== "anonymous") {
                return invalid("名前の扱いを選んでください");
            }
            if (!Array.isArray(topics) || topics.length > LIMITS.topics) {
                return invalid(`トピックは ${LIMITS.topics} 個までです`);
            }
            const topicTitles = topics.map((t) => (typeof t === "string" ? t.trim() : ""));
            if (topicTitles.some((t) => t === "" || length(t) > LIMITS.topicTitle)) {
                return invalid(`トピック名は 1〜${LIMITS.topicTitle} 文字で入力してください`);
            }
            return { ok: true, message: { action, requestId, title, retention: retention as Retention, nameMode, topics: topicTitles } };
        }

        case "join": {
            const { roomId, key } = fields;
            if (typeof roomId !== "string" || !TOKEN_PATTERN.test(roomId) || typeof key !== "string" || !TOKEN_PATTERN.test(key)) {
                return { ok: false, requestId, code: "room_not_found" };
            }
            return { ok: true, message: { action, requestId, roomId, key } };
        }

        default:
            return { ok: false, requestId, code: "unknown_action" };
    }
}

// エラーの種類ごとの、画面に出す文言
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    invalid_message: "メッセージの形式が正しくありません",
    unknown_action: "その操作はできません",
    validation_error: "入力内容を確認してください",
    room_not_found: "ルームが見つかりません。URL が正しいか、保存期間が過ぎていないか確認してください",
    internal_error: "エラーが発生しました。時間をおいてもう一度お試しください",
};
