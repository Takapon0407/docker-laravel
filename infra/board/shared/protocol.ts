// ブラウザと Lambda がやり取りする WebSocket のメッセージ（両方から使う）
// 操作は Issue #252 の設計に合わせて少しずつ足していく

export type ClientMessage = { action: "ping"; requestId: string };

export type ServerMessage =
    // debug は dev 環境でだけ付ける（接続がどう見えているかの確認用）
    | { type: "pong"; requestId: string; debug?: { ip: string | null } }
    | { type: "error"; requestId: string | null; code: ErrorCode; message: string };

export type ErrorCode = "invalid_message" | "unknown_action" | "internal_error";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export type ParseResult = { ok: true; message: ClientMessage } | { ok: false; requestId: string | null; code: ErrorCode };

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

    const { action, requestId } = data as Record<string, unknown>;
    if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
        return { ok: false, requestId: null, code: "invalid_message" };
    }

    switch (action) {
        case "ping":
            return { ok: true, message: { action, requestId } };
        default:
            return { ok: false, requestId, code: "unknown_action" };
    }
}
