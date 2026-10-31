import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { parseClientMessage, type ServerMessage } from "../shared/protocol.ts";

// $connect には headers が付く（APIGatewayProxyWebsocketEventV2 の型には含まれていない）
export type WebSocketEvent = APIGatewayProxyWebsocketEventV2 & { headers?: Record<string, string | undefined> };

// AWS への通信は外から渡す（テストでは偽物にする）
export interface Dependencies {
    send(connectionId: string, message: ServerMessage): Promise<void>;
    // CloudFront が付ける確認用ヘッダーの値。null なら確かめない（dev で API Gateway に直接つなぐとき）
    originSecret(): Promise<string | null>;
}

export const ORIGIN_HEADER = "x-origin-verify";

const ok: APIGatewayProxyResult = { statusCode: 200, body: "" };
const forbidden: APIGatewayProxyResult = { statusCode: 403, body: "" };

// API Gateway のルート（$connect / $disconnect / $default / 各操作）ごとに処理を振り分ける
export function createRouter(deps: Dependencies) {
    return async (event: WebSocketEvent): Promise<APIGatewayProxyResult> => {
        const { routeKey, connectionId } = event.requestContext;

        switch (routeKey) {
            case "$connect":
                return (await isFromOrigin(event, deps)) ? ok : forbidden;
            case "$disconnect":
                return ok;
        }

        const parsed = parseClientMessage(event.body);
        if (!parsed.ok) {
            await deps.send(connectionId, {
                type: "error",
                requestId: parsed.requestId,
                code: parsed.code,
                message: parsed.code === "unknown_action" ? "その操作はできません" : "メッセージの形式が正しくありません",
            });
            return ok;
        }

        switch (parsed.message.action) {
            case "ping":
                await deps.send(connectionId, { type: "pong", requestId: parsed.message.requestId });
                return ok;
        }
    };
}

async function isFromOrigin(event: WebSocketEvent, deps: Dependencies): Promise<boolean> {
    const secret = await deps.originSecret();
    if (secret === null) {
        return true;
    }
    // API Gateway はヘッダー名の大文字・小文字をそのまま渡すため、小文字にそろえて探す
    const header = Object.entries(event.headers ?? {}).find(([name]) => name.toLowerCase() === ORIGIN_HEADER)?.[1];
    if (header === undefined) {
        return false;
    }
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}
