import { timingSafeEqual } from "node:crypto";
import type { APIGatewayProxyResult, APIGatewayProxyWebsocketEventV2 } from "aws-lambda";
import { parseClientMessage, type ServerMessage } from "../shared/protocol.ts";

// $connect には headers と identity が付く（APIGatewayProxyWebsocketEventV2 の型には含まれていない）
export type WebSocketEvent = APIGatewayProxyWebsocketEventV2 & {
    headers?: Record<string, string | undefined>;
    requestContext: { identity?: { sourceIp?: string } };
};

export interface Connection {
    ip: string | null;
}

// AWS への通信は外から渡す（テストでは偽物にする）
export interface Dependencies {
    send(connectionId: string, message: ServerMessage): Promise<void>;
    // CloudFront が付ける確認用ヘッダーの値。null なら確かめない（dev で API Gateway に直接つなぐとき）
    originSecret(): Promise<string | null>;
    saveConnection(connectionId: string, connection: Connection): Promise<void>;
    getConnection(connectionId: string): Promise<Connection | null>;
    deleteConnection(connectionId: string): Promise<void>;
    // dev 環境では、接続がどう見えているかを pong に入れて返す
    debug: boolean;
}

export const ORIGIN_HEADER = "x-origin-verify";
// CloudFront が付ける閲覧者のアドレス（「IP:ポート」。IPv6 は「[IP]:ポート」）
export const VIEWER_ADDRESS_HEADER = "cloudfront-viewer-address";

const ok: APIGatewayProxyResult = { statusCode: 200, body: "" };
const forbidden: APIGatewayProxyResult = { statusCode: 403, body: "" };

// API Gateway のルート（$connect / $disconnect / $default / 各操作）ごとに処理を振り分ける
export function createRouter(deps: Dependencies) {
    return async (event: WebSocketEvent): Promise<APIGatewayProxyResult> => {
        const { routeKey, connectionId } = event.requestContext;

        switch (routeKey) {
            case "$connect":
                if (!(await isFromOrigin(event, deps))) {
                    return forbidden;
                }
                await deps.saveConnection(connectionId, { ip: viewerIp(event) });
                return ok;
            case "$disconnect":
                await deps.deleteConnection(connectionId);
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
            case "ping": {
                const debug = deps.debug ? { ip: (await deps.getConnection(connectionId))?.ip ?? null } : undefined;
                await deps.send(connectionId, { type: "pong", requestId: parsed.message.requestId, ...(debug && { debug }) });
                return ok;
            }
        }
    };
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
    if (value === undefined) {
        return false;
    }
    const a = Buffer.from(value);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
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
