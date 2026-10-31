// 匿名質問ボードの URL（共有用・管理用）と、ブラウザに残す主催者の鍵（DOM に依存しない。node --test でテストする）
//
// ルーム ID と鍵は URL の # より後ろに入れる。# より後ろはサーバーに送られないため、
// EC2・CloudFront のログに残らない

import { TOKEN_PATTERN } from "../../../../infra/board/shared/protocol.ts";

export interface RoomLink {
    roomId: string;
    key: string;
}

export const ROOM_PATH = "/tools/board/room";

export function buildRoomUrl(origin: string, link: RoomLink): string {
    return `${origin}${ROOM_PATH}#${new URLSearchParams({ r: link.roomId, k: link.key })}`;
}

// location.hash（先頭の # はあってもなくてもよい）から読む。形が正しくなければ null
export function parseRoomHash(hash: string): RoomLink | null {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const roomId = params.get("r");
    const key = params.get("k");
    if (!roomId || !key || !TOKEN_PATTERN.test(roomId) || !TOKEN_PATTERN.test(key)) {
        return null;
    }
    return { roomId, key };
}

// 作成したブラウザ・管理用 URL を開いたブラウザでは、主催者の鍵を残しておき、共有用 URL から開いても主催者として入る
// （プライベートブラウズなどで保存できなくても、管理用 URL から入れば主催者になれる）
export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const adminKeyName = (roomId: string) => `board:admin:${roomId}`;

export function loadAdminKey(storage: KeyValueStorage, roomId: string): string | null {
    try {
        const key = storage.getItem(adminKeyName(roomId));
        return key && TOKEN_PATTERN.test(key) ? key : null;
    } catch {
        return null;
    }
}

export function saveAdminKey(storage: KeyValueStorage, roomId: string, key: string): void {
    try {
        storage.setItem(adminKeyName(roomId), key);
    } catch {
        // 保存できなくても、管理用 URL から入れば主催者になれる
    }
}

export function forgetAdminKey(storage: KeyValueStorage, roomId: string): void {
    try {
        storage.removeItem(adminKeyName(roomId));
    } catch {
        // 保存できない環境では、もともと残っていない
    }
}

// つなぐ WebSocket の URL。設定がなければ、ページと同じドメインの /tools/board/ws（本番の CloudFront 経由）
export function websocketUrl(configured: string | null | undefined, location: { protocol: string; host: string }): string {
    if (configured) {
        return configured;
    }
    return `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/tools/board/ws`;
}

// localStorage そのものに触れるだけで例外になる環境があるため、取れなければ何も残さない入れ物にする
export function browserStorage(): KeyValueStorage {
    try {
        return globalThis.localStorage;
    } catch {
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    }
}
