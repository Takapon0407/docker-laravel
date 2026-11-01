// 匿名質問ボードの投稿の並び順と、ブラウザに残すもの（DOM に依存しない。node --test でテストする）
// - ブラウザ ID：いいねを 1 投稿 1 回にするため、ブラウザごとに 1 つ作って残す
// - 取り消し用の鍵：自分の投稿を取り消すため、投稿したブラウザに残す
// - いいねした投稿：ボタンの表示に使う（二重のいいねはサーバーが防ぐ）

import type { PostView } from "../../../../infra/board/shared/protocol.ts";
import { TOKEN_PATTERN } from "../../../../infra/board/shared/protocol.ts";
import type { KeyValueStorage } from "./board-link.ts";

export type SortOrder = "new" | "likes";

// ピン留めはどちらの並び順でも一番上。いいね順で同じ数なら新しい順
export function sortPosts(posts: Iterable<PostView>, order: SortOrder): PostView[] {
    return [...posts].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || (order === "likes" ? b.likes - a.likes : 0) || b.createdAt - a.createdAt,
    );
}

// 16 バイトの乱数を base64url にする（サーバーの鍵と同じ形）
export function randomToken(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (bytes) => crypto.getRandomValues(bytes)): string {
    const bytes = random(new Uint8Array(16));
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

const BROWSER_ID = "board:browser";
const deleteKeysName = (roomId: string) => `board:posts:${roomId}`;
const likesName = (roomId: string) => `board:likes:${roomId}`;
const NICKNAME = "board:nickname";

// 残せない環境では、ページを開いている間だけ同じ ID を使う
export function loadBrowserId(storage: KeyValueStorage, create: () => string = randomToken): string {
    const stored = read(storage, BROWSER_ID);
    if (stored && TOKEN_PATTERN.test(stored)) {
        return stored;
    }
    const id = create();
    write(storage, BROWSER_ID, id);
    return id;
}

// 投稿 ID → 取り消し用の鍵
export function loadDeleteKeys(storage: KeyValueStorage, roomId: string): Map<string, string> {
    const data = readJson(storage, deleteKeysName(roomId));
    const keys = new Map<string, string>();
    if (data && typeof data === "object" && !Array.isArray(data)) {
        for (const [postId, key] of Object.entries(data)) {
            if (typeof key === "string") {
                keys.set(postId, key);
            }
        }
    }
    return keys;
}

export function saveDeleteKeys(storage: KeyValueStorage, roomId: string, keys: Map<string, string>): void {
    write(storage, deleteKeysName(roomId), JSON.stringify(Object.fromEntries(keys)));
}

export function loadLikes(storage: KeyValueStorage, roomId: string): Set<string> {
    const data = readJson(storage, likesName(roomId));
    return new Set(Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : []);
}

export function saveLikes(storage: KeyValueStorage, roomId: string, likes: Set<string>): void {
    write(storage, likesName(roomId), JSON.stringify([...likes]));
}

// 前に入れたニックネーム（次の投稿でも使う）
export function loadNickname(storage: KeyValueStorage): string {
    return read(storage, NICKNAME) ?? "";
}

export function saveNickname(storage: KeyValueStorage, nickname: string): void {
    write(storage, NICKNAME, nickname);
}

function read(storage: KeyValueStorage, key: string): string | null {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
}

function readJson(storage: KeyValueStorage, key: string): unknown {
    try {
        return JSON.parse(read(storage, key) ?? "null");
    } catch {
        return null;
    }
}

function write(storage: KeyValueStorage, key: string, value: string): void {
    try {
        storage.setItem(key, value);
    } catch {
        // 残せなくても、ページを開いている間は使える
    }
}
